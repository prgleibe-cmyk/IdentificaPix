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
        let filteredResults = results;

        const isSecondary = subscription?.ownerId && subscription.ownerId !== user?.id;
        if (isSecondary && subscription.congregationIds && subscription.congregationIds.length > 0) {
            filteredResults = results.filter(r =>
                subscription.congregationIds.includes(r.church?.id || r._churchId)
            );
        }

        const uniqueResults = Array.from(
            new Map(filteredResults.map(r => [r.transaction.id, r])).values()
        );

        const cleanedResults = uniqueResults.filter(r => {
            const val = r.status === ReconciliationStatus.PENDING
                ? (r.contributorAmount || r.contributor?.amount || 0)
                : r.transaction.amount;
            return Number(val) !== 0;
        });

        const incomeResults = cleanedResults.filter(r => {
            const val = r.status === ReconciliationStatus.PENDING
                ? (r.contributorAmount || r.contributor?.amount || 0)
                : r.transaction.amount;
            return val >= 0;
        });

        const expenseResults = cleanedResults.filter(r => {
            const val = r.status === ReconciliationStatus.PENDING
                ? (r.contributorAmount || r.contributor?.amount || 0)
                : r.transaction.amount;
            return val < 0;
        });

        setReportPreviewData({
            income: groupResultsByChurch(incomeResults),
            expenses: { 'all_expenses_group': expenseResults }
        });
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