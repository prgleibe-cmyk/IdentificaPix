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
    manualIdentificationTx: Transaction | null;
    setManualIdentificationTx: (tx: Transaction | null) => void;
    bulkIdentificationTxs: Transaction[];
    setBulkIdentificationTxs: (txs: Transaction[]) => void;
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
    manualIdentificationTx,
    setManualIdentificationTx,
    bulkIdentificationTxs,
    setBulkIdentificationTxs
}: UseTransactionMatcherProps) => {

    const regenerateReportPreview = useCallback((results: MatchResult[]) => {
        // Filtro de segurança para membros no preview
        let filteredResults = results;
        const isSecondary = subscription?.ownerId && subscription.ownerId !== user?.id;
        if (isSecondary && subscription.congregationIds && subscription.congregationIds.length > 0) {
            filteredResults = results.filter(r => subscription.congregationIds.includes(r.church?.id || r._churchId));
        }

        const uniqueResults = Array.from(new Map(filteredResults.map(r => [r.transaction.id, r])).values());
        
        const incomeResults = uniqueResults.filter(r => {
            const val = r.status === ReconciliationStatus.PENDING 
                ? (r.contributorAmount || r.contributor?.amount || 0) 
                : r.transaction.amount;
            return val >= 0; 
        });
        
        const expenseResults = uniqueResults.filter(r => {
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

    // Sincroniza o Preview sempre que os resultados persistentes mudarem
    useEffect(() => {
        if (matchResults && matchResults.length > 0) {
            regenerateReportPreview(matchResults);
        }
    }, [matchResults, regenerateReportPreview]);

    const handleCompare = useCallback(async (showLoading: any = true) => {
        const isAuto = showLoading === false;
        if (isAuto) {
            console.log('[AutoProcess:START]');
            console.log('[AutoProcess:ALLOWED]');
        }

        if (showLoading) {
            setIsLoading(true);
        }
        
        // 🔍 FILTRAGEM RIGOROSA DE TRANSAÇÕES
        // Garante que apenas as transações dos bancos selecionados entrem no pipeline de matching
        const confirmedTransactions = matchResults
            .filter(r => r.isConfirmed)
            .map(r => r.transaction);

        let allTransactions = [
            ...activeBankFiles
                .filter(f => selectedBankIds.includes(String(f.bankId)))
                .flatMap(f => f.processedTransactions || []),
            ...confirmedTransactions
        ];

        if (isAuto) {
            console.log('[AutoProcess:CLEAR_REPORTS]');
            // No modo automático, capturamos as transações da Lista Viva se não houver arquivos ativos
            if (allTransactions.length === 0 && matchResults.length > 0) {
                console.log('[AutoProcess:USING_LIVE_LIST_SOURCE]');
                allTransactions = matchResults.map(r => r.transaction);
            }
            // NÃO limpar dados persistentes
            // apenas resetar estados auxiliares se existirem
            // setReportPreviewData(null);
        }

        if (allTransactions.length === 0) { 
            if (!isAuto) showToast("Selecione pelo menos um extrato com dados.", "error"); 
            if (showLoading) {
                setIsLoading(false); 
            }
            if (isAuto) console.log('[AutoProcess:DONE] No transactions found');
            return; 
        }

        if (isAuto) console.log('[AutoProcess:PROCESSING]');

        // 🔍 FILTRAGEM RIGOROSA DE RESULTADOS EXISTENTES
        // No modo automático, NÃO usamos resultados existentes para forçar re-identificação total
        const filteredExistingResults = isAuto ? matchResults.filter(r => r.isConfirmed) : matchResults.filter(r => 
            selectedBankIds.includes(String(r.transaction.bank_id))
        );

        // 🧬 FUSÃO INTELIGENTE: Executa o matching apenas no escopo selecionado
        const results = matchTransactions(
            allTransactions, 
            contributorFiles, 
            { similarityThreshold: similarityLevel, dayTolerance: dayTolerance }, 
            learnedAssociations, 
            churches, 
            customIgnoreKeywords,
            filteredExistingResults 
        );

        setMatchResults(() => results);
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
        activeBankFiles, selectedBankIds, matchResults, contributorFiles, 
        similarityLevel, dayTolerance, learnedAssociations, churches, 
        customIgnoreKeywords, setMatchResults, setHasActiveSession, 
        setIsLoading, showToast, setReportPreviewData, hasActiveSession
    ]);

    const findMatchResult = useCallback((txId: string) => {
        return matchResults.find(r => r.transaction.id === txId);
    }, [matchResults]);

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

    const updateReportData = useCallback((updatedRow: MatchResult) => {
        setMatchResults(prev => {
            const next = [...prev];
            const idx = next.findIndex(r => r.transaction.id === updatedRow.transaction.id);
            if (idx !== -1) next[idx] = updatedRow;
            else next.push(updatedRow);
            return next;
        });
    }, [setMatchResults]);

    const revertMatch = useCallback((txId: string) => {
        setMatchResults(prev => prev.map(r => r.transaction.id === txId ? { ...r, status: ReconciliationStatus.UNIDENTIFIED, contributor: null, church: PLACEHOLDER_CHURCH } : r));
    }, [setMatchResults]);

    const closeManualIdentify = useCallback(() => { 
        setManualIdentificationTx(null); 
        setBulkIdentificationTxs([]); 
    }, [setManualIdentificationTx, setBulkIdentificationTxs]);

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
