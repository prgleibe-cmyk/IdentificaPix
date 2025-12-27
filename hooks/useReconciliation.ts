
import { useState, useCallback, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';
import { 
    Transaction, 
    Contributor, 
    MatchResult, 
    Church, 
    Bank, 
    FileModel, 
    GroupedReportData, 
    ComparisonType,
    ViewType,
    LearnedAssociation
} from '../types';
import { 
    matchTransactions, 
    groupResultsByChurch, 
    PLACEHOLDER_CHURCH,
    normalizeString,
    processFileContent
} from '../services/processingService';

interface UseReconciliationProps {
    churches: Church[];
    banks: Bank[];
    fileModels: FileModel[];
    similarityLevel: number;
    dayTolerance: number;
    customIgnoreKeywords: string[];
    contributionKeywords: string[];
    learnedAssociations: LearnedAssociation[];
    showToast: (msg: string, type?: 'success' | 'error') => void;
    setIsLoading: (loading: boolean) => void;
    setActiveView: (view: ViewType) => void;
}

export const useReconciliation = ({
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
    
    const [bankStatementFile, setBankStatementFile] = usePersistentState<{ 
        bankId: string, 
        content: string, 
        fileName: string, 
        rawFile?: File,
        processedTransactions?: Transaction[]
    } | null>('identificapix-statement-v7', null, true);

    const [contributorFiles, setContributorFiles] = usePersistentState<{ churchId: string; content: string; fileName: string, contributors?: Contributor[] }[]>('identificapix-contributors-v6', [], true);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>('identificapix-results-v6', [], true);
    const [reportPreviewData, setReportPreviewData] = usePersistentState<{ income: GroupedReportData; expenses: GroupedReportData } | null>('identificapix-report-preview-v6', null, true);
    const [hasActiveSession, setHasActiveSession] = usePersistentState<boolean>('identificapix-has-session-v6', false, false);
    const [comparisonType, setComparisonType] = useState<ComparisonType>('both');
    
    const [pendingTraining, setPendingTraining] = useState<{ content: string; fileName: string; type: 'statement' | 'contributor'; entityId: string, rawFile?: File } | null>(null);

    // Manual Identification State
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [bulkIdentificationTxs, setBulkIdentificationTxs] = useState<Transaction[] | null>(null);
    const [manualMatchState, setManualMatchState] = useState<{ record: MatchResult, suggestions: Transaction[] } | null>(null);
    const [divergenceConfirmation, setDivergenceConfirmation] = useState<MatchResult | null>(null);
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<{ id: string, name: string } | null>(null);

    // --- LÓGICA DE LIMPEZA UNIFICADA ---
    // Combina palavras ignoradas globais com os Tipos de Contribuição.
    // Isso garante que "Dízimo", "Oferta", etc., sejam removidos da coluna NOME,
    // mas a detecção de TIPO (que ocorre no raw description) continua funcionando.
    const cleaningKeywords = useMemo(() => {
        return Array.from(new Set([...customIgnoreKeywords, ...contributionKeywords]));
    }, [customIgnoreKeywords, contributionKeywords]);

    const handleStatementUpload = useCallback((content: string, fileName: string, bankId: string, rawFile: File) => {
        setIsLoading(true);
        try {
            // ESTRATÉGIA DIRETA: Usa a lista combinada para limpar descrições
            const result = processFileContent(content, fileName, fileModels, cleaningKeywords);
            const transactions = result.transactions;

            if (transactions.length > 0) {
                setBankStatementFile({ 
                    bankId, 
                    content, 
                    fileName, 
                    rawFile,
                    processedTransactions: transactions 
                });
                showToast(`Extrato carregado (${result.method}).`, 'success');
            } else {
                showToast("Formato de arquivo não reconhecido pelo sistema automático. Verifique se é um arquivo suportado.", "error");
            }
        } catch (e: any) {
            console.error(e);
            showToast("Erro ao ler o arquivo: " + e.message, "error");
        } finally {
            setIsLoading(false);
        }
    }, [setBankStatementFile, showToast, setIsLoading, fileModels, cleaningKeywords]);

    const handleContributorsUpload = useCallback((content: string, fileName: string, churchId: string, rawFile?: File) => {
        setIsLoading(true);
        try {
            // ESTRATÉGIA DIRETA: Usa a lista combinada para limpar nomes de contribuintes
            const result = processFileContent(content, fileName, fileModels, cleaningKeywords);
            const transactions = result.transactions;

            const contributors: Contributor[] = transactions.map(t => ({
                name: t.description,
                cleanedName: t.cleanedDescription,
                normalizedName: normalizeString(t.description, cleaningKeywords),
                amount: t.amount,
                date: t.date,
                originalAmount: t.originalAmount,
                contributionType: t.contributionType
            }));

            if (contributors.length > 0) {
                setContributorFiles(prev => {
                    const other = prev.filter(f => f.churchId !== churchId);
                    return [...other, { churchId, content, fileName, contributors }];
                });
                showToast(`Lista carregada (${result.method}).`, 'success');
            } else {
                showToast("Formato de lista não reconhecido. Use CSV ou Excel padronizado.", "error");
            }
        } catch (e: any) {
            showToast("Erro ao ler o arquivo: " + e.message, "error");
        } finally {
            setIsLoading(false);
        }
    }, [cleaningKeywords, setContributorFiles, showToast, setIsLoading, fileModels]);

    const handleTrainingSuccess = useCallback((model: FileModel, processedData: Transaction[]) => {
        if (!pendingTraining) return;

        const { type, entityId, content, fileName, rawFile } = pendingTraining;

        if (type === 'statement') {
            setBankStatementFile({ 
                bankId: entityId, 
                content, 
                fileName, 
                rawFile,
                processedTransactions: processedData 
            });
            showToast("Extrato processado e salvo!", "success");
        } else {
            const contributors: Contributor[] = processedData.map(t => ({
                name: t.description,
                cleanedName: t.cleanedDescription,
                normalizedName: normalizeString(t.description, cleaningKeywords),
                amount: t.amount,
                date: t.date,
                originalAmount: t.originalAmount,
                contributionType: t.contributionType
            }));

            setContributorFiles(prev => {
                const other = prev.filter(f => f.churchId !== entityId);
                return [...other, { churchId: entityId, content, fileName, contributors }];
            });
            showToast("Lista de contribuintes salva!", "success");
        }
        
        setPendingTraining(null);
    }, [pendingTraining, cleaningKeywords, setBankStatementFile, setContributorFiles, showToast]);

    const openLabManually = useCallback((targetFile?: { content: string, fileName: string, type: 'statement' | 'contributor', id: string, rawFile?: File }) => {
        if (targetFile) {
            setPendingTraining({
                content: targetFile.content,
                fileName: targetFile.fileName,
                type: targetFile.type,
                entityId: targetFile.id,
                rawFile: targetFile.rawFile
            });
        } else if (bankStatementFile) {
            setPendingTraining({
                content: bankStatementFile.content,
                fileName: bankStatementFile.fileName,
                type: 'statement',
                entityId: bankStatementFile.bankId,
                rawFile: bankStatementFile.rawFile
            });
        } else {
            showToast("Carregue um arquivo primeiro.", "error");
        }
    }, [bankStatementFile, showToast]);

    const removeBankStatementFile = useCallback(() => setBankStatementFile(null), [setBankStatementFile]);
    const removeContributorFile = useCallback((churchId: string) => {
        setContributorFiles(prev => prev.filter(f => f.churchId !== churchId));
    }, [setContributorFiles]);

    // --- RECONCILIATION ENGINE JIT (Just-In-Time) ---
    const handleCompare = useCallback(async () => {
        if (!bankStatementFile) return;
        setIsLoading(true);

        try {
            // 1. REPROCESSAMENTO AUTOMÁTICO DO EXTRATO
            // Reprocessa para aplicar as configurações mais recentes (modelos e keywords)
            const stmtResult = processFileContent(bankStatementFile.content, bankStatementFile.fileName, fileModels, cleaningKeywords);
            const activeTransactions = stmtResult.transactions;

            if (activeTransactions.length === 0) {
                throw new Error("O extrato não gerou transações válidas. Verifique o arquivo.");
            }

            setBankStatementFile(prev => prev ? { ...prev, processedTransactions: activeTransactions } : null);

            let filteredTransactions = activeTransactions;
            if (comparisonType === 'income') filteredTransactions = activeTransactions.filter(t => t.amount > 0);
            else if (comparisonType === 'expenses') filteredTransactions = activeTransactions.filter(t => t.amount < 0);

            // 2. REPROCESSAMENTO AUTOMÁTICO DAS LISTAS DE CONTRIBUINTES
            const contributorData = contributorFiles.map(cf => {
                const church = churches.find(c => c.id === cf.churchId) || PLACEHOLDER_CHURCH;
                
                const listResult = processFileContent(cf.content, cf.fileName, fileModels, cleaningKeywords);
                const currentContributors = listResult.transactions.map(t => ({
                    name: t.description,
                    cleanedName: t.cleanedDescription,
                    normalizedName: normalizeString(t.description, cleaningKeywords),
                    amount: t.amount,
                    date: t.date,
                    originalAmount: t.originalAmount,
                    contributionType: t.contributionType
                }));

                return {
                    church,
                    contributors: currentContributors
                };
            });

            // 3. EXECUTAR O MATCHING
            const results = matchTransactions(
                filteredTransactions, 
                contributorData, 
                { similarityThreshold: similarityLevel, dayTolerance }, 
                learnedAssociations, 
                churches, 
                cleaningKeywords // Usa a lista combinada para matching também
            );

            setMatchResults(results);
            setReportPreviewData({
                // CORREÇÃO: Incluir itens PENDENTE (mesmo com valor 0) no relatório de entradas
                income: groupResultsByChurch(results.filter(r => r.transaction.amount > 0 || r.status === 'PENDENTE')),
                expenses: { 'all_expenses_group': results.filter(r => r.transaction.amount < 0) }
            });
            setHasActiveSession(true);
            setActiveView('reports');
            showToast("Conciliação finalizada!", 'success');

        } catch (e: any) {
            console.error(e);
            showToast(e.message || "Erro ao processar dados.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [bankStatementFile, contributorFiles, churches, similarityLevel, dayTolerance, cleaningKeywords, learnedAssociations, setMatchResults, setReportPreviewData, setHasActiveSession, setActiveView, showToast, setIsLoading, comparisonType, setBankStatementFile, fileModels]);

    const updateReportData = useCallback((updatedRow: MatchResult, reportType: 'income' | 'expenses') => {
        setMatchResults(prev => prev.map(r => r.transaction.id === updatedRow.transaction.id ? updatedRow : r));
        setReportPreviewData(prev => {
            if (!prev) return null;
            const newPreview = JSON.parse(JSON.stringify(prev));
            const targetGroup = reportType === 'expenses' ? newPreview.expenses : newPreview.income;
            
            Object.keys(targetGroup).forEach(key => {
                targetGroup[key] = targetGroup[key].map((r: MatchResult) => r.transaction.id === updatedRow.transaction.id ? updatedRow : r);
            });
            
            if (reportType === 'income') {
                const currentChurchId = updatedRow.church.id || 'unidentified';
                Object.keys(newPreview.income).forEach(key => {
                    newPreview.income[key] = newPreview.income[key].filter((r: MatchResult) => r.transaction.id !== updatedRow.transaction.id);
                });
                if (!newPreview.income[currentChurchId]) newPreview.income[currentChurchId] = [];
                newPreview.income[currentChurchId].push(updatedRow);
            }

            return newPreview;
        });
    }, [setMatchResults, setReportPreviewData]);

    const discardCurrentReport = useCallback(() => {
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false);
        setActiveView('upload');
    }, [setMatchResults, setReportPreviewData, setHasActiveSession, setActiveView]);

    const closeManualIdentify = useCallback(() => {
        setManualIdentificationTx(null);
        setBulkIdentificationTxs(null);
    }, []);

    const openManualMatchModal = useCallback((record: MatchResult) => {
        const suggestions = matchResults.map(r => r.transaction); 
        setManualMatchState({ record, suggestions });
    }, [matchResults]);

    const closeManualMatchModal = useCallback(() => setManualMatchState(null), []);

    const confirmManualAssociation = useCallback((selectedTx: Transaction) => {
        if (!manualMatchState) return;
        const { record } = manualMatchState;
        
        const updatedResult: MatchResult = {
            ...record,
            transaction: selectedTx,
            status: 'IDENTIFICADO',
            matchMethod: 'MANUAL',
            similarity: 100
        };
        updateReportData(updatedResult, 'income');
        closeManualMatchModal();
        showToast("Associação manual confirmada.", "success");
    }, [manualMatchState, updateReportData, closeManualMatchModal, showToast]);

    const openDivergenceModal = useCallback((match: MatchResult) => setDivergenceConfirmation(match), []);
    const closeDivergenceModal = useCallback(() => setDivergenceConfirmation(null), []);
    
    const confirmDivergence = useCallback((divergentMatch: MatchResult) => {
        updateReportData({ ...divergentMatch, status: 'IDENTIFICADO' }, 'income');
        setDivergenceConfirmation(null);
    }, [updateReportData]);

    const rejectDivergence = useCallback((divergentMatch: MatchResult) => {
        if (divergentMatch.divergence?.expectedChurch) {
             const restored: MatchResult = {
                 ...divergentMatch,
                 church: divergentMatch.divergence.expectedChurch,
                 status: 'IDENTIFICADO'
             };
             updateReportData(restored, 'income');
        } else {
             updateReportData({ ...divergentMatch, status: 'NÃO IDENTIFICADO', church: PLACEHOLDER_CHURCH, contributor: null }, 'income');
        }
        setDivergenceConfirmation(null);
    }, [updateReportData]);

    const handleAnalyze = useCallback(async (transactionId: string) => {
        setLoadingAiId(transactionId);
        setTimeout(() => {
            setAiSuggestion({ id: transactionId, name: "Sugestão AI Simulada" });
            setLoadingAiId(null);
        }, 1500);
    }, []);

    return useMemo(() => ({
        bankStatementFile, contributorFiles, matchResults, setMatchResults, reportPreviewData, setReportPreviewData, hasActiveSession, setHasActiveSession,
        pendingTraining, setPendingTraining, comparisonType, setComparisonType,
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile,
        handleCompare, updateReportData, discardCurrentReport, openLabManually,
        handleTrainingSuccess, 
        manualIdentificationTx, setManualIdentificationTx,
        bulkIdentificationTxs, setBulkIdentificationTxs,
        closeManualIdentify,
        manualMatchState, setManualMatchState,
        openManualMatchModal, closeManualMatchModal, confirmManualAssociation,
        divergenceConfirmation, setDivergenceConfirmation,
        openDivergenceModal, closeDivergenceModal, confirmDivergence, rejectDivergence,
        loadingAiId, setLoadingAiId, aiSuggestion, setAiSuggestion, handleAnalyze
    }), [
        bankStatementFile, contributorFiles, matchResults, reportPreviewData, hasActiveSession, pendingTraining, comparisonType, 
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile, handleCompare, updateReportData, discardCurrentReport, openLabManually, handleTrainingSuccess,
        setMatchResults, setReportPreviewData, setHasActiveSession,
        manualIdentificationTx, bulkIdentificationTxs, closeManualIdentify,
        manualMatchState, openManualMatchModal, closeManualMatchModal, confirmManualAssociation,
        divergenceConfirmation, openDivergenceModal, closeDivergenceModal, confirmDivergence, rejectDivergence,
        loadingAiId, aiSuggestion, handleAnalyze
    ]);
};