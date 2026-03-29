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
    const { user, subscription } = useAuth();
    const { showToast, setIsLoading, setActiveView, isLoading } = useUI();

    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

    const effectiveUser = useMemo(() => {
        if (!user) return null;
        return { ...user, id: subscription.ownerId || user.id };
    }, [user, subscription.ownerId]);

    const modalController = useModalController();
    const referenceData = useReferenceData(effectiveUser, showToast);
    const reportManager = useReportManager(effectiveUser, showToast);
    const lastSyncedReportId = useRef<string | null>(null);

    const effectiveIgnoreKeywords = useMemo(() => {
        return referenceData.customIgnoreKeywords || [];
    }, [referenceData.customIgnoreKeywords]);

    const reconciliation = useReconciliation({
        user: user,
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
        setActiveView
    });

    const isAppReady = useMemo(() => {
        return user !== undefined && referenceData.initialDataLoaded && reportManager.initialDataLoaded;
    }, [user, referenceData.initialDataLoaded, reportManager.initialDataLoaded]);

    /**
     * 👁️ VISUALIZADOR DE RELATÓRIOS
     */
    const viewSavedReport = useCallback(async (reportId: string) => {
        const report = reportManager.savedReports.find(r => r.id === reportId);
        console.log(`[AppContext] viewSavedReport: ID=${reportId}, Encontrado=${!!report}`);
        if (!report) return;

        setIsLoading(true);
        try {
            let results = report.data?.results;
            let spreadsheet = report.data?.spreadsheet;

            console.log(`[AppContext] Dados do relatório: results=${!!results}, spreadsheet=${!!spreadsheet}`);

            if (!results && !spreadsheet) {
                console.log(`[AppContext] Buscando dados completos para o relatório ${reportId}...`);
                const fullData = await reportManager.fetchFullReportData(reportId);
                console.log(`[AppContext] Chaves do fullData:`, Object.keys(fullData || {}));
                results = fullData?.results;
                spreadsheet = fullData?.spreadsheet;
                console.log(`[AppContext] Dados completos recebidos: results=${Array.isArray(results) ? results.length : !!results}, spreadsheet=${!!spreadsheet}`);
            }

            // Se temos os dados (results ou spreadsheet), abrimos o relatório
            if ((results && results.length > 0) || spreadsheet) {
                reconciliation.setActiveReportId(reportId);
                reconciliation.setHasActiveSession(true);
                lastSyncedReportId.current = reportId; // Marca como sincronizado
                
                if (results && results.length > 0) {
                    console.log(`[AppContext] Hidratando ${results.length} resultados...`);
                    let hydrated = results.map((r: any, idx: number) => {
                        const churchId = r.church?.id || r._churchId;
                        const churchMatch = referenceData.churches.find((c: any) => c.id === churchId);
                        
                        if (idx === 0) {
                            console.log(`[AppContext] Amostra do primeiro item:`, { 
                                churchId, 
                                foundMatch: !!churchMatch,
                                churchName: churchMatch?.name || r.church?.name 
                            });
                        }

                        return {
                            ...r,
                            church: churchMatch || r.church || PLACEHOLDER_CHURCH
                        };
                    });
                    
                    // Filtro de segurança para membros (Etapa 2)
                    if (subscription.role === 'member' && subscription.congregationIds?.length > 0) {
                        const originalCount = hydrated.length;
                        hydrated = hydrated.filter((r: any) => {
                            const churchId = r.church?.id || r._churchId;
                            if (!churchId) {
                                console.warn(`[AppContext] Item sem churchId ignorado no filtro de membro.`);
                                return false;
                            }
                            return subscription.congregationIds.includes(churchId);
                        });
                        console.log(`[AppContext] Filtro de membro aplicado: ${originalCount} -> ${hydrated.length} itens. Permitidos:`, subscription.congregationIds);
                    }

                    console.log(`[AppContext] Definindo matchResults com ${hydrated.length} itens`);
                    reconciliation.setMatchResults(hydrated);
                    setActiveView('reports');
                } else if (spreadsheet) {
                    console.log(`[AppContext] Abrindo relatório via spreadsheet (results empty ou missing)`);
                    setActiveView('reports');
                }
            } else {
                console.warn(`[AppContext] Relatório ${reportId} não possui dados válidos (results=${results?.length}, spreadsheet=${!!spreadsheet})`);
                showToast("Relatório sem dados disponíveis.", "error");
            }
        } catch (error) {
            console.error("[AppContext] Erro ao abrir relatório:", error);
            showToast("Erro ao carregar dados do relatório.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [reportManager, reconciliation, referenceData.churches, subscription, setActiveView, showToast, setIsLoading]);

    /**
     * 👁️ AUTO-SELEÇÃO DE RELATÓRIO (ETAPA 2)
     * Seleciona o relatório mais recente se nenhum estiver ativo para preencher a aba automaticamente
     */
    // ✅ AUTO-RESTAURAÇÃO E AUTO-CONCILIAÇÃO
    const lastAutoRestoredId = useRef<string | null>(null);
    useEffect(() => {
        if (!isAppReady || !user) return;

        const reportId = reconciliation.activeReportId;
        if (reportId && lastAutoRestoredId.current !== reportId) {
            console.log(`[AppContext] Sessão ativa detectada: ${reportId}. Garantindo carga de dados...`);
            lastAutoRestoredId.current = reportId;
            viewSavedReport(reportId);
        }
    }, [isAppReady, user, reconciliation.activeReportId, viewSavedReport]);

        // 2. Tenta restaurar o último relatório salvo se não houver sessão ativa
        if (reportManager.savedReports.length > 0) {
            console.log(`[AppContext] Auto-restaurando último relatório: ${reportManager.savedReports[0].id}`);
            autoRestoredRef.current = true;
            const latestReport = reportManager.savedReports[0];
            viewSavedReport(latestReport.id);
            return;
        }

        // 3. Se não houver relatórios salvos mas houver dados na Lista Viva, inicia conciliação automática
        // Isso resolve o problema de "tela limpa" quando há dados mas o usuário ainda não rodou a conciliação
        if (!reconciliation.hasActiveSession && 
            reconciliation.matchResults.length === 0 && 
            reconciliation.activeBankFiles.length > 0 &&
            !isLoading) {
            
            console.log("[AppContext] Detectados dados na Lista Viva sem sessão ativa. Iniciando conciliação automática...");
            autoRestoredRef.current = true; // Marca como processado para evitar loops
            
            // Seleciona todos os bancos por padrão se nenhum estiver selecionado
            if (reconciliation.selectedBankIds.length === 0) {
                const allBankIds = reconciliation.activeBankFiles.map(f => String(f.bankId));
                reconciliation.setSelectedBankIds(allBankIds);
            }
            
            // Pequeno delay para garantir que os estados de seleção de banco foram aplicados
            setTimeout(() => {
                reconciliation.handleCompare();
            }, 100);
        }
    }, [
        isAppReady, 
        user, 
        reportManager.savedReports, 
        reconciliation.activeReportId, 
        reconciliation.hasActiveSession,
        reconciliation.matchResults.length,
        reconciliation.activeBankFiles.length,
        isLoading,
        viewSavedReport
    ]);

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

    const { confirmDeletion } = useDataDeletion({
        user: effectiveUser,
        modalController,
        referenceData,
        reportManager,
        reconciliation,
        showToast
    });

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

    const activeSpreadsheetData = useMemo(() => {
        if (!reconciliation.activeReportId) return undefined;
        const report = reportManager.savedReports.find(r => r.id === reconciliation.activeReportId);
        return report?.data?.spreadsheet;
    }, [reconciliation.activeReportId, reportManager.savedReports]);

    useEffect(() => {
        if (user !== undefined && referenceData.initialDataLoaded && reportManager.initialDataLoaded) {
            setInitialDataLoaded(true);
        }
    }, [user, referenceData.initialDataLoaded, reportManager.initialDataLoaded]);

    const value = useMemo(() => ({
        ...referenceData,
        effectiveIgnoreKeywords,
        ...reportManager,
        confirmSaveReport: wrappedConfirmSaveReport,
        ...reconciliation,
        ...reconciliationActions,
        ...modalController,
        initialDataLoaded,
        summary,
        activeSpreadsheetData,
        isSyncing,
        selectedBankId,
        setSelectedBankId,
        bankList,
        saveCurrentReportChanges: persistActiveReport,
        confirmDeletion,
        openManualIdentify: (txId: string) => {
            const tx = reconciliation.matchResults.find((r: any) => r.transaction.id === txId)?.transaction;
            if (tx) reconciliation.setManualIdentificationTx(tx);
        },
        runAiAutoIdentification,
        handleGmailSyncSuccess: reconciliation.importGmailTransactions,
        findMatchResult: reconciliation.findMatchResult,
        loadingAiId: reconciliation.loadingAiId,
        viewSavedReport
    }), [
        referenceData,
        effectiveIgnoreKeywords,
        reportManager,
        wrappedConfirmSaveReport,
        reconciliation,
        reconciliationActions,
        modalController,
        initialDataLoaded,
        summary,
        activeSpreadsheetData,
        isSyncing,
        persistActiveReport,
        confirmDeletion,
        runAiAutoIdentification,
        viewSavedReport,
        selectedBankId,
        bankList
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};