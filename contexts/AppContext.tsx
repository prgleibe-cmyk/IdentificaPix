
import { MatchResult, Transaction } from '../types';
import React, { createContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { useReferenceData } from '../hooks/useReferenceData';
import { useReconciliation } from '../hooks/useReconciliation';
import { useReportManager } from '../hooks/useReportManager';
import { useReconciliationActions } from '../hooks/useReconciliationActions';
import { useModalController } from '../hooks/useModalController';
import { useDataDeletion } from '../hooks/useDataDeletion';
import { useAiAutoIdentify } from '../hooks/useAiAutoIdentify';
import { useSummaryData } from '../hooks/useSummaryData';
import { supabase } from '../services/supabaseClient';
import { PLACEHOLDER_CHURCH } from '../services/processingService';

export const AppContext = createContext<any>(null!);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, subscription, updateActiveReportId } = useAuth();
    const { showToast, setIsLoading, setActiveView } = useUI();
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
    const hasHydratedRef = useRef(false);

    const effectiveUser = useMemo(() => {
        if (!user) return null;
        return { ...user, id: subscription.ownerId || user.id };
    }, [user, subscription.ownerId]);

    const modalController = useModalController();
    const referenceData = useReferenceData(effectiveUser, showToast);
    const reportManager = useReportManager(effectiveUser, showToast);
    
    const effectiveIgnoreKeywords = useMemo(() => {
        return referenceData.customIgnoreKeywords || [];
    }, [referenceData.customIgnoreKeywords]);

    const reconciliation = useReconciliation({
        user: effectiveUser,
        subscription,
        churches: referenceData.churches,
        banks: referenceData.banks,
        fileModels: referenceData.fileModels,
        fetchModels: referenceData.fetchModels,
        similarityLevel: referenceData.similarityLevel,
        dayTolerance: referenceData.dayTolerance,
        customIgnoreKeywords: effectiveIgnoreKeywords,
        contributionKeywords: referenceData.contributionKeywords,
        learnedAssociations: referenceData.learnedAssociations,
        showToast,
        setIsLoading,
        setActiveView,
        updateActiveReportId
    });

    /**
     * 👁️ VISUALIZADOR DE RELATÓRIOS
     * Carrega os dados de um relatório salvo e redireciona para a tela correta.
     */
    const viewSavedReport = useCallback(async (reportId: string) => {
        // Tenta encontrar na lista local primeiro
        const localReport = reportManager.savedReports.find(r => r.id === reportId);
        
        setIsLoading(true);
        try {
            let results = localReport?.data?.results;
            let spreadsheet = localReport?.data?.spreadsheet;
            let reportName = localReport?.name;

            // Se não temos os dados (ou o relatório nem está na lista local ainda)
            if (!results && !spreadsheet) {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                const ownerId = subscription.ownerId || currentUser?.id;
                
                if (subscription.role === 'owner') {
                    const { data: reportData, error } = await supabase
                        .from('saved_reports')
                        .select('data, name')
                        .eq('id', reportId)
                        .single() as { data: any | null, error: any };
                    
                    if (error) throw error;
                    if (!reportData) throw new Error('Report not found');
                    
                    const rawData = reportData.data;
                    const parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                    results = parsedData?.results;
                    spreadsheet = parsedData?.spreadsheet;
                    reportName = reportData.name;
                } else {
                    // Para usuários secundários, usamos a API backend
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;

                    const response = await fetch(`/api/reference/report/${reportId}?ownerId=${ownerId}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (response.ok) {
                        const resData = await response.json();
                        // O backend retorna { data: { results, spreadsheet }, name: "..." }
                        const rawData = resData.data;
                        const parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                        results = parsedData?.results;
                        spreadsheet = parsedData?.spreadsheet;
                        reportName = resData.name;
                    } else {
                        throw new Error("Falha ao buscar detalhes do relatório via API.");
                    }
                }
            }

            if ((results && results.length > 0) || spreadsheet) {
                reconciliation.setActiveReportId(reportId);
                reconciliation.setHasActiveSession(true);

                // Se tiver resultados de conciliação, carrega na lista viva e vai para Relatórios
                if (results && results.length > 0) {
                    let hydrated = results.map((r: any) => ({
                        ...r,
                        church: referenceData.churches.find((c: any) => c.id === (r.church?.id || r._churchId)) || r.church || PLACEHOLDER_CHURCH
                    }));

                    // Filtro de Segurança para Membros: Ver apenas suas igrejas autorizadas dentro do relatório
                    if (subscription.role === 'member' && subscription.congregationIds && subscription.congregationIds.length > 0) {
                        hydrated = hydrated.filter((r: any) => subscription.congregationIds.includes(r.church?.id || r._churchId));
                    }

                    reconciliation.setMatchResults(hydrated);
                    setActiveView('reports');
                } 
                // Se for apenas planilha ou ranking sem resultados brutos, vai para o Gerador
                else if (spreadsheet) {
                    setActiveView('smart_analysis');
                }

                showToast(`Relatório "${reportName || 'Carregado'}" carregado.`, "success");
            } else {
                showToast("Este relatório está vazio.", "error");
            }
        } catch (error: any) {
            console.error("[AppContext] Erro ao abrir relatório:", error);
            showToast("Erro ao carregar os dados do relatório.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [reportManager.savedReports, referenceData.churches, reconciliation, setActiveView, setIsLoading, showToast]);

    /**
     * 🔐 PERSISTÊNCIA MESTRE (Auto-Save Direto)
     * Salva o estado ATUAL e COMPLETO de matchResults no banco de dados.
     */
    const persistActiveReport = useCallback(async (customResults?: MatchResult[]) => {
        const reportId = reconciliation.activeReportId;
        const resultsToSave = customResults || reconciliation.matchResults;
        
        if (reportId && (resultsToSave.length > 0 || reportManager.savedReports.find(r => r.id === reportId)?.data?.spreadsheet)) {
            setIsSyncing(true);
            try {
                await reportManager.overwriteSavedReport(reportId, resultsToSave);
            } finally {
                setTimeout(() => setIsSyncing(false), 500);
            }
        }
    }, [reconciliation.activeReportId, reconciliation.matchResults, reportManager]);

    /**
     * 📝 WRAPPER DE CRIAÇÃO
     * Estende o confirmSaveReport para atualizar o activeReportId no reconciliation state.
     */
    const wrappedConfirmSaveReport = useCallback(async (name: string) => {
        const newId = await reportManager.confirmSaveReport(name);
        if (newId) {
            reconciliation.setActiveReportId(newId);
            reconciliation.setHasActiveSession(true);
        }
    }, [reportManager, reconciliation]);

    const reconciliationActions = useReconciliationActions({ 
        reconciliation, 
        referenceData, 
        showToast,
        onAfterAction: persistActiveReport 
    });

    const { confirmDeletion } = useDataDeletion({ user: effectiveUser, modalController, referenceData, reportManager, reconciliation, showToast });
    const { runAiAutoIdentification } = useAiAutoIdentify({ 
        reconciliation, 
        referenceData, 
        effectiveIgnoreKeywords, 
        setIsLoading, 
        showToast,
        onAfterIdentification: persistActiveReport 
    });

    const summary = useSummaryData(reconciliation, reportManager, selectedBankId);

    const bankList = useMemo(() => {
        if (!referenceData.banks) return [];
        let list = referenceData.banks.map((b: any) => ({ id: b.id, name: b.name }));
        
        if (subscription.role !== 'owner') {
            const allowedIds = subscription.bankIds || [];
            if (allowedIds.length > 0) {
                list = list.filter((b: any) => allowedIds.includes(b.id));
            }
        }

        return list.sort((a: any, b: any) => a.name.localeCompare(b.name));
    }, [referenceData.banks, subscription]);

    const saveSmartEdit = useCallback(async (result: MatchResult) => {
        if (result.status === 'IDENTIFICADO' && result.contributor && result.church) {
             referenceData.learnAssociation(result);
        }

        const updatedSet = reconciliation.matchResults.map((r: any) => 
            r.transaction.id === result.transaction.id ? result : r
        );
        
        reconciliation.setMatchResults(updatedSet);
        modalController.closeSmartEdit();
        showToast("Identificação atualizada.", "success");

        if (reconciliation.activeReportId) {
            persistActiveReport(updatedSet);
        }
    }, [reconciliation, referenceData, modalController, showToast, persistActiveReport]);

    const openManualIdentify = useCallback((txId: string) => {
        const tx = reconciliation.matchResults.find((r: any) => r.transaction.id === txId)?.transaction;
        if (tx) reconciliation.setManualIdentificationTx(tx);
    }, [reconciliation]);

    const handleGmailSyncSuccess = useCallback((transactions: Transaction[]) => {
        reconciliation.importGmailTransactions(transactions);
        setTimeout(() => reconciliation.handleCompare(), 500);
    }, [reconciliation]);

    const activeSpreadsheetData = useMemo(() => {
        if (!reconciliation.activeReportId) return undefined;
        const report = reportManager.savedReports.find(r => r.id === reconciliation.activeReportId);
        return report?.data?.spreadsheet;
    }, [reconciliation.activeReportId, reportManager.savedReports]);

    useEffect(() => { if (user !== undefined) setInitialDataLoaded(true); }, [user]);

    /**
     * ☁️ CLOUD-FIRST HYDRATION
     * Se o usuário não tem uma sessão ativa local, mas tem uma no banco de dados,
     * carrega automaticamente o relatório para manter a continuidade entre dispositivos.
     */
    useEffect(() => {
        if (!initialDataLoaded || !user || !subscription.activeReportId || !referenceData.isReady || !reportManager.isReady || hasHydratedRef.current) return;
        
        // Se não houver relatório ativo local OU se o relatório ativo local for diferente do da nuvem
        // (Isso garante que se o usuário mudar de relatório em outro dispositivo, este também mude)
        if (!reconciliation.activeReportId || (reconciliation.activeReportId !== subscription.activeReportId && reconciliation.matchResults.length === 0)) {
            console.log("[CloudHydration] Carregando relatório ativo da nuvem:", subscription.activeReportId);
            hasHydratedRef.current = true;
            viewSavedReport(subscription.activeReportId);
        }
    }, [initialDataLoaded, user, subscription.activeReportId, reconciliation.activeReportId, reconciliation.matchResults.length, viewSavedReport, referenceData.isReady, reportManager.isReady]);

    const value = useMemo(() => ({
        ...referenceData, 
        effectiveIgnoreKeywords, 
        ...reportManager, 
        confirmSaveReport: wrappedConfirmSaveReport, // Override with wrapped version
        ...reconciliation,
        ...reconciliationActions, 
        ...modalController,
        initialDataLoaded, summary, activeSpreadsheetData, saveSmartEdit, isSyncing,
        selectedBankId, setSelectedBankId, bankList,
        saveCurrentReportChanges: persistActiveReport,
        handleGmailSyncSuccess, confirmDeletion, openManualIdentify, runAiAutoIdentification,
        findMatchResult: reconciliation.findMatchResult,
        loadingAiId: reconciliation.loadingAiId,
        viewSavedReport
    }), [
        referenceData, effectiveIgnoreKeywords, reportManager, wrappedConfirmSaveReport, reconciliation, reconciliationActions,
        modalController, initialDataLoaded, summary, activeSpreadsheetData, 
        saveSmartEdit, isSyncing, persistActiveReport, handleGmailSyncSuccess, confirmDeletion, openManualIdentify,
        runAiAutoIdentification, viewSavedReport, selectedBankId, setSelectedBankId, bankList
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
