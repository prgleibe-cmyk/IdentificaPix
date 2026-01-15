
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
    GroupedReportData
} from '../types';
import { 
    processFileContent, 
    parseContributors, 
    matchTransactions, 
    groupResultsByChurch,
    PLACEHOLDER_CHURCH
} from '../services/processingService';
import { getAISuggestion } from '../services/geminiService';
import { consolidationService } from '../services/ConsolidationService';

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

    // --- State ---
    const [activeBankFiles, setBankStatementFile] = useState<any[]>([]);
    const [contributorFiles, setContributorFiles] = useState<ContributorFile[]>([]);
    const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
    
    const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
    const [reportPreviewData, setReportPreviewData] = useState<{ income: GroupedReportData; expenses: GroupedReportData } | null>(null);
    const [activeReportId, setActiveReportId] = useState<string | null>(null);
    const [hasActiveSession, setHasActiveSession] = useState(false);
    
    const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
    
    // UI State for Modals
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [bulkIdentificationTxs, setBulkIdentificationTxs] = useState<Transaction[] | null>(null);
    const [divergenceConfirmation, setDivergenceConfirmation] = useState<{ transaction: Transaction; contributor: Contributor; divergence: any } | null>(null);
    const [manualMatchState, setManualMatchState] = useState<{ record: MatchResult; suggestions: MatchResult[] } | null>(null);
    
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<{ id: string; name: string } | null>(null);
    const [pendingTraining, setPendingTraining] = useState<any | null>(null);
    const [isRecompareModalOpen, setIsRecompareModalOpen] = useState(false);

    // --- File Handling ---
    const handleStatementUpload = useCallback((content: string, fileName: string, bankId: string, rawFile?: File) => {
        setIsLoading(true);
        try {
            const result = processFileContent(content, fileName, fileModels, customIgnoreKeywords);
            const processedTransactions = result.transactions;

            if (processedTransactions.length === 0) {
                showToast("Nenhuma transação encontrada no arquivo.", "error");
                setIsLoading(false);
                return;
            }

            setBankStatementFile(prev => {
                const filtered = prev.filter(f => f.bankId !== bankId);
                return [...filtered, {
                    bankId,
                    content,
                    fileName,
                    rawFile,
                    processedTransactions
                }];
            });
            
            if (!selectedBankIds.includes(bankId)) {
                setSelectedBankIds(prev => [...prev, bankId]);
            }

            showToast("Extrato carregado com sucesso.", "success");
        } catch (error: any) {
            console.error(error);
            showToast("Erro ao processar extrato.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [fileModels, customIgnoreKeywords, selectedBankIds, showToast, setIsLoading]);

    const removeBankStatementFile = useCallback((bankId: string) => {
        setBankStatementFile(prev => prev.filter(f => f.bankId !== bankId));
        setSelectedBankIds(prev => prev.filter(id => id !== bankId));
    }, []);

    const handleContributorsUpload = useCallback((content: string, fileName: string, churchId: string, rawFile?: File) => {
        setIsLoading(true);
        setTimeout(() => {
            try {
                const contributors = parseContributors(content, customIgnoreKeywords, contributionKeywords);
                if (contributors.length === 0) {
                    showToast("Nenhum contribuinte encontrado.", "error");
                    setIsLoading(false);
                    return;
                }
                
                const church = churches.find(c => c.id === churchId);
                if (church) {
                    const newFile: ContributorFile = { church, contributors, fileName, churchId };
                    setContributorFiles(prev => {
                        const filtered = prev.filter(f => f.churchId !== churchId);
                        return [...filtered, newFile];
                    });
                    showToast("Lista de membros carregada.", "success");
                }
            } catch (error) {
                console.error(error);
                showToast("Erro ao processar lista.", "error");
            } finally {
                setIsLoading(false);
            }
        }, 100);
    }, [churches, customIgnoreKeywords, contributionKeywords, showToast, setIsLoading]);

    const removeContributorFile = useCallback((churchId: string) => {
        setContributorFiles(prev => prev.filter(f => f.churchId !== churchId));
    }, []);

    const clearFiles = useCallback(() => {
        setBankStatementFile([]);
        setContributorFiles([]);
        setSelectedBankIds([]);
    }, []);

    const toggleBankSelection = useCallback((bankId: string) => {
        setSelectedBankIds(prev => {
            if (prev.includes(bankId)) return prev.filter(id => id !== bankId);
            return [...prev, bankId];
        });
    }, []);

    // --- Core Logic: REGENERATE PREVIEW ---
    // Esta função é o coração da Fase 2 e 3. Ela transforma a lista plana (matchResults)
    // na estrutura agrupada que a UI consome, sem patches manuais.
    const regenerateReportPreview = useCallback((results: MatchResult[]) => {
        // Separação Lógica Base (CORRIGIDO: Inclui valores 0 para não ocultar nada)
        // Entradas (Income): Valor >= 0 OU Fantasmas (Pendentes)
        const incomeResults = results.filter(r => r.transaction.amount >= 0 || r.status === 'PENDENTE');
        
        // Saídas (Expenses): Valor < 0 (Estritamente negativo)
        // Nota: Se houver um fantasma com valor negativo, ele iria para cima por ser PENDENTE, 
        // mas fantasmas de listas geralmente são positivos.
        const expenseResults = results.filter(r => r.transaction.amount < 0 && r.status !== 'PENDENTE');

        setReportPreviewData({
            income: groupResultsByChurch(incomeResults),
            expenses: { 'all_expenses_group': expenseResults }
        });
    }, []);

    // --- Reconciliation Logic ---
    const handleCompare = useCallback(async () => {
        if (activeBankFiles.length === 0 && !activeReportId) {
            showToast("Carregue pelo menos um extrato bancário.", "error");
            return;
        }

        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            let allTransactions: Transaction[] = [];

            if (activeReportId && matchResults.length > 0) {
                allTransactions = matchResults.map(r => r.transaction);
            } else {
                const selectedFiles = activeBankFiles.filter(f => selectedBankIds.includes(f.bankId));
                allTransactions = selectedFiles.flatMap(f => f.processedTransactions || []);
            }

            if (allTransactions.length === 0) {
                showToast("Nenhuma transação para processar.", "error");
                setIsLoading(false);
                return;
            }

            const results = matchTransactions(
                allTransactions,
                contributorFiles,
                { similarityThreshold: similarityLevel, dayTolerance },
                learnedAssociations,
                churches,
                customIgnoreKeywords
            );

            setMatchResults(results);
            regenerateReportPreview(results); // Gera a visualização baseada na nova lista

            setHasActiveSession(true);
            
            if (!activeReportId) {
                setActiveView('reports');
            }
            showToast("Conciliação concluída!", "success");

        } catch (error) {
            console.error("Reconciliation error:", error);
            showToast("Erro durante a conciliação.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [activeBankFiles, selectedBankIds, contributorFiles, similarityLevel, dayTolerance, learnedAssociations, churches, customIgnoreKeywords, activeReportId, matchResults, showToast, setIsLoading, setActiveView, regenerateReportPreview]);

    // --- Report Management ---

    // AÇÃO ATÔMICA 1: ATUALIZAR / IDENTIFICAR
    // Atualiza o estado da transação e limpa fantasmas correspondentes automaticamente
    const updateReportData = useCallback((updatedRow: MatchResult) => {
        setMatchResults(prevResults => {
            const next = [...prevResults];
            
            // 1. Encontra e Atualiza a linha alvo
            const index = next.findIndex(r => r.transaction.id === updatedRow.transaction.id);
            if (index !== -1) {
                next[index] = updatedRow;
            } else if (updatedRow.status === 'PENDENTE') {
                // Caso especial: Adição de novo item (ex: criação manual)
                next.push(updatedRow);
            }

            // 2. Limpeza de Fantasmas (Efeito Colateral da Identificação)
            // Se a transação foi associada a um contribuinte da lista, o item pendente correspondente deve sumir
            if (updatedRow.status === 'IDENTIFICADO' && updatedRow.contributor?._internalId) {
                const ghostId = `ghost-${updatedRow.contributor._internalId}`;
                // Encontra e remove o fantasma atomicamente
                const ghostIndex = next.findIndex(r => r.transaction.id === ghostId);
                if (ghostIndex !== -1) {
                    next.splice(ghostIndex, 1);
                }
            }

            regenerateReportPreview(next);
            return next;
        });
    }, [regenerateReportPreview]);

    // AÇÃO ATÔMICA 2: REMOVER (EXCLUSÃO)
    // Usada para excluir linhas (reais ou fantasmas) do relatório
    const removeTransaction = useCallback((transactionId: string) => {
        setMatchResults(prevResults => {
            const next = prevResults.filter(r => r.transaction.id !== transactionId);
            regenerateReportPreview(next);
            return next;
        });
    }, [regenerateReportPreview]);

    // AÇÃO ATÔMICA 3: REVERTER (DESFAZER MATCH)
    // Restaura a transação para não identificado e recria o fantasma se necessário
    const revertMatch = useCallback((transactionId: string) => {
        setMatchResults(prev => {
            const next = [...prev];
            const index = next.findIndex(r => r.transaction.id === transactionId);
            
            if (index === -1) return prev;

            const originalResult = next[index];
            const oldContributor = originalResult.contributor;

            // 1. Reset da Transação para estado limpo
            next[index] = {
                ...originalResult,
                status: 'NÃO IDENTIFICADO',
                church: PLACEHOLDER_CHURCH,
                contributor: null,
                matchMethod: undefined,
                similarity: 0,
                divergence: undefined
            };

            // 2. Restauração do Fantasma (Se necessário)
            if (oldContributor && oldContributor._internalId) {
                // Verifica se o fantasma já existe para não duplicar
                const ghostId = `ghost-${oldContributor._internalId}`;
                const exists = next.some(r => r.transaction.id === ghostId);
                
                if (!exists) {
                    const ghost: MatchResult = {
                        transaction: {
                            id: ghostId,
                            date: oldContributor.date || new Date().toISOString().split('T')[0],
                            description: oldContributor.name,
                            rawDescription: oldContributor.name,
                            amount: 0,
                            cleanedDescription: oldContributor.name,
                            contributionType: oldContributor.contributionType,
                            originalAmount: "0.00"
                        },
                        contributor: oldContributor,
                        status: 'PENDENTE',
                        church: (oldContributor as any).church || PLACEHOLDER_CHURCH,
                        matchMethod: 'MANUAL',
                        similarity: 0,
                        contributorAmount: oldContributor.amount,
                        contributionType: oldContributor.contributionType,
                        _injectedId: oldContributor._internalId
                    };
                    next.push(ghost);
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
        if (user) {
             try {
                 await consolidationService.deletePendingTransactions(user.id);
             } catch (e) { console.error("Error clearing DB", e); }
        }
        showToast("Nova conciliação iniciada.", "success");
        setActiveView('upload');
    }, [user, showToast, setActiveView]);

    const importGmailTransactions = useCallback((transactions: Transaction[]) => {
        const virtualFile = {
            bankId: 'gmail-import',
            content: '',
            fileName: `Gmail Import - ${new Date().toLocaleDateString()}`,
            processedTransactions: transactions
        };
        setBankStatementFile(prev => [...prev, virtualFile]);
        setSelectedBankIds(prev => prev.includes('gmail-import') ? prev : [...prev, 'gmail-import']);
    }, []);

    // --- Identification Actions ---

    const closeManualIdentify = useCallback(() => {
        setManualIdentificationTx(null);
        setBulkIdentificationTxs(null);
    }, []);

    const handleAnalyze = useCallback(async (transaction: Transaction, contributors: Contributor[]) => {
        setLoadingAiId(transaction.id);
        try {
            const suggestionName = await getAISuggestion(transaction, contributors);
            setAiSuggestion({ id: transaction.id, name: suggestionName });
        } catch (e) {
            console.error("AI Analysis failed", e);
        } finally {
            setLoadingAiId(null);
        }
    }, []);

    // --- Modal Management ---
    
    const openDivergenceModal = useCallback((result: MatchResult) => {
        if (result.divergence) {
            setDivergenceConfirmation({
                transaction: result.transaction,
                contributor: result.contributor!,
                divergence: result.divergence
            });
        }
    }, []);

    const closeDivergenceModal = useCallback(() => setDivergenceConfirmation(null), []);

    const confirmDivergence = useCallback((data: any) => {
        const result = matchResults.find(r => r.transaction.id === data.transaction.id);
        if (result) {
            const updated: MatchResult = {
                ...result,
                status: 'IDENTIFICADO',
                divergence: undefined
            };
            updateReportData(updated);
        }
        closeDivergenceModal();
        showToast("Divergência confirmada.", "success");
    }, [matchResults, updateReportData, closeDivergenceModal, showToast]);

    const rejectDivergence = useCallback((data: any) => {
        closeDivergenceModal();
    }, [closeDivergenceModal]);

    const closeManualMatchModal = useCallback(() => setManualMatchState(null), []);
    
    const confirmManualAssociation = useCallback((match: MatchResult) => {
        if (manualMatchState) {
            // Usa updateReportData que agora limpa fantasmas automaticamente
            updateReportData(match);
            closeManualMatchModal();
            showToast("Associação manual confirmada.", "success");
        }
    }, [manualMatchState, updateReportData, closeManualMatchModal, showToast]);

    const handleTrainingSuccess = useCallback((model: FileModel, data: Transaction[]) => {
        setPendingTraining(null);
        showToast("Modelo treinado com sucesso!", "success");
    }, [showToast]);

    const closeRecompareModal = useCallback(() => setIsRecompareModalOpen(false), []);

    const isCompareDisabled = activeBankFiles.length === 0 && !activeReportId;

    return {
        activeBankFiles,
        contributorFiles,
        matchResults,
        reportPreviewData,
        activeReportId,
        setActiveReportId,
        hasActiveSession,
        setHasActiveSession,
        comparisonType,
        setComparisonType,
        loadingAiId,
        aiSuggestion,
        manualIdentificationTx,
        setManualIdentificationTx,
        bulkIdentificationTxs,
        setBulkIdentificationTxs,
        divergenceConfirmation,
        manualMatchState,
        pendingTraining,
        setPendingTraining,
        selectedBankIds,
        isRecompareModalOpen,
        setIsRecompareModalOpen,
        isCompareDisabled,
        handleStatementUpload,
        handleContributorsUpload,
        removeBankStatementFile,
        removeContributorFile,
        clearFiles,
        toggleBankSelection,
        setBankStatementFile,
        handleCompare,
        resetReconciliation,
        importGmailTransactions,
        revertMatch,
        removeTransaction,
        closeManualIdentify,
        handleAnalyze,
        updateReportData,
        setMatchResults,
        setReportPreviewData,
        openDivergenceModal,
        closeDivergenceModal,
        confirmDivergence,
        rejectDivergence,
        closeManualMatchModal,
        confirmManualAssociation,
        handleTrainingSuccess,
        closeRecompareModal
    };
};
