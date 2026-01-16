
import { useState, useCallback } from 'react';
import { 
    MatchResult, 
    Transaction, 
    Contributor, 
    Church, 
    Bank, 
    FileModel, 
    ComparisonType,
    ContributorFile,
    GroupedReportData,
    ReconciliationStatus
} from '../types';
import { 
    processFileContent, 
    parseContributors, 
    matchTransactions, 
    groupResultsByChurch,
    PLACEHOLDER_CHURCH
} from '../services/processingService';
import { getAISuggestion } from '../services/geminiService';
import { useLiveListSync } from './useLiveListSync';

interface UseReconciliationProps {
    user: any;
    churches: Church[];
    banks: Bank[];
    fileModels: FileModel[];
    similarityLevel: number;
    dayTolerance: number;
    customIgnoreKeywords: string[];
    contributionKeywords: string[];
    learnedAssociations: any[];
    showToast: (msg: string, type: 'success' | 'error') => void;
    setIsLoading: (loading: boolean) => void;
    setActiveView: (view: any) => void;
}

export const useReconciliation = ({
    user,
    churches,
    banks,
    fileModels,
    similarityLevel,
    dayTolerance,
    customIgnoreKeywords,
    contributionKeywords,
    learnedAssociations,
    showToast,
    setIsLoading,
    setActiveView
}: UseReconciliationProps) => {

    // --- Core State ---
    const [activeBankFiles, setBankStatementFile] = useState<any[]>([]);
    const [contributorFiles, setContributorFiles] = useState<ContributorFile[]>([]);
    const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
    const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
    const [reportPreviewData, setReportPreviewData] = useState<{ income: GroupedReportData; expenses: GroupedReportData } | null>(null);
    const [activeReportId, setActiveReportId] = useState<string | null>(null);
    const [hasActiveSession, setHasActiveSession] = useState(false);
    const [comparisonType, setComparisonType] = useState<ComparisonType>('income');

    // --- Manual Identification State ---
    /* Added to fix AppContext error: setManualIdentificationTx */
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [bulkIdentificationTxs, setBulkIdentificationTxs] = useState<Transaction[]>([]);

    // --- Sub-Estados de UI ---
    const [uiFeedback, setUiFeedback] = useState({
        loadingAiId: null as string | null,
        aiSuggestion: null as { id: string; name: string } | null,
        isRecompareModalOpen: false,
        pendingTraining: null as any | null
    });

    // --- Modularized Persistence ---
    const { persistTransactions, clearRemoteList } = useLiveListSync({
        user,
        setBankStatementFile,
        setSelectedBankIds,
        showToast
    });

    // --- Internal Logic: Regeneration ---
    const regenerateReportPreview = useCallback((results: MatchResult[]) => {
        const uniqueMap = new Map<string, MatchResult>();
        results.forEach(r => uniqueMap.set(r.transaction.id, r));
        const uniqueResults = Array.from(uniqueMap.values());

        const incomeResults = uniqueResults.filter(r => 
            r.transaction.amount >= 0 || 
            r.status === ReconciliationStatus.PENDING
        );
        
        const expenseResults = uniqueResults.filter(r => 
            r.transaction.amount < 0 && 
            r.status !== ReconciliationStatus.PENDING
        );

        setReportPreviewData({
            income: groupResultsByChurch(incomeResults),
            expenses: { 'all_expenses_group': expenseResults }
        });
    }, []);

    // --- File Handlers ---
    const handleStatementUpload = useCallback(async (content: string, fileName: string, bankId: string, rawFile?: File) => {
        setIsLoading(true);
        try {
            const result = processFileContent(content, fileName, fileModels, customIgnoreKeywords);
            const processedTransactions = result.transactions;

            if (processedTransactions.length === 0) {
                showToast("Nenhuma transação encontrada.", "error");
                return;
            }

            await persistTransactions(bankId, processedTransactions);

            setBankStatementFile(prev => {
                const filtered = prev.filter(f => f.bankId !== bankId);
                return [...filtered, { bankId, content, fileName, rawFile, processedTransactions }];
            });
            
            setSelectedBankIds(prev => prev.includes(bankId) ? prev : [...prev, bankId]);
            showToast("Extrato carregado com sucesso.", "success");
        } catch (error: any) {
            showToast("Erro ao processar extrato.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [fileModels, customIgnoreKeywords, persistTransactions, showToast, setIsLoading]);

    /* Added to fix AppContext error: importGmailTransactions */
    const importGmailTransactions = useCallback(async (transactions: Transaction[]) => {
        if (!user || transactions.length === 0) return;
        
        const bankId = 'gmail-sync';
        await persistTransactions(bankId, transactions);

        setBankStatementFile(prev => [
            ...prev.filter(f => f.bankId !== bankId),
            { 
                bankId, 
                fileName: 'Gmail Import', 
                processedTransactions: transactions,
                content: '' 
            }
        ]);
        setSelectedBankIds(prev => prev.includes(bankId) ? prev : [...prev, bankId]);
        showToast("Transações do Gmail importadas.", "success");
    }, [user, persistTransactions, showToast]);

    const removeBankStatementFile = useCallback((bankId: string) => {
        setBankStatementFile(prev => prev.filter(f => f.bankId !== bankId));
        setSelectedBankIds(prev => prev.filter(id => id !== bankId));
        clearRemoteList(bankId);
    }, [clearRemoteList]);

    const handleContributorsUpload = useCallback((content: string, fileName: string, churchId: string) => {
        setIsLoading(true);
        try {
            const contributors = parseContributors(content, customIgnoreKeywords, contributionKeywords);
            const church = churches.find(c => c.id === churchId);
            if (contributors.length > 0 && church) {
                setContributorFiles(prev => [...prev.filter(f => f.churchId !== churchId), { church, contributors, fileName, churchId }]);
                showToast("Lista carregada.", "success");
            }
        } catch (error) {
            showToast("Erro ao processar lista.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [churches, customIgnoreKeywords, contributionKeywords, showToast, setIsLoading]);

    const removeContributorFile = useCallback((churchId: string) => {
        setContributorFiles(prev => prev.filter(f => f.churchId !== churchId));
        showToast("Lista removida.", "success");
    }, [showToast]);

    const toggleBankSelection = useCallback((bankId: string) => {
        setSelectedBankIds(prev => 
            prev.includes(bankId) ? prev.filter(id => id !== bankId) : [...prev, bankId]
        );
    }, []);

    // --- Calculation Engine ---
    // ATUALIZADO: Agora respeita explicitamente os parâmetros passados pelo formulário de configuração
    const handleCompare = useCallback(async (
        overrideType?: ComparisonType, 
        overrideSimilarity?: number, 
        overrideTolerance?: number
    ) => {
        setIsLoading(true);
        try {
            const selectedFiles = activeBankFiles.filter(f => selectedBankIds.includes(f.bankId));
            const allTransactions = activeReportId ? matchResults.map(r => r.transaction) : selectedFiles.flatMap(f => f.processedTransactions || []);

            if (allTransactions.length === 0 && !activeReportId) {
                showToast("Sem dados para processar.", "error");
                setIsLoading(false);
                return;
            }

            // Usa os valores passados pelo modal, ou os valores globais do contexto
            const finalType = overrideType || comparisonType;
            const finalSimilarity = overrideSimilarity !== undefined ? overrideSimilarity : similarityLevel;
            const finalTolerance = overrideTolerance !== undefined ? overrideTolerance : dayTolerance;

            let transactionsToMatch = [...allTransactions];
            
            // Filtro por tipo de análise (Entradas/Saídas/Ambos)
            if (finalType === 'income') {
                transactionsToMatch = transactionsToMatch.filter(tx => tx.amount >= 0);
            } else if (finalType === 'expenses') {
                transactionsToMatch = transactionsToMatch.filter(tx => tx.amount < 0);
            }

            const results = matchTransactions(
                transactionsToMatch,
                contributorFiles,
                { similarityThreshold: finalSimilarity, dayTolerance: finalTolerance },
                learnedAssociations,
                churches,
                customIgnoreKeywords
            );

            setMatchResults(results);
            regenerateReportPreview(results);
            setHasActiveSession(true);
            if (!activeReportId) setActiveView('reports');
            showToast("Conciliação concluída!", "success");
        } catch (error) {
            console.error("Erro na conciliação:", error);
            showToast("Erro na conciliação.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [activeBankFiles, selectedBankIds, contributorFiles, similarityLevel, dayTolerance, comparisonType, learnedAssociations, churches, customIgnoreKeywords, activeReportId, matchResults, showToast, setIsLoading, setActiveView, regenerateReportPreview]);

    // --- Atomic Actions ---
    const updateReportData = useCallback((updatedRow: MatchResult) => {
        setMatchResults(prev => {
            const next = [...prev];
            const index = next.findIndex(r => r.transaction.id === updatedRow.transaction.id);
            
            if (index !== -1) {
                next[index] = updatedRow;
            } else {
                next.push(updatedRow);
            }

            if (updatedRow.status === ReconciliationStatus.IDENTIFIED && updatedRow.contributor?._internalId) {
                const ghostId = `ghost-${updatedRow.contributor._internalId}`;
                const gIdx = next.findIndex(r => r.transaction.id === ghostId && r.status === ReconciliationStatus.PENDING);
                if (gIdx !== -1) next.splice(gIdx, 1);
            }
            
            regenerateReportPreview(next);
            return next;
        });
    }, [regenerateReportPreview]);

    const revertMatch = useCallback((txId: string) => {
        setMatchResults(prev => {
            const next = [...prev];
            const idx = next.findIndex(r => r.transaction.id === txId);
            if (idx === -1) return prev;

            const old = next[idx];
            
            next[idx] = { 
                ...old, 
                status: ReconciliationStatus.UNIDENTIFIED, 
                church: PLACEHOLDER_CHURCH, 
                contributor: null, 
                matchMethod: undefined, 
                similarity: 0,
                contributorAmount: undefined
            };

            if (old.contributor?._internalId) {
                const gId = `ghost-${old.contributor._internalId}`;
                if (!next.some(r => r.transaction.id === gId)) {
                    next.push({
                        transaction: { 
                            id: gId, 
                            date: old.contributor.date || new Date().toISOString().split('T')[0], 
                            description: old.contributor.name, 
                            rawDescription: old.contributor.name, 
                            amount: 0, 
                            cleanedDescription: old.contributor.cleanedName || old.contributor.name, 
                            contributionType: old.contributor.contributionType, 
                            originalAmount: old.contributor.originalAmount || "0.00" 
                        },
                        contributor: old.contributor, 
                        status: ReconciliationStatus.PENDING, 
                        church: old.church, 
                        matchMethod: undefined, 
                        similarity: 0, 
                        contributorAmount: old.contributor.amount 
                    });
                }
            }
            regenerateReportPreview(next);
            return next;
        });
    }, [regenerateReportPreview]);

    const resetReconciliation = useCallback(async () => {
        setMatchResults([]);
        setReportPreviewData(null);
        setActiveReportId(null);
        setHasActiveSession(false);
        setBankStatementFile([]);
        setContributorFiles([]);
        setSelectedBankIds([]);
        await clearRemoteList();
        showToast("Sistema resetado.", "success");
        setActiveView('upload');
    }, [clearRemoteList, showToast, setActiveView]);

    const handleAnalyze = useCallback(async (tx: Transaction, contributors: Contributor[]) => {
        setUiFeedback(prev => ({ ...prev, loadingAiId: tx.id }));
        try {
            const name = await getAISuggestion(tx, contributors);
            setUiFeedback(prev => ({ ...prev, aiSuggestion: { id: tx.id, name }, loadingAiId: null }));
        } catch (e) {
            setUiFeedback(prev => ({ ...prev, loadingAiId: null }));
        }
    }, []);

    return {
        activeBankFiles, contributorFiles, matchResults, reportPreviewData,
        activeReportId, setActiveReportId, hasActiveSession, setHasActiveSession,
        comparisonType, setComparisonType, selectedBankIds,
        manualIdentificationTx, setManualIdentificationTx,
        bulkIdentificationTxs, setBulkIdentificationTxs,
        importGmailTransactions,
        ...uiFeedback,
        setUiFeedback,
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile,
        removeContributorFile, toggleBankSelection, handleCompare, resetReconciliation,
        revertMatch, updateReportData, handleAnalyze, setMatchResults, setReportPreviewData,
        setBankStatementFile,
        closeManualIdentify: () => {
            setManualIdentificationTx(null);
            setBulkIdentificationTxs([]);
        },
        findMatchResult: (id: string) => matchResults.find(r => r.transaction.id === id),
        removeTransaction: (id: string) => {
            setMatchResults(prev => {
                const next = prev.filter(r => r.transaction.id !== id);
                regenerateReportPreview(next);
                return next;
            });
        }
    };
};
