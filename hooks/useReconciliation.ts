
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { consolidationService } from '../services/ConsolidationService';
import { supabase } from '../services/supabaseClient';

// Novos hooks modularizados
import { useCloudSync } from './useCloudSync';
import { useFileProcessor } from './useFileProcessor';
import { useTransactionMatcher } from './useTransactionMatcher';

export const useReconciliation = ({
    user,
    subscription,
    churches,
    banks,
    fileModels,
    fetchModels,
    similarityLevel,
    dayTolerance,
    customIgnoreKeywords,
    contributionKeywords,
    learnedAssociations,
    savedReports,
    showToast,
    setIsLoading,
    setActiveView
}: any) => {

    const effectiveUserId = subscription?.ownerId || user?.id;
    const userSuffix = effectiveUserId ? `-${effectiveUserId}` : '-guest';
    
    // ESTADOS PERSISTENTES (Mantêm o progresso do relatório)
    const [activeReportId, setActiveReportId] = usePersistentState<string | null>(`identificapix-active-report-id${userSuffix}`, null);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>(`identificapix-match-results${userSuffix}`, [], true);
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
    const [triggerSync, setTriggerSync] = useState(0);
    
    const [launchedResults, setLaunchedResults] = usePersistentState<MatchResult[]>(`identificapix-launched${userSuffix}`, [], true);

    // 1. Hook de Sincronização em Nuvem
    const { syncToCloud, isHydratingFromCloud } = useCloudSync({
        user,
        effectiveUserId,
        matchResults,
        setMatchResults,
        setHasActiveSession,
        activeReportId,
        savedReports,
        churches
    });

    // 2. Hook de Sincronização de Lista (Original)
    const { persistTransactions, clearRemoteList, hydrate } = useLiveListSync({
        user,
        subscription,
        setBankStatementFile,
        setSelectedBankIds
    });

    // 3. Hook de Processamento de Arquivos
    const { 
        handleStatementUpload, 
        importGmailTransactions, 
        removeBankStatementFile,
        handleContributorsUpload,
        removeContributorFile
    } = useFileProcessor({
        user,
        fileModels,
        fetchModels,
        customIgnoreKeywords,
        contributionKeywords,
        persistTransactions,
        showToast,
        hydrate,
        setIsLoading,
        clearRemoteList,
        churches,
        setContributorFiles,
        setModelRequiredData
    });

    // 4. Hook de Matching de Transações
    const { handleCompare, regenerateReportPreview } = useTransactionMatcher({
        subscription,
        user,
        matchResults,
        setMatchResults,
        setReportPreviewData,
        activeBankFiles,
        selectedBankIds,
        contributorFiles,
        similarityLevel,
        dayTolerance,
        learnedAssociations,
        churches,
        customIgnoreKeywords,
        setIsLoading,
        showToast,
        setHasActiveSession
    });

    // Filtros de segurança para membros
    const filteredMatchResults = useMemo(() => {
        let results = matchResults;
        const isSecondary = subscription?.ownerId && subscription.ownerId !== user?.id;
        if (isSecondary) {
            if (subscription.congregationIds && subscription.congregationIds.length > 0) {
                results = results.filter(r => {
                    const churchId = r.church?.id || r._churchId || (r.transaction as any)?.church_id;
                    return subscription.congregationIds.includes(churchId);
                });
            }
            if (subscription.bankIds && subscription.bankIds.length > 0) {
                results = results.filter(r => subscription.bankIds.includes(String(r.transaction.bank_id)));
            }
        }
        return results;
    }, [matchResults, subscription, user?.id]);

    const filteredLaunchedResults = useMemo(() => {
        let results = launchedResults;
        const isSecondary = subscription?.ownerId && subscription.ownerId !== user?.id;
        if (isSecondary) {
            if (subscription.congregationIds && subscription.congregationIds.length > 0) {
                results = results.filter(r => {
                    const churchId = r.church?.id || r._churchId || (r.transaction as any)?.church_id;
                    return subscription.congregationIds.includes(churchId);
                });
            }
            if (subscription.bankIds && subscription.bankIds.length > 0) {
                results = results.filter(r => subscription.bankIds.includes(String(r.transaction.bank_id)));
            }
        }
        return results;
    }, [launchedResults, subscription, user?.id]);

    const lastValidatedHash = useRef<string>('');
    const isValidating = useRef<boolean>(false);

    /**
     * 📡 REALTIME SYNC (Escuta mudanças de confirmação)
     */
    useEffect(() => {
        if (!effectiveUserId) return;
        
        const channel = supabase
            .channel(`reconciliation-status-sync-${effectiveUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'consolidated_transactions',
                    filter: `user_id=eq.${effectiveUserId}`
                },
                (payload) => {
                    if (payload.new && payload.new.is_confirmed === true) {
                        // Força a re-validação do cache local
                        lastValidatedHash.current = '';
                        setTriggerSync(prev => prev + 1);
                    }
                }
            )
            .subscribe();
            
        return () => {
            supabase.removeChannel(channel);
        };
    }, [effectiveUserId]);

    /**
     * 🛡️ INTEGRIDADE DO CACHE (Anti-Stale)
     */
    useEffect(() => {
        if (!effectiveUserId || matchResults.length === 0 || isValidating.current) return;

        const currentIdsHash = matchResults.map(r => r.transaction.id).sort().join(',');
        if (currentIdsHash === lastValidatedHash.current) return;

        const cleanStaleCache = async () => {
            isValidating.current = true;
            
            const realIds = matchResults
                .map(r => r.transaction.id)
                .filter(id => /^[0-9a-fA-F-]{36}$/.test(id));
            
            if (realIds.length === 0) {
                lastValidatedHash.current = currentIdsHash;
                isValidating.current = false;
                return;
            }

            try {
                const confirmedIds = await consolidationService.checkConfirmedTransactions(effectiveUserId, realIds);
                
                if (confirmedIds.length > 0) {
                    setMatchResults(prev => {
                        let hasChanges = false;
                        const updated = prev.map(r => {
                            if (confirmedIds.includes(r.transaction.id) && !r.isConfirmed) {
                                hasChanges = true;
                                return { 
                                    ...r, 
                                    isConfirmed: true, 
                                    transaction: { ...r.transaction, isConfirmed: true } 
                                };
                            }
                            return r;
                        });
                        
                        if (!hasChanges) return prev;
                        
                        lastValidatedHash.current = updated.map(r => r.transaction.id).sort().join(',');
                        return updated;
                    });
                } else {
                    lastValidatedHash.current = currentIdsHash;
                }
            } catch (e) {
                console.error("[CacheSync] Erro ao validar integridade do cache:", e);
            } finally {
                isValidating.current = false;
            }
        };

        const timer = setTimeout(cleanStaleCache, 500);
        return () => clearTimeout(timer);
    }, [effectiveUserId, matchResults, setMatchResults, triggerSync]);

    const findMatchResult = useCallback((txId: string) => {
        return matchResults.find(r => r.transaction.id === txId);
    }, [matchResults]);

    const resetReconciliation = useCallback(async () => {
        setIsLoading(true);
        try {
            await clearRemoteList('all');
            setMatchResults([]);
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

    const markAsLaunched = useCallback((txId: string) => {
        setMatchResults(prev => {
            const itemIndex = prev.findIndex(r => r.transaction.id === txId);
            if (itemIndex === -1) return prev;
            const item = prev[itemIndex];
            setLaunchedResults(launched => [{ ...item, launchedAt: new Date().toISOString() }, ...launched]);
            const next = prev.filter(r => r.transaction.id !== txId);
            return next;
        });
    }, [setMatchResults, setLaunchedResults]);

    const undoLaunch = useCallback((txId: string) => {
        setLaunchedResults(prevLaunched => {
            const item = prevLaunched.find(r => r.transaction.id === txId);
            if (!item) return prevLaunched;
            const nextLaunched = prevLaunched.filter(r => r.transaction.id !== txId);
            setMatchResults(prevResults => {
                if (prevResults.some(r => r.transaction.id === txId)) return prevResults;
                return [...prevResults, item];
            });
            return nextLaunched;
        });
        showToast("Lançamento desfeito.", "success");
    }, [setMatchResults, setLaunchedResults, showToast]);

    const deleteLaunchedItem = useCallback((txId: string) => {
        setLaunchedResults(prev => prev.filter(r => r.transaction.id !== txId));
        showToast("Item removido.", "success");
    }, [setLaunchedResults, showToast]);

    return {
        activeBankFiles, contributorFiles, matchResults: filteredMatchResults, reportPreviewData,
        activeReportId, setActiveReportId, hasActiveSession, setHasActiveSession,
        comparisonType, setComparisonType, selectedBankIds,
        manualIdentificationTx, setManualIdentificationTx,
        bulkIdentificationTxs, setBulkIdentificationTxs,
        modelRequiredData, setModelRequiredData,
        loadingAiId, setLoadingAiId, findMatchResult,
        launchedResults: filteredLaunchedResults, setLaunchedResults, markAsLaunched, undoLaunch, deleteLaunchedItem,
        importGmailTransactions, handleStatementUpload, 
        handleContributorsUpload,
        removeBankStatementFile,
        removeContributorFile,
        toggleBankSelection: (id: string) => setSelectedBankIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]),
        handleCompare,
        resetReconciliation,
        updateReportData: (updatedRow: MatchResult) => {
            setMatchResults(prev => {
                const next = [...prev];
                const idx = next.findIndex(r => r.transaction.id === updatedRow.transaction.id);
                if (idx !== -1) next[idx] = updatedRow;
                else next.push(updatedRow);
                return next;
            });
        },
        revertMatch: (txId: string) => {
            setMatchResults(prev => prev.map(r => r.transaction.id === txId ? { ...r, status: ReconciliationStatus.UNIDENTIFIED, contributor: null, church: PLACEHOLDER_CHURCH } : r));
        },
        closeManualIdentify: () => { setManualIdentificationTx(null); setBulkIdentificationTxs([]); },
        removeTransaction: (id: string) => {
            setMatchResults(prev => prev.filter(r => r.transaction.id !== id));
        },
        hydrate,
        setMatchResults,
        setReportPreviewData,
        syncToCloud,
        regenerateReportPreview
    };
};

