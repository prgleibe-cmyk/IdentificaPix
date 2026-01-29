
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
import { useAutomationSync } from '../hooks/useAutomationSync';
import { useAiAutoIdentify } from '../hooks/useAiAutoIdentify';
import { useSummaryData } from '../hooks/useSummaryData';

export const AppContext = createContext<any>(null!);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { showToast, setIsLoading, setActiveView } = useUI();
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const modalController = useModalController();
    const referenceData = useReferenceData(user, showToast);
    const reportManager = useReportManager(user, showToast);
    
    const { automationMacros, fetchMacros } = useAutomationSync({ user, setIsLoading, showToast });

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
        onAfterAction: persistActiveReport // Injeta o gatilho de salvamento nas ações
    });

    const { confirmDeletion } = useDataDeletion({ user, modalController, referenceData, reportManager, reconciliation, showToast });
    const { runAiAutoIdentification } = useAiAutoIdentify({ 
        reconciliation, 
        referenceData, 
        effectiveIgnoreKeywords, 
        setIsLoading, 
        showToast,
        onAfterIdentification: persistActiveReport // Injeta o gatilho no motor de IA
    });

    const summary = useSummaryData(reconciliation, reportManager);

    // Salva automaticamente se o usuário editar manualmente via SmartEdit
    const saveSmartEdit = useCallback(async (result: MatchResult) => {
        // 1. Atualiza o estado local (Memória)
        reconciliation.updateReportData(result);
        
        if (result.status === 'IDENTIFICADO' && result.contributor && result.church) {
             referenceData.learnAssociation(result);
        }
        
        modalController.closeSmartEdit();
        showToast("Identificação atualizada.", "success");

        // 2. Persiste imediatamente o conjunto completo alterado
        const updatedSet = reconciliation.matchResults.map((r: any) => 
            r.transaction.id === result.transaction.id ? result : r
        );
        persistActiveReport(updatedSet);
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
        ...reconciliationActions, ...modalController, automationMacros, fetchMacros,
        initialDataLoaded, summary, activeSpreadsheetData, saveSmartEdit, isSyncing,
        handleGmailSyncSuccess, confirmDeletion, openManualIdentify, runAiAutoIdentification,
        findMatchResult: reconciliation.findMatchResult,
        loadingAiId: reconciliation.loadingAiId
    }), [
        referenceData, effectiveIgnoreKeywords, reportManager, reconciliation, reconciliationActions,
        modalController, automationMacros, fetchMacros, initialDataLoaded, summary, activeSpreadsheetData, 
        saveSmartEdit, isSyncing, handleGmailSyncSuccess, confirmDeletion, openManualIdentify,
        runAiAutoIdentification
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
