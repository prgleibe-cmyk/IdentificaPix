
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

    const reconciliationActions = useReconciliationActions({ reconciliation, referenceData, showToast });
    const { confirmDeletion } = useDataDeletion({ user, modalController, referenceData, reportManager, reconciliation, showToast });
    const { runAiAutoIdentification } = useAiAutoIdentify({ reconciliation, referenceData, effectiveIgnoreKeywords, setIsLoading, showToast });
    const summary = useSummaryData(reconciliation, reportManager);

    /**
     * 🧠 AUTO-SAVE GATEWAY (V2)
     * Persiste mudanças na nuvem SEMPRE que houver alteração nos resultados.
     */
    const lastSaveRef = useRef<number>(0);
    useEffect(() => {
        if (!reconciliation.activeReportId || reconciliation.matchResults.length === 0) return;

        const now = Date.now();
        // Debounce de 1s para evitar excesso de requisições em alterações em lote
        const timer = setTimeout(async () => {
            setIsSyncing(true);
            try {
                await reportManager.overwriteSavedReport(
                    reconciliation.activeReportId, 
                    reconciliation.matchResults
                );
                lastSaveRef.current = now;
            } finally {
                setTimeout(() => setIsSyncing(false), 800);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [reconciliation.matchResults, reconciliation.activeReportId]);

    const saveSmartEdit = useCallback((result: MatchResult) => {
        reconciliation.updateReportData(result);
        if (result.status === 'IDENTIFICADO' && result.contributor && result.church) {
             referenceData.learnAssociation(result);
        }
        modalController.closeSmartEdit();
        showToast("Identificação atualizada.", "success");
    }, [reconciliation, referenceData, modalController, showToast]);

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
