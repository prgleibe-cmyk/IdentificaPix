import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
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

    // 🔄 REQUISIÇÃO E SINCRONIZAÇÃO DE CONTRIBUINTES DO BANCO DE DADOS VPS
    const fetchContributorsToFiles = useCallback(async () => {
        try {
            if (!churches || churches.length === 0) return;

            // Busca os contribuintes apenas para as igrejas autorizadas do usuário
            const promises = churches.map(async (church: any) => {
                const resp = await fetch(`/api/v1/contributors?church_id=${church.id}`);
                if (resp.ok) {
                    const list = await resp.json();
                    return Array.isArray(list) ? list : [];
                }
                return [];
            });

            const results = await Promise.all(promises);
            const data = results.flat();
            
            const allowedChurchIds = new Set((churches || []).map((ch: any) => ch.id));
            
            const grouped = new Map<string, any[]>();
            data.forEach((c: any) => {
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

            console.log('[ContributorSync] Loaded', data.length, 'contributors across', newFiles.length, 'churches.');
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
            isConfirmed: !!row.isConfirmed,
            contributor: row.contributor || null,
            church: row.church || PLACEHOLDER_CHURCH
        };
    }, []);

    // 📡 GATILHO DE SINCRONIZAÇÃO GLOBAL
    const triggerSync = useCallback((updatedRow: MatchResult) => {
        const ownerId = subscription.ownerId || user?.id;
        if (!ownerId) return;

        const payload = buildCanonicalPayload(updatedRow);

        console.log("[Sync:Trigger] Payload CANÔNICO:", payload);
        
        supabase
            .channel(`sync-granular-${ownerId}`)
            .send({
                type: 'broadcast',
                event: 'transaction_updated',
                payload
            });
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
        overwriteSavedReport
    });

    const { persistTransactions, clearRemoteList, hydrate } = useLiveListSync({
        user,
        subscription,
        setBankStatementFile,
        setSelectedBankIds,
        realtimeRefreshKey: props.realtimeRefreshKey
    });

    const files = useFileProcessor({ ...params, persistTransactions, clearRemoteList, hydrate });

    const applySecurityFilters = useCallback((results: MatchResult[]) => {
        const isSecondary = (subscription?.ownerId && subscription.ownerId !== user?.id) &&
            subscription.role !== 'owner' &&
            subscription.role !== 'admin' &&
            subscription.role !== 'principal';
        if (!isSecondary) return results;

        let filtered = results;

        if (subscription.congregationIds?.length > 0) {
            filtered = filtered.filter(r => {
                const churchId = r.church?.id || r._churchId || (r.transaction as any)?.church_id || 'unidentified';
                return churchId === 'unidentified' || subscription.congregationIds.includes(churchId);
            });
        }

        if (subscription.bankIds?.length > 0) {
            filtered = filtered.filter(r =>
                subscription.bankIds.includes(String(r.transaction.bank_id))
            );
        }

        return filtered;
    }, [subscription, user?.id]);

    const filteredMatchResults = useMemo(() => applySecurityFilters(matchResults), [matchResults, applySecurityFilters]);
    const filteredLaunchedResults = useMemo(() => applySecurityFilters(launchedResults), [launchedResults, applySecurityFilters]);

    const { syncToCloud, isHydratingFromCloud } = cloud;
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
        closeManualIdentify,
        removeTransaction,
        removeTransactions
    } = matcher;

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
        fetchContributorsToFiles
    }), [
        syncToCloud,
        isHydratingFromCloud,
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