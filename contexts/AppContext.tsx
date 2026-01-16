
import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { useReferenceData } from '../hooks/useReferenceData';
import { useReconciliation } from '../hooks/useReconciliation';
import { useReportManager } from '../hooks/useReportManager';
import { useReconciliationActions } from '../hooks/useReconciliationActions';
import { useModalController } from '../hooks/useModalController';
import { useDataDeletion } from '../hooks/useDataDeletion';
import { 
    MatchResult, 
    Transaction
} from '../types';
import { groupResultsByChurch } from '../services/processingService';

export const AppContext = createContext<any>(null!);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, systemSettings } = useAuth();
    const { showToast, setIsLoading, setActiveView } = useUI();
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);

    // --- Modularized Controllers & State Slices ---
    const modalController = useModalController();
    const referenceData = useReferenceData(user, showToast);
    const reportManager = useReportManager(user, showToast);
    
    const effectiveIgnoreKeywords = useMemo(() => {
        return [...(referenceData.customIgnoreKeywords || []), ...(systemSettings.globalIgnoreKeywords || [])];
    }, [referenceData.customIgnoreKeywords, systemSettings.globalIgnoreKeywords]);

    const reconciliation = useReconciliation({
        user,
        churches: referenceData.churches,
        banks: referenceData.banks,
        fileModels: referenceData.fileModels,
        similarityLevel: referenceData.similarityLevel,
        dayTolerance: referenceData.dayTolerance,
        customIgnoreKeywords: effectiveIgnoreKeywords,
        contributionKeywords: referenceData.contributionKeywords,
        learnedAssociations: referenceData.learnedAssociations,
        showToast,
        setIsLoading,
        setActiveView
    });

    const reconciliationActions = useReconciliationActions({
        reconciliation,
        referenceData,
        showToast
    });

    const { confirmDeletion } = useDataDeletion({
        user,
        modalController,
        referenceData,
        reportManager,
        reconciliation,
        showToast
    });

    const [isSyncing, setIsSyncing] = useState(false);

    // --- High-level Orchestration Actions ---
    const saveSmartEdit = useCallback((result: MatchResult) => {
        reconciliation.updateReportData(result);
        if (result.status === 'IDENTIFICADO' && result.contributor && result.church) {
             referenceData.learnAssociation(result);
        }
        modalController.closeSmartEdit();
        showToast("Identificação atualizada.", "success");
    }, [reconciliation, referenceData, modalController, showToast]);

    const openManualIdentify = useCallback((txId: string) => {
        const tx = reconciliation.matchResults.find(r => r.transaction.id === txId)?.transaction;
        if (tx) reconciliation.setManualIdentificationTx(tx);
    }, [reconciliation]);

    const handleGmailSyncSuccess = useCallback((transactions: Transaction[]) => {
        reconciliation.importGmailTransactions(transactions);
        setTimeout(() => reconciliation.handleCompare(), 500);
    }, [reconciliation]);

    // --- Derived State: Summary Calculation ---
    const summary = useMemo(() => {
        const results = reconciliation.matchResults;
        const hasSession = reconciliation.hasActiveSession;
        
        let identifiedCount = 0;
        let unidentifiedCount = 0;
        let totalValue = 0;
        let valuePerChurch: [string, number][] = [];
        let methodBreakdown: Record<string, number> = { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 };
        
        let autoVal = 0, manualVal = 0, pendingVal = 0;

        if (hasSession && results.length > 0) {
            identifiedCount = results.filter(r => r.status === 'IDENTIFICADO').length;
            unidentifiedCount = results.filter(r => r.status === 'NÃO IDENTIFICADO' || r.status === 'PENDENTE').length;
            
            results.forEach(r => {
                if (r.status === 'IDENTIFICADO') {
                    const val = r.transaction.amount;
                    totalValue += val;
                    if (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI') manualVal += val;
                    else autoVal += val;
                    
                    const method = r.matchMethod || 'AUTOMATIC';
                    methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
                } else {
                    pendingVal += (r.contributorAmount || r.transaction.amount);
                }
            });

            const grouped = groupResultsByChurch(results.filter(r => r.status === 'IDENTIFICADO'));
            valuePerChurch = Object.values(grouped).map(group => {
                const churchName = group[0]?.church?.name || 'Desconhecida';
                const total = group.reduce((acc, curr) => acc + curr.transaction.amount, 0);
                return [churchName, total] as [string, number];
            }).sort((a, b) => b[1] - a[1]);

        } else if (reportManager.savedReports.length > 0) {
            reportManager.savedReports.forEach(rep => {
                if (rep.data && rep.data.results) {
                    const repResults = rep.data.results as MatchResult[];
                    identifiedCount += repResults.filter(r => r.status === 'IDENTIFICADO').length;
                    
                    repResults.forEach(r => {
                        if (r.status === 'IDENTIFICADO') {
                            const method = r.matchMethod || 'AUTOMATIC';
                            methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
                        }
                    });
                }
            });
        }

        return {
            identifiedCount,
            unidentifiedCount,
            totalValue,
            autoConfirmed: { value: autoVal },
            manualConfirmed: { value: manualVal },
            pending: { value: pendingVal },
            valuePerChurch,
            methodBreakdown,
            isHistorical: !hasSession && reportManager.savedReports.length > 0
        };
    }, [reconciliation.matchResults, reconciliation.hasActiveSession, reportManager.savedReports]);

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
        ...reconciliation,
        ...reconciliationActions,
        ...modalController,
        initialDataLoaded,
        summary,
        activeSpreadsheetData,
        saveSmartEdit,
        isSyncing,
        handleGmailSyncSuccess,
        confirmDeletion,
        openManualIdentify
    }), [
        referenceData, effectiveIgnoreKeywords, reportManager, reconciliation, reconciliationActions,
        modalController, initialDataLoaded, summary, activeSpreadsheetData, 
        saveSmartEdit, isSyncing, handleGmailSyncSuccess, confirmDeletion, openManualIdentify
    ]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
