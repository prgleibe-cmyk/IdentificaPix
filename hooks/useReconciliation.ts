import { useState, useCallback, useMemo } from 'react';
import { 
    MatchResult, 
    Transaction, 
    ContributorFile,
    GroupedReportData,
    ReconciliationStatus
} from '../types';
import { PLACEHOLDER_CHURCH } from '../services/processingService';
import { useLiveListSync } from './useLiveListSync';
import { usePersistentState } from './usePersistentState';

// Novos hooks modularizados
import { useCloudSync } from './reconciliation/useCloudSync';
import { useFileProcessor } from './reconciliation/useFileProcessor';
import { useTransactionMatcher } from './reconciliation/useTransactionMatcher';

export const useReconciliation = (props: any) => {
    const {
        user,
        subscription,
        churches,
        fileModels,
        fetchModels,
        similarityLevel,
        dayTolerance,
        customIgnoreKeywords,
        contributionKeywords,
        learnedAssociations,
        savedReports,
        overwriteSavedReport,
        showToast,
        isLoading,
        setIsLoading,
        setActiveView
    } = props;

    const effectiveUserId = subscription?.ownerId || user?.id;
    const userSuffix = effectiveUserId ? `-${effectiveUserId}` : '-guest';
    
    // ESTADOS PERSISTENTES (Mantêm o progresso do relatório)
    const [activeReportId, setActiveReportId] = usePersistentState<string | null>(`identificapix-active-report-id${userSuffix}`, null);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>(`identificapix-match-results${userSuffix}`, [], true);
    const [activeSpreadsheetData, setActiveSpreadsheetData] = usePersistentState<any | null>(`identificapix-spreadsheet-data${userSuffix}`, null, true);
    const [hasActiveSession, setHasActiveSession] = usePersistentState<boolean>(`identificapix-has-session${userSuffix}`, false);
    
    const [activeBankFiles, setBankStatementFile] = useState<any[]>([]);
    const [contributorFiles, setContributorFiles] = useState<ContributorFile[]>([]);
    const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
    const [reportPreviewData, setReportPreviewData] = useState<{ income: GroupedReportData; expenses: GroupedReportData } | null>(null);
    const [comparisonType, setComparisonType] = useState<any>('income');
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [bulkIdentificationTxs, setBulkIdentificationTxs] = useState<Transaction[]>([]);
    const [modelRequiredData, setModelRequiredData] = useState<any | null>(null);
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    
    const [launchedResults, setLaunchedResults] = usePersistentState<MatchResult[]>(`identificapix-launched${userSuffix}`, [], true);

    // Agrupamento de parâmetros para os sub-hooks
    const params = {
        ...props,
        effectiveUserId,
        activeReportId, setActiveReportId,
        matchResults, setMatchResults,
        activeSpreadsheetData, setActiveSpreadsheetData,
        hasActiveSession, setHasActiveSession,
        activeBankFiles, setBankStatementFile,
        contributorFiles, setContributorFiles,
        selectedBankIds, setSelectedBankIds,
        reportPreviewData, setReportPreviewData,
        comparisonType, setComparisonType,
        manualIdentificationTx, setManualIdentificationTx,
        bulkIdentificationTxs, setBulkIdentificationTxs,
        modelRequiredData, setModelRequiredData,
        loadingAiId, setLoadingAiId,
        launchedResults, setLaunchedResults
    };

    // 1. Hook de Matching de Transações (Movido para cima para fornecer handleCompare)
    const matcher = useTransactionMatcher(params);

    // 2. Hook de Sincronização em Nuvem (CloudSync + Cache Integrity)
    const cloud = useCloudSync({
        ...params,
        learnedAssociations,
        showToast,
        handleCompare: matcher.handleCompare,
        isLoading,
        overwriteSavedReport
    });

    // 3. Hook de Sincronização de Lista (Original)
    const { persistTransactions, clearRemoteList, hydrate } = useLiveListSync({
        user,
        subscription,
        setBankStatementFile,
        setSelectedBankIds
    });

    // 4. Hook de Processamento de Arquivos
    const files = useFileProcessor({ ...params, persistTransactions, clearRemoteList, hydrate });

    // ✅ Filtros de segurança unificados (Membros/Secundários)
    const applySecurityFilters = useCallback((results: MatchResult[]) => {
        const isSecondary = subscription?.ownerId && subscription.ownerId !== user?.id;
        if (!isSecondary) return results;

        let filtered = results;
        if (subscription.congregationIds && subscription.congregationIds.length > 0) {
            filtered = filtered.filter(r => {
                const churchId = r.church?.id || r._churchId || (r.transaction as any)?.church_id;
                return subscription.congregationIds.includes(churchId);
            });
        }
        if (subscription.bankIds && subscription.bankIds.length > 0) {
            filtered = filtered.filter(r => subscription.bankIds.includes(String(r.transaction.bank_id)));
        }
        return filtered;
    }, [subscription, user?.id]);

    const filteredMatchResults = useMemo(() => applySecurityFilters(matchResults), [matchResults, applySecurityFilters]);
    const filteredLaunchedResults = useMemo(() => applySecurityFilters(launchedResults), [launchedResults, applySecurityFilters]);

    const resetReconciliation = useCallback(async () => {
        setIsLoading(true);
        try {
            await clearRemoteList('all');
            setMatchResults([]);
            setActiveSpreadsheetData(null);
            setReportPreviewData(null);
            setContributorFiles([]);
            setHasActiveSession(false);
            setActiveReportId(null);
            showToast("Sistema reiniciado.", "success");
            setActiveView('upload');
        } finally {
            setIsLoading(false);
        }
    }, [clearRemoteList, showToast, setActiveView, setIsLoading, setMatchResults, setHasActiveSession, setActiveReportId, setReportPreviewData, setContributorFiles]);

    return {
        ...cloud,
        ...files,
        ...matcher,
        activeBankFiles, 
        contributorFiles, 
        matchResults: filteredMatchResults, 
        fullMatchResults: matchResults,
        reportPreviewData,
        activeReportId, 
        setActiveReportId, 
        hasActiveSession, 
        setHasActiveSession,
        comparisonType, 
        setComparisonType, 
        selectedBankIds,
        manualIdentificationTx, 
        setManualIdentificationTx,
        bulkIdentificationTxs, 
        setBulkIdentificationTxs,
        modelRequiredData, 
        setModelRequiredData,
        loadingAiId, 
        setLoadingAiId,
        launchedResults: filteredLaunchedResults, 
        setLaunchedResults,
        resetReconciliation,
        hydrate,
        setMatchResults,
        setReportPreviewData,
        activeSpreadsheetData,
        setActiveSpreadsheetData
    };
};
