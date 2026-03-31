import { useCallback, useEffect } from 'react';
import { MatchResult, ReconciliationStatus, GroupedReportData } from '../types';
import { matchTransactions, groupResultsByChurch, PLACEHOLDER_CHURCH } from '../services/processingService';

interface UseTransactionMatcherProps {
    subscription: any;
    user: any;
    matchResults: MatchResult[];
    setMatchResults: (results: MatchResult[]) => void;
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
    setHasActiveSession
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

    const handleCompare = useCallback(async () => {
        setIsLoading(true);
        
        // 🔍 FILTRAGEM RIGOROSA DE TRANSAÇÕES
        // Garante que apenas as transações dos bancos selecionados entrem no pipeline de matching
        const allTransactions = activeBankFiles
            .filter(f => selectedBankIds.includes(String(f.bankId)))
            .flatMap(f => f.processedTransactions || []);
        
        if (allTransactions.length === 0) { 
            showToast("Selecione pelo menos um extrato com dados.", "error"); 
            setIsLoading(false); 
            return; 
        }

        // 🔍 FILTRAGEM RIGOROSA DE RESULTADOS EXISTENTES
        // Ao rodar a comparação, preservamos apenas os resultados manuais ou já identificados 
        // que pertençam aos bancos atualmente selecionados.
        const filteredExistingResults = matchResults.filter(r => 
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

        setMatchResults(results);
        setHasActiveSession(true);
        setIsLoading(false);
        showToast("Conciliação concluída para os itens selecionados!", "success");
    }, [
        activeBankFiles, selectedBankIds, matchResults, contributorFiles, 
        similarityLevel, dayTolerance, learnedAssociations, churches, 
        customIgnoreKeywords, setMatchResults, setHasActiveSession, 
        setIsLoading, showToast
    ]);

    return {
        handleCompare,
        regenerateReportPreview
    };
};
