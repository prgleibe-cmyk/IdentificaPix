import { useCallback, useEffect } from 'react';
import { MatchResult, ReconciliationStatus, GroupedReportData, Transaction } from '../../types';
import { matchTransactions, groupResultsByChurch, PLACEHOLDER_CHURCH } from '../../services/processingService';

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
    customIgnoreKeywords: string[];
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
    customIgnoreKeywords,
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
            regenerateReportPreview(matchResults);
        }
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
        const confirmedTransactions = matchResults
            .filter(r => r.isConfirmed)
            .map(r => r.transaction);

        let allTransactions = [
            ...activeBankFiles
                .filter(f => selectedBankIds.includes(String(f.bankId)))
                .flatMap(f => f.processedTransactions || []),
            ...confirmedTransactions
        ].filter(tx => Number(tx.amount) !== 0);

        if (isAuto) {
            if (allTransactions.length === 0 && matchResults.length > 0) {
                console.log('[AutoProcess:USING_LIVE_LIST_SOURCE]');
                allTransactions = matchResults.map(r => r.transaction);
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
            ? matchResults.filter(r =>
                r.isConfirmed ||
                r.status === ReconciliationStatus.IDENTIFIED
            )
            : matchResults.filter(r =>
                selectedBankIds.includes(String(r.transaction.bank_id))
            );

        const results = matchTransactions(
            allTransactions,
            contributorFiles,
            { similarityThreshold: similarityLevel, dayTolerance: dayTolerance },
            learnedAssociations,
            churches,
            customIgnoreKeywords,
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
        activeBankFiles,
        selectedBankIds,
        matchResults,
        contributorFiles,
        similarityLevel,
        dayTolerance,
        learnedAssociations,
        churches,
        customIgnoreKeywords,
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
        setMatchResults(prev => {
            const next = [...prev];
            const idx = next.findIndex(r => r.transaction.id === updatedRow.transaction.id);
            const prevStatus = idx !== -1 ? next[idx].status : undefined;
            if (idx !== -1) {
                next[idx] = {
                    ...updatedRow,
                    reportId: (updatedRow as any).reportId || (updatedRow as any).report_id || (next[idx] as any)?.reportId || (next[idx] as any)?.report_id
                };
            } else {
                next.push(updatedRow);
            }

            if (prevStatus !== updatedRow.status) {
                console.log('[DEBUG:STATUS_CHANGE]', {
                    id: updatedRow.transaction.id,
                    prevStatus: prevStatus,
                    newStatus: updatedRow.status,
                    reportId: (updatedRow as any).report_id || (updatedRow as any).reportId
                });
            }

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
        setMatchResults(prev =>
            prev.map(r => {
                if (r.transaction.id === txId) {
                    console.log('[DEBUG:STATUS_CHANGE]', {
                        id: txId,
                        prevStatus: r.status,
                        newStatus: ReconciliationStatus.UNIDENTIFIED,
                        reportId: (r as any).report_id || (r as any).reportId
                    });
                    return {
                        ...r,
                        status: ReconciliationStatus.UNIDENTIFIED,
                        contributor: null,
                        church: PLACEHOLDER_CHURCH
                    };
                }
                return r;
            })
        );
    }, [setMatchResults]);

    const closeManualIdentify = useCallback(() => {
        setBulkIdentificationTxs([]);
    }, [setBulkIdentificationTxs]);

    const removeTransaction = useCallback((id: string) => {
        setMatchResults(prev => prev.filter(r => r.transaction.id !== id));
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
        removeTransaction
    };
};