import { useCallback, useEffect, useRef } from 'react';
import { MatchResult, ReconciliationStatus, GroupedReportData, Transaction } from '../../types';
import { matchTransactions, groupResultsByChurch, PLACEHOLDER_CHURCH } from '../../services/processingService';
import { batchState } from './useCloudSync';

interface UseTransactionMatcherProps {
    subscription: any;
    user: any;
    matchResults: MatchResult[];
    setMatchResults: (update: (prev: MatchResult[]) => MatchResult[]) => void;
    setReportPreviewData: (data: { income: GroupedReportData; expenses: GroupedReportData } | null) => void;
    activeBankFiles: any[];
    selectedBankIds: string[];
    contributorFiles: any[];
    similarityLevel: number;
    dayTolerance: number;
    learnedAssociations: any;
    churches: any[];
    setIsLoading: (loading: boolean) => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
    setHasActiveSession: (has: boolean) => void;
    hasActiveSession: boolean;
    setLaunchedResults: (update: (prev: MatchResult[]) => MatchResult[]) => void;
    bulkIdentificationTxs: Transaction[];
    setBulkIdentificationTxs: (txs: Transaction[]) => void;
    activeReportId: string | null;
    overwriteSavedReport: (reportId: string, results: MatchResult[]) => Promise<void>;
    triggerSync?: (updatedRow: MatchResult) => void;
}

export const useTransactionMatcher = ({
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
    setIsLoading,
    showToast,
    setHasActiveSession,
    hasActiveSession,
    setLaunchedResults,
    bulkIdentificationTxs,
    setBulkIdentificationTxs,
    activeReportId,
    overwriteSavedReport,
    triggerSync
}: UseTransactionMatcherProps) => {

    const syncDebounceRef = useRef<any>(null);

    const reportCacheRef = useRef<{
        prevMatchResults: MatchResult[] | null;
        prevFilters: { isSecondary: boolean; congregationIds: string[] } | null;
        resultsMap: Map<string, MatchResult>;
        income: Record<string, MatchResult[]>;
        expenses: MatchResult[];
    }>({
        prevMatchResults: null,
        prevFilters: null,
        resultsMap: new Map(),
        income: {},
        expenses: []
    });

    const matchResultsRef = useRef(matchResults);
    const activeBankFilesRef = useRef(activeBankFiles);
    const selectedBankIdsRef = useRef(selectedBankIds);
    const contributorFilesRef = useRef(contributorFiles);
    const learnedAssociationsRef = useRef(learnedAssociations);
    const churchesRef = useRef(churches);

    useEffect(() => {
        matchResultsRef.current = matchResults;
    }, [matchResults]);

    useEffect(() => {
        activeBankFilesRef.current = activeBankFiles;
    }, [activeBankFiles]);

    useEffect(() => {
        selectedBankIdsRef.current = selectedBankIds;
    }, [selectedBankIds]);

    useEffect(() => {
        contributorFilesRef.current = contributorFiles;
    }, [contributorFiles]);

    useEffect(() => {
        learnedAssociationsRef.current = learnedAssociations;
    }, [learnedAssociations]);

    useEffect(() => {
        churchesRef.current = churches;
    }, [churches]);

    const regenerateReportPreview = useCallback((results: MatchResult[]) => {
        const isSecondary = (subscription?.ownerId && subscription.ownerId !== user?.id) &&
            subscription.role !== 'owner' &&
            subscription.role !== 'admin' &&
            subscription.role !== 'principal';
        const congregationIds = subscription?.congregationIds || [];

        const prevMatchResults = reportCacheRef.current.prevMatchResults;
        const prevFilters = reportCacheRef.current.prevFilters;
        
        const filtersChanged = !prevFilters || 
            prevFilters.isSecondary !== isSecondary ||
            prevFilters.congregationIds.length !== congregationIds.length ||
            prevFilters.congregationIds.some((id: string, i: number) => id !== congregationIds[i]);

        let needsFullRebuild = !prevMatchResults || filtersChanged;

        const resultsMap = reportCacheRef.current.resultsMap;
        const currentIncome = { ...reportCacheRef.current.income };
        let currentExpenses = [...reportCacheRef.current.expenses];

        const getChurchKey = (r: any): string => {
            if (r.church?.id && r.church.id !== 'unidentified') {
                return r.church.id;
            } else if (r._churchId && r._churchId !== 'unidentified') {
                return r._churchId;
            }
            return 'unidentified';
        };

        if (!needsFullRebuild) {
            const uniqueNewMap = new Map<string, MatchResult>();
            for (let i = 0; i < results.length; i++) {
                const r = results[i];
                const id = r.transaction?.id;
                if (id) {
                    uniqueNewMap.set(id, r);
                }
            }

            const changedOrAdded: MatchResult[] = [];
            uniqueNewMap.forEach((r, id) => {
                const prevR = resultsMap.get(id);
                if (!prevR || prevR !== r) {
                    changedOrAdded.push(r);
                }
            });

            const deletedIds: string[] = [];
            resultsMap.forEach((_, id) => {
                if (!uniqueNewMap.has(id)) {
                    deletedIds.push(id);
                }
            });

            const totalChanges = changedOrAdded.length + deletedIds.length;

            if (totalChanges > 20) {
                needsFullRebuild = true;
            } else if (totalChanges > 0) {
                const affectedChurches = new Set<string>();
                let affectedExpenses = false;

                const removeOldItem = (item: MatchResult) => {
                    if (isSecondary && congregationIds.length > 0) {
                        const churchId = item.church?.id || item._churchId || 'unidentified';
                        if (churchId !== 'unidentified' && !congregationIds.includes(churchId)) {
                            return;
                        }
                    }

                    const val = item.status === ReconciliationStatus.PENDING
                        ? (item.contributorAmount || item.contributor?.amount || 0)
                        : item.transaction.amount;

                    if (Number(val) === 0) return;

                    if (val >= 0) {
                        const churchKey = getChurchKey(item);
                        if (currentIncome[churchKey]) {
                            const originalArray = currentIncome[churchKey];
                            const newArray = originalArray.filter(x => x.transaction.id !== item.transaction.id);
                            affectedChurches.add(churchKey);
                            if (newArray.length === 0) {
                                delete currentIncome[churchKey];
                            } else {
                                currentIncome[churchKey] = newArray;
                            }
                        }
                    } else {
                        currentExpenses = currentExpenses.filter(x => x.transaction.id !== item.transaction.id);
                        affectedExpenses = true;
                    }
                };

                const addNewItem = (item: MatchResult) => {
                    if (isSecondary && congregationIds.length > 0) {
                        const churchId = item.church?.id || item._churchId || 'unidentified';
                        if (churchId !== 'unidentified' && !congregationIds.includes(churchId)) {
                            return;
                        }
                    }

                    const val = item.status === ReconciliationStatus.PENDING
                        ? (item.contributorAmount || item.contributor?.amount || 0)
                        : item.transaction.amount;

                    if (Number(val) === 0) return;

                    if (val >= 0) {
                        const churchKey = getChurchKey(item);
                        const originalArray = currentIncome[churchKey] || [];
                        currentIncome[churchKey] = [...originalArray, item];
                        affectedChurches.add(churchKey);
                    } else {
                        currentExpenses = [...currentExpenses, item];
                        affectedExpenses = true;
                    }
                };

                for (let i = 0; i < deletedIds.length; i++) {
                    const id = deletedIds[i];
                    const prevR = resultsMap.get(id);
                    if (prevR) {
                        removeOldItem(prevR);
                        resultsMap.delete(id);
                    }
                }

                for (let i = 0; i < changedOrAdded.length; i++) {
                    const r = changedOrAdded[i];
                    const id = r.transaction?.id;
                    if (!id) continue;
                    const prevR = resultsMap.get(id);
                    if (prevR) {
                        removeOldItem(prevR);
                    }
                    addNewItem(r);
                    resultsMap.set(id, r);
                }

                if (affectedChurches.size > 0 || affectedExpenses) {
                    reportCacheRef.current.income = currentIncome;
                    reportCacheRef.current.expenses = currentExpenses;
                    setReportPreviewData({
                        income: currentIncome,
                        expenses: { 'all_expenses_group': currentExpenses }
                    });
                }
            }
        }

        if (needsFullRebuild) {
            const newResultsMap = new Map<string, MatchResult>();
            const newIncome: Record<string, MatchResult[]> = {};
            const newExpenses: MatchResult[] = [];

            let filteredResults = results;
            if (isSecondary && congregationIds.length > 0) {
                filteredResults = results.filter(r => {
                    const churchId = r.church?.id || r._churchId || 'unidentified';
                    return churchId === 'unidentified' || congregationIds.includes(churchId);
                });
            }

            const uniqueResultsMap = new Map<string, MatchResult>();
            for (let i = 0; i < filteredResults.length; i++) {
                const r = filteredResults[i];
                const id = r.transaction?.id;
                if (id) {
                    uniqueResultsMap.set(id, r);
                }
            }

            uniqueResultsMap.forEach((r, id) => {
                newResultsMap.set(id, r);

                const val = r.status === ReconciliationStatus.PENDING
                    ? (r.contributorAmount || r.contributor?.amount || 0)
                    : r.transaction.amount;

                if (Number(val) === 0) return;

                if (val >= 0) {
                    const churchKey = getChurchKey(r);
                    if (!newIncome[churchKey]) newIncome[churchKey] = [];
                    newIncome[churchKey].push(r);
                } else {
                    newExpenses.push(r);
                }
            });

            reportCacheRef.current = {
                prevMatchResults: results,
                prevFilters: { isSecondary, congregationIds },
                resultsMap: newResultsMap,
                income: newIncome,
                expenses: newExpenses
            };

            setReportPreviewData({
                income: newIncome,
                expenses: { 'all_expenses_group': newExpenses }
            });
        }

        reportCacheRef.current.prevMatchResults = results;
        reportCacheRef.current.prevFilters = { isSecondary, congregationIds };
    }, [subscription, user?.id, setReportPreviewData]);

    useEffect(() => {
        if (matchResults && matchResults.length > 0) {
            // 🛡️ ESTABILIZAÇÃO CORE: Evita reconstrução imediata do preview a cada delta realtime
            if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
            syncDebounceRef.current = setTimeout(() => {
                regenerateReportPreview(matchResults);
            }, 1000); 
        }
        return () => {
            if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
        };
    }, [matchResults, regenerateReportPreview]);

    const handleCompare = useCallback(async (showLoading: any = true) => {
        const isAuto = showLoading === false;

        if (isAuto) {
            console.log('[AutoProcess:START]');
        }

        if (showLoading) {
            setIsLoading(true);
        }

        // 🔒 PRESERVA TRANSAÇÕES CONFIRMADAS
        const confirmedTransactions = matchResultsRef.current
            .filter(r => r.isConfirmed)
            .map(r => r.transaction);

        let allTransactions = [
            ...activeBankFilesRef.current
                .filter(f => selectedBankIdsRef.current.includes(String(f.bankId)))
                .flatMap(f => f.processedTransactions || []),
            ...confirmedTransactions
        ].filter(tx => Number(tx.amount) !== 0);

        if (isAuto) {
            if (allTransactions.length === 0 && matchResultsRef.current.length > 0) {
                console.log('[AutoProcess:USING_LIVE_LIST_SOURCE]');
                allTransactions = matchResultsRef.current.map(r => r.transaction);
            }
        }

        if (allTransactions.length === 0) {
            if (!isAuto) showToast("Selecione pelo menos um extrato com dados.", "error");
            if (showLoading) setIsLoading(false);
            return;
        }

        if (isAuto) console.log('[AutoProcess:PROCESSING]');

        // ✅ CORREÇÃO PRINCIPAL
        // Preserva IDENTIFIED e CONFIRMED no modo automático
        const filteredExistingResults = isAuto
            ? matchResultsRef.current.filter(r =>
                r.isConfirmed ||
                r.status === ReconciliationStatus.IDENTIFIED ||
                r.status === ReconciliationStatus.PENDING
            )
            : matchResultsRef.current.filter(r =>
                selectedBankIdsRef.current.includes(String(r.transaction.bank_id))
            );

        const results = matchTransactions(
            allTransactions,
            contributorFilesRef.current,
            { similarityThreshold: similarityLevel, dayTolerance: dayTolerance },
            learnedAssociationsRef.current,
            churchesRef.current,
            filteredExistingResults
        ).filter(r => Number(r.transaction.amount) !== 0);

        setMatchResults(prev => {
            const map = new Map<string, MatchResult>();

            // Preserva estado atual
            prev.forEach(r => {
                map.set(r.transaction.id, r);
            });

            // Aplica novos resultados com proteção
            results.forEach(r => {
                const existing = map.get(r.transaction.id);

                if (existing && existing.status !== ReconciliationStatus.UNIDENTIFIED) {
                    return;
                }

                map.set(r.transaction.id, r);
            });

            return Array.from(map.values()).filter(r => Number(r.transaction.amount) !== 0);
        });
        setHasActiveSession(true);

        if (showLoading) {
            setIsLoading(false);
        }

        if (isAuto) {
            console.log('[AutoProcess:DONE]');
        } else {
            showToast("Conciliação concluída para os itens selecionados!", "success");
        }

    }, [
        similarityLevel,
        dayTolerance,
        setMatchResults,
        setHasActiveSession,
        setIsLoading,
        showToast
    ]);

    const findMatchResult = useCallback((txId: string) => {
        return matchResults.find(r => r.transaction.id === txId);
    }, [matchResults]);

    const markAsLaunched = useCallback((txId: string) => {
        setMatchResults(prev => {
            const itemIndex = prev.findIndex(r => r.transaction.id === txId);
            if (itemIndex === -1) return prev;

            const item = prev[itemIndex];

            setLaunchedResults(launched => [
                { ...item, launchedAt: new Date().toISOString() },
                ...launched
            ]);

            return prev.filter(r => r.transaction.id !== txId);
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

    const updateReportData = useCallback(async (updatedRow: MatchResult) => {
        let nextResults: MatchResult[] = [];
        batchState.isAtomicUpdate = true;
        setMatchResults(prev => {
            const next = [...prev];
            const idx = next.findIndex(r => r.transaction.id === updatedRow.transaction.id);
            if (idx !== -1) next[idx] = updatedRow;
            else next.push(updatedRow);
            nextResults = next;
            return next;
        });

        // 📡 SINCRONIZAÇÃO GLOBAL EM TEMPO REAL
        if (triggerSync) {
            triggerSync(updatedRow);
        }

        // 🛡️ PERSISTÊNCIA EXPLÍCITA (AJUSTE CIRÚRGICO)
        if (!activeReportId) {
            console.error('SEM REPORT_ID — NÃO É POSSÍVEL PERSISTIR');
            return;
        }

        try {
            await overwriteSavedReport(activeReportId, nextResults);
        } catch (error) {
            console.error("[updateReportData] Erro ao persistir:", error);
        }
    }, [setMatchResults, activeReportId, overwriteSavedReport]);

    const revertMatch = useCallback((txId: string) => {
        batchState.isAtomicUpdate = true;
        setMatchResults(prev =>
            prev.map(r =>
                r.transaction.id === txId
                    ? {
                        ...r,
                        status: ReconciliationStatus.UNIDENTIFIED,
                        contributor: null,
                        church: PLACEHOLDER_CHURCH
                    }
                    : r
            )
        );
    }, [setMatchResults]);

    const closeManualIdentify = useCallback(() => {
        setBulkIdentificationTxs([]);
    }, [setBulkIdentificationTxs]);

    const removeTransaction = useCallback((id: string) => {
        batchState.isAtomicUpdate = true;
        setMatchResults(prev => prev.filter(r => r.transaction.id !== id));
    }, [setMatchResults]);

    const removeTransactions = useCallback((ids: string[]) => {
        batchState.isAtomicUpdate = true;
        setMatchResults(prev => prev.filter(r => !ids.includes(r.transaction.id)));
    }, [setMatchResults]);

    return {
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
    };
};