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
    const { showToast, setIsLoading, setActiveView } = useUI();

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

    /**
     * 👁️ VISUALIZADOR DE RELATÓRIOS
     */
    const viewSavedReport = useCallback(async (reportId: string) => {
        const report = reportManager.savedReports.find(r => r.id === reportId);
        if (!report) return;

        setIsLoading(true);
        try {
            let results = report.data?.results;
            let spreadsheet = report.data?.spreadsheet;

            if (!results && !spreadsheet) {
                const fullData = await reportManager.fetchFullReportData(reportId);
                results = fullData?.results;
                spreadsheet = fullData?.spreadsheet;
            }

            // Se temos os dados (results ou spreadsheet), abrimos o relatório
            if (results || spreadsheet) {
                reconciliation.setActiveReportId(reportId);
                reconciliation.setHasActiveSession(true);
                lastSyncedReportId.current = reportId; // Marca como sincronizado
                
                if (results) {
                    let hydrated = results.map((r: any) => ({
                        ...r,
                        church:
                            referenceData.churches.find((c: any) => c.id === (r.church?.id || r._churchId)) ||
                            r.church ||
                            PLACEHOLDER_CHURCH
                    }));

                    if (subscription.role === 'member' && subscription.congregationIds?.length > 0) {
                        hydrated = hydrated.filter((r: any) =>
                            subscription.congregationIds.includes(r.church?.id || r._churchId)
                        );
                    }

                    reconciliation.setMatchResults(hydrated);
                    setActiveView('reports');
                } else if (spreadsheet) {
                    setActiveView('reports');
                }
            } else {
                showToast("Relatório sem dados disponíveis.", "error");
            }
        } catch (error) {
            console.error("Erro ao abrir relatório:", error);
            showToast("Erro ao carregar dados do relatório.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [reportManager, reconciliation, referenceData.churches, subscription, setActiveView, showToast, setIsLoading]);

    /**
     * 👁️ VISUALIZADOR DE RELATÓRIOS (MOVIMENTADO PARA CIMA)
     */

    /**
     * 👁️ AUTO-SELEÇÃO DE RELATÓRIO (ETAPA 2)
     * Seleciona o relatório mais recente se nenhum estiver ativo para preencher a aba automaticamente
     */
    useEffect(() => {
        if (!initialDataLoaded) return;
        if (!reconciliation.activeReportId && reportManager.savedReports.length > 0) {
            const latestReport = reportManager.savedReports[0];
            // Se temos o relatório, tentamos visualizar (isso lidará com o fetch se necessário)
            viewSavedReport(latestReport.id);
        }
    }, [reconciliation.activeReportId, reportManager.savedReports, initialDataLoaded, viewSavedReport]);

    /**
     * 🔴 AJUSTE ORIGINAL (mantido)
     */
    useEffect(() => {
        const activeId = reconciliation.activeReportId;
        if (!activeId) return;

        const report = reportManager.savedReports.find(r => r.id === activeId);
        if (!report || !report.data?.results) return;

        let hydrated = report.data.results.map((r: any) => ({
            ...r,
            church:
                referenceData.churches.find((c: any) => c.id === (r.church?.id || r._churchId)) ||
                r.church ||
                PLACEHOLDER_CHURCH
        }));

        if (subscription.role === 'member' && subscription.congregationIds?.length > 0) {
            hydrated = hydrated.filter((r: any) =>
                subscription.congregationIds.includes(r.church?.id || r._churchId)
            );
        }

        reconciliation.setMatchResults(hydrated);
    }, [
        reportManager.savedReports,
        reconciliation.activeReportId,
        referenceData.churches,
        subscription.role,
        subscription.congregationIds
    ]);

    /**
     * 🔴 AJUSTE CIRÚRGICO (MELHORADO)
     * SINCRONIZA EM TEMPO REAL O RELATÓRIO ABERTO
     */
    useEffect(() => {
        if (!reconciliation.activeReportId) {
            lastSyncedReportId.current = null;
            return;
        }

        const report = reportManager.savedReports.find(
            r => r.id === reconciliation.activeReportId
        );

        if (!report || !report.data?.results) return;

        // Só atualiza se o ID do relatório mudou ou se os resultados mudaram
        if (lastSyncedReportId.current !== reconciliation.activeReportId) {
            reconciliation.setMatchResults([...report.data.results]);
            lastSyncedReportId.current = reconciliation.activeReportId;
            
            // Garante que a sessão está ativa se temos um relatório ativo
            if (!reconciliation.hasActiveSession) {
                reconciliation.setHasActiveSession(true);
            }
        }
    }, [reportManager.savedReports, reconciliation.activeReportId, reconciliation.hasActiveSession]);

    /**
     * 🔴 AJUSTE CIRÚRGICO (ADICIONADO)
     * AUTO-RESTAURAÇÃO: Abre o último relatório se não houver sessão ativa
     */
    const autoRestoredRef = useRef(false);
    useEffect(() => {
        if (!initialDataLoaded || !user || autoRestoredRef.current) return;

        // Se já existe um ID ativo na memória local, apenas marca como resolvido
        if (reconciliation.activeReportId) {
            autoRestoredRef.current = true;
            return;
        }

        // Se não tem ID ativo mas temos relatórios na nuvem, abre o mais recente
        if (reportManager.savedReports.length > 0) {
            autoRestoredRef.current = true;
            const latestReport = reportManager.savedReports[0];
            viewSavedReport(latestReport.id);
        }
    }, [initialDataLoaded, user, reportManager.savedReports, reconciliation.activeReportId, viewSavedReport]);

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
        if (user !== undefined) setInitialDataLoaded(true);
    }, [user]);

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