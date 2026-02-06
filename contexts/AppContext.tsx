
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
    const { user } = useAuth();
    const { showToast, setIsLoading, setActiveView } = useUI();
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const modalController = useModalController();
    const referenceData = useReferenceData(user, showToast);
    const reportManager = useReportManager(user, showToast);
    
    const effectiveIgnoreKeywords = useMemo(() => {
        return referenceData.customIgnoreKeywords || [];
    }, [referenceData.customIgnoreKeywords]);

    const reconciliation = useReconciliation({
        user, churches: referenceData.churches, banks: referenceData.banks,
        fileModels: referenceData.fileModels, fetchModels: referenceData.fetchModels,
        similarityLevel: referenceData.similarityLevel,
        dayTolerance: referenceData.dayTolerance, customIgnoreKeywords: effectiveIgnoreKeywords,
        contributionKeywords: referenceData.contributionKeywords, learnedAssociations: referenceData.learnedAssociations,
        showToast, setIsLoading, setActiveView
    });

    /**
     * 👁️ VISUALIZADOR DE RELATÓRIOS
     * Carrega os dados de um relatório salvo e redireciona para a tela correta.
     */
    const viewSavedReport = useCallback(async (reportId: string) => {
        const report = reportManager.savedReports.find(r => r.id === reportId);
        if (!report) return;

        setIsLoading(true);
        try {
            let results = report.data?.results;
            let spreadsheet = report.data?.spreadsheet;
            
            if (!results && !spreadsheet) {
                const { data, error } = await supabase
                    .from('saved_reports')
                    .select('data')
                    .eq('id', reportId)
                    .single();
                
                if (error) throw error;
                const parsedData = typeof data?.data === 'string' ? JSON.parse(data.data) : data?.data;
                results = parsedData?.results;
                spreadsheet = parsedData?.spreadsheet;
            }

            if ((results && results.length > 0) || spreadsheet) {
                reconciliation.setActiveReportId(reportId);
                reconciliation.setHasActiveSession(true);

                // Se tiver resultados de conciliação, carrega na lista viva e vai para Relatórios
                if (results && results.length > 0) {
                    const hydrated = results.map((r: any) => ({
                        ...r,
                        church: referenceData.churches.find((c: any) => c.id === (r.church?.id || r._churchId)) || r.church || PLACEHOLDER_CHURCH
                    }));
                    reconciliation.setMatchResults(hydrated);
                    setActiveView('reports');
                } 
                // Se for apenas planilha ou ranking sem resultados brutos, vai para o Gerador
                else if (spreadsheet) {
                    setActiveView('smart_analysis');
                }

                showToast(`Relatório "${report.name}" carregado.`, "success");
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
        
        if (reportId && resultsToSave.length > 0) {
            setIsSyncing(true);
            try {
                await reportManager.overwriteSavedReport(reportId, resultsToSave);
            } finally {
                setTimeout(() => setIsSyncing(false), 500);
            }
        }
    }, [reconciliation.activeReportId, reconciliation.matchResults, reportManager]);

    const reconciliationActions = useReconciliationActions({ 
        reconciliation, 
        referenceData, 
        showToast,
        onAfterAction: persistActiveReport 
    });

    const { confirmDeletion } = useDataDeletion({ user, modalController, referenceData, reportManager, reconciliation, showToast });
    const { runAiAutoIdentification } = useAiAutoIdentify({ 
        reconciliation, 
        referenceData, 
        effectiveIgnoreKeywords, 
        setIsLoading, 
        showToast,
        onAfterIdentification: persistActiveReport 
    });

    const summary = useSummaryData(reconciliation, reportManager);

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

    const value = useMemo(() => ({
        ...referenceData, effectiveIgnoreKeywords, ...reportManager, ...reconciliation,
        ...reconciliationActions, ...modalController,
        initialDataLoaded, summary, activeSpreadsheetData, saveSmartEdit, isSyncing,
        saveCurrentReportChanges: persistActiveReport,
        handleGmailSyncSuccess, confirmDeletion, openManualIdentify, runAiAutoIdentification,
        findMatchResult: reconciliation.findMatchResult,
        loadingAiId: reconciliation.loadingAiId,
        viewSavedReport
    }), [
        referenceData, effectiveIgnoreKeywords, reportManager, reconciliation, reconciliationActions,
        modalController, initialDataLoaded, summary, activeSpreadsheetData, 
        saveSmartEdit, isSyncing, persistActiveReport, handleGmailSyncSuccess, confirmDeletion, openManualIdentify,
        runAiAutoIdentification, viewSavedReport
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
