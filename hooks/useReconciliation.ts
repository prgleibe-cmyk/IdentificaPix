import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
    MatchResult, 
    Transaction, 
    ContributorFile,
    GroupedReportData,
    ReconciliationStatus
} from '../types';
import { PLACEHOLDER_CHURCH } from '../services/processingService';
import { getCachedContributors } from '../services/contributorsCache';
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
        similarityLevel,
        dayTolerance,
        contributionKeywords,
        learnedAssociations,
        savedReports,
        overwriteSavedReport,
        showToast,
        isLoading,
        setIsLoading,
        setActiveView,
        searchFilters,
        setSearchFilters
    } = props;

    const effectiveUserId = subscription?.ownerId || user?.id;
    const userSuffix = effectiveUserId ? `-${effectiveUserId}` : '-guest';
    
    // ESTADOS PERSISTENTES
    const [activeReportId, setActiveReportId] = usePersistentState<string | null>(`identificapix-active-report-id${userSuffix}`, null);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>(`identificapix-match-results${userSuffix}`, [], true);
    const [activeSpreadsheetData, setActiveSpreadsheetData] = usePersistentState<any | null>(`identificapix-spreadsheet-data${userSuffix}`, null, true);
    const [hasActiveSession, setHasActiveSession] = usePersistentState<boolean>(`identificapix-has-session${userSuffix}`, false);
    
    const [activeBankFiles, setBankStatementFile] = useState<any[]>([]);
    const [contributorFiles, setContributorFiles] = useState<ContributorFile[]>([]);
    const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
    const [reportPreviewData, setReportPreviewData] = useState<{ income: GroupedReportData; expenses: GroupedReportData } | null>(null);
    const [comparisonType, setComparisonType] = useState<any>('income');
    const [bulkIdentificationTxs, setBulkIdentificationTxs] = useState<Transaction[]>([]);
    const [modelRequiredData, setModelRequiredData] = useState<any | null>(null);
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    
    const [launchedResults, setLaunchedResults] = usePersistentState<MatchResult[]>(`identificapix-launched${userSuffix}`, [], true);

    // 🔄 REQUISIÇÃO E SINCRONIZAÇÃO DE CONTRIBUINTES DO BANCO DE DADOS VPS (COM CACHE)
    const fetchContributorsToFiles = useCallback(async () => {
        try {
            if (!churches || churches.length === 0) return;

            const allContributors = await getCachedContributors();
            const allowedChurchIds = new Set((churches || []).map((ch: any) => ch.id));
            
            const grouped = new Map<string, any[]>();
            allContributors.forEach((c: any) => {
                if (c.status !== 'inactive') {
                    const cid = c.church_id;
                    if (!allowedChurchIds.has(cid)) return; // Ignora contribuintes de igrejas não cadastradas
                    
                    if (!grouped.has(cid)) {
                        grouped.set(cid, []);
                    }
                    grouped.get(cid)!.push({
                        id: c.id,
                        name: c.canonical_name,
                        cleanedName: c.canonical_name,
                        _churchId: cid,
                        cpf: c.cpf,
                        email: c.email,
                        phone: c.phone,
                        amount: 0 // Default amount parsed from transactional matches
                    });
                }
            });

            const newFiles: ContributorFile[] = Array.from(grouped.entries()).map(([cid, list]) => {
                const church = churches.find((ch: any) => ch.id === cid)!;
                return {
                    church,
                    churchId: cid,
                    contributors: list,
                    fileName: 'Banco de Dados VPS'
                };
            });

            console.log('[ContributorSync] Loaded', allContributors.length, 'contributors across', newFiles.length, 'churches.');
            setContributorFiles(newFiles);
        } catch (e) {
            console.error('[ContributorSync] Error loading contributors:', e);
        }
    }, [churches]);

    useEffect(() => {
        // O carregamento inicial dos contribuintes agora ocorre em paralelo com as transações consolidadas
        // no Promise.all dentro do useCloudSync para evitar waterfalls e race condições.
        // Mantemos a função fetchContributorsToFiles disponível para atualizações sob demanda.
    }, [churches, fetchContributorsToFiles]);

    // ✅ NORMALIZAÇÃO TOTAL (MESMO PADRÃO DA CONFIRMAÇÃO FINAL)
    const buildCanonicalPayload = useCallback((row: MatchResult) => {
        return {
            transaction: {
                ...row.transaction,
                id: row.transaction.id
            },
            status: row.status || 'identified',
            contributionType: row.contributionType || null,
            paymentMethod: row.paymentMethod || null,
            splits: row.splits || null,
            isConfirmed: !!row.isConfirmed,
            contributor: row.contributor || null,
            church: row.church || PLACEHOLDER_CHURCH
        };
    }, []);

    // 📡 GATILHO DE SINCRONIZAÇÃO GLOBAL
    const triggerSync = useCallback((updatedRow?: MatchResult) => {
        if (!updatedRow) return;
        const ownerId = subscription.ownerId || user?.id;
        if (!ownerId) return;

        const payload = buildCanonicalPayload(updatedRow);
        console.log("[Sync:Trigger] Payload CANÔNICO:", payload);
    }, [user?.id, subscription.ownerId, buildCanonicalPayload]);

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
        bulkIdentificationTxs, setBulkIdentificationTxs,
        modelRequiredData, setModelRequiredData,
        loadingAiId, setLoadingAiId,
        launchedResults, setLaunchedResults,
        triggerSync
    };

    const matcher = useTransactionMatcher(params);

    const cloud = useCloudSync({
        ...params,
        learnedAssociations,
        showToast,
        handleCompare: matcher.handleCompare,
        isLoading,
        overwriteSavedReport,
        isReferenceReady: props.isReferenceReady
    });

    const { persistTransactions, clearRemoteList, hydrate: liveListHydrate } = useLiveListSync({
        user,
        subscription,
        setBankStatementFile,
        setSelectedBankIds,
        realtimeRefreshKey: props.realtimeRefreshKey
    });

    const hydrate = useCallback(async (forceClearUI: boolean = false) => {
        if (typeof triggerSync === 'function') {
            triggerSync();
        }
        await Promise.allSettled([
            liveListHydrate(forceClearUI),
            cloud.reconstructSession ? cloud.reconstructSession() : Promise.resolve()
        ]);
    }, [liveListHydrate, triggerSync, cloud.reconstructSession]);

    const files = useFileProcessor({ ...params, persistTransactions, clearRemoteList, hydrate });

    const applySecurityFilters = useCallback((results: MatchResult[]) => {
        if (!Array.isArray(results)) return [];

        const isSecondary = (subscription?.ownerId && subscription.ownerId !== user?.id) &&
            subscription?.role !== 'owner' &&
            subscription?.role !== 'admin' &&
            subscription?.role !== 'principal';
        if (!isSecondary) return results;

        let filtered = results;

        if (subscription?.congregationIds && subscription.congregationIds.length > 0) {
            filtered = filtered.filter(r => {
                if (!r) return false;
                const churchId = r.church?.id || r._churchId || (r.transaction as any)?.church_id || 'unidentified';
                return churchId === 'unidentified' || subscription.congregationIds.includes(churchId);
            });
        }

        if (subscription?.bankIds && subscription.bankIds.length > 0) {
            filtered = filtered.filter(r =>
                r?.transaction?.bank_id ? subscription.bankIds.includes(String(r.transaction.bank_id)) : false
            );
        }

        return filtered;
    }, [subscription, user?.id]);

    const filteredMatchResults = useMemo(() => applySecurityFilters(matchResults), [matchResults, applySecurityFilters]);
    const filteredLaunchedResults = useMemo(() => applySecurityFilters(launchedResults), [launchedResults, applySecurityFilters]);

    const { syncToCloud, isHydratingFromCloud, isHydrating, hasCompletedInitialHydration, reconstructSession } = cloud;
    const { handleStatementUpload, importGmailTransactions, removeBankStatementFile, handleContributorsUpload, removeContributorFile, toggleBankSelection } = files;
    const {
        handleCompare,
        regenerateReportPreview,
        findMatchResult,
        markAsLaunched,
        undoLaunch,
        deleteLaunchedItem,
        updateReportData,
        revertMatch,
        removeTransaction,
        removeTransactions
    } = matcher;

    const closeManualIdentify = useCallback(() => {
        matcher.closeManualIdentify();
        if (setActiveView) {
            setActiveView('reports');
        }
    }, [matcher, setActiveView]);

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

    return useMemo(() => ({
        syncToCloud,
        isHydratingFromCloud,
        isHydrating,
        handleStatementUpload,
        importGmailTransactions,
        removeBankStatementFile,
        handleContributorsUpload,
        removeContributorFile,
        toggleBankSelection,
        handleCompare,
        regenerateReportPreview,
        findMatchResult,
        markAsLaunched,
        undoLaunch,
        deleteLaunchedItem,
        updateReportData,
        revertMatch,
        closeManualIdentify,
        removeTransaction,
        removeTransactions,
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
        setActiveSpreadsheetData,
        fetchContributorsToFiles,
        hasCompletedInitialHydration,
        reconstructSession
    }), [
        syncToCloud,
        isHydratingFromCloud,
        isHydrating,
        hasCompletedInitialHydration,
        reconstructSession,
        handleStatementUpload,
        importGmailTransactions,
        removeBankStatementFile,
        handleContributorsUpload,
        removeContributorFile,
        toggleBankSelection,
        handleCompare,
        regenerateReportPreview,
        findMatchResult,
        markAsLaunched,
        undoLaunch,
        deleteLaunchedItem,
        updateReportData,
        revertMatch,
        closeManualIdentify,
        removeTransaction,
        removeTransactions,
        activeBankFiles,
        contributorFiles,
        filteredMatchResults,
        matchResults,
        reportPreviewData,
        activeReportId,
        setActiveReportId,
        hasActiveSession,
        setHasActiveSession,
        comparisonType,
        setComparisonType,
        selectedBankIds,
        bulkIdentificationTxs,
        setBulkIdentificationTxs,
        modelRequiredData,
        setModelRequiredData,
        loadingAiId,
        setLoadingAiId,
        filteredLaunchedResults,
        setLaunchedResults,
        resetReconciliation,
        hydrate,
        setMatchResults,
        setReportPreviewData,
        activeSpreadsheetData,
        setActiveSpreadsheetData,
        fetchContributorsToFiles
    ]);
};