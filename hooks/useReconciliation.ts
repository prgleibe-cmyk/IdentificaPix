
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
    findMatchingModel,
    PLACEHOLDER_CHURCH,
    parseWithModel,
    isModelSafeToApply,
    normalizeString,
    generateFingerprint
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
    
    const [bankStatementFile, setBankStatementFile] = usePersistentState<{ bankId: string, content: string, fileName: string, rawFile?: File } | null>('identificapix-statement-v6', null, true);
    const [contributorFiles, setContributorFiles] = usePersistentState<{ churchId: string; content: string; fileName: string, contributors?: Contributor[] }[]>('identificapix-contributors-v6', [], true);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>('identificapix-results-v6', [], true);
    const [reportPreviewData, setReportPreviewData] = usePersistentState<{ income: GroupedReportData; expenses: GroupedReportData } | null>('identificapix-report-preview-v6', null, true);
    const [hasActiveSession, setHasActiveSession] = usePersistentState<boolean>('identificapix-has-session-v6', false, false);
    const [comparisonType, setComparisonType] = useState<ComparisonType>('both');
    
    // Pending Training agora guarda o contexto de onde veio o arquivo (qual banco ou qual igreja)
    const [pendingTraining, setPendingTraining] = useState<{ content: string; fileName: string; type: 'statement' | 'contributor'; entityId: string, rawFile?: File } | null>(null);

    // Manual Identification State
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [bulkIdentificationTxs, setBulkIdentificationTxs] = useState<Transaction[] | null>(null);
    const [manualMatchState, setManualMatchState] = useState<{ record: MatchResult, suggestions: Transaction[] } | null>(null);
    const [divergenceConfirmation, setDivergenceConfirmation] = useState<MatchResult | null>(null);
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<{ id: string, name: string } | null>(null);

    // Lógica Central de Upload de Extrato
    const handleStatementUpload = useCallback((content: string, fileName: string, bankId: string, rawFile: File) => {
        setIsLoading(true);
        try {
            const matchedModel = findMatchingModel(content, fileModels);

            if (matchedModel) {
                const safety = isModelSafeToApply(content, matchedModel);
                if (safety.safe) {
                    // Modelo encontrado e seguro: Processa silenciosamente
                    setBankStatementFile({ bankId, content, fileName, rawFile });
                    showToast(`Extrato padronizado automaticamente (Modelo v${matchedModel.version}).`, 'success');
                } else {
                    // Modelo existe mas a estrutura mudou: Re-treinar
                    setPendingTraining({ content, fileName, type: 'statement', entityId: bankId, rawFile });
                    showToast("O layout deste banco mudou. Abrindo laboratório para ajuste.", "error");
                }
            } else {
                // Modelo desconhecido: Treinar obrigatoriamente
                setPendingTraining({ content, fileName, type: 'statement', entityId: bankId, rawFile });
                showToast("Novo layout de extrato detectado. Abrindo laboratório...", "success");
            }
        } catch (e) {
            showToast("Erro ao ler o arquivo.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [fileModels, setBankStatementFile, showToast, setIsLoading]);

    // Lógica Central de Upload de Lista de Contribuintes
    const handleContributorsUpload = useCallback((content: string, fileName: string, churchId: string, rawFile?: File) => {
        setIsLoading(true);
        try {
            const matchedModel = findMatchingModel(content, fileModels);

            if (matchedModel) {
                const safety = isModelSafeToApply(content, matchedModel);
                if (safety.safe) {
                    // Modelo encontrado: Processa silenciosamente e JÁ EXTRAI os contribuintes
                    const transactions = parseWithModel(content, matchedModel, customIgnoreKeywords);
                    const contributors: Contributor[] = transactions.map(t => ({
                        name: t.description,
                        cleanedName: t.cleanedDescription,
                        normalizedName: normalizeString(t.description, customIgnoreKeywords),
                        amount: t.amount,
                        date: t.date,
                        originalAmount: t.originalAmount,
                        contributionType: t.contributionType
                    }));

                    setContributorFiles(prev => {
                        const other = prev.filter(f => f.churchId !== churchId);
                        return [...other, { churchId, content, fileName, contributors }];
                    });
                    showToast(`Lista padronizada automaticamente (Modelo v${matchedModel.version}).`, 'success');
                } else {
                    setPendingTraining({ content, fileName, type: 'contributor', entityId: churchId, rawFile });
                    showToast("O layout desta lista mudou. Abrindo laboratório.", "error");
                }
            } else {
                setPendingTraining({ content, fileName, type: 'contributor', entityId: churchId, rawFile });
                showToast("Novo layout de lista detectado. Abrindo laboratório...", "success");
            }
        } catch (e) {
            showToast("Erro ao ler o arquivo.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [fileModels, customIgnoreKeywords, setContributorFiles, showToast, setIsLoading]);

    // Callback chamado quando o Laboratório termina com sucesso (Salva o modelo E aplica os dados)
    const handleTrainingSuccess = useCallback((model: FileModel, processedData: Transaction[]) => {
        if (!pendingTraining) return;

        const { type, entityId, content, fileName, rawFile } = pendingTraining;

        if (type === 'statement') {
            setBankStatementFile({ bankId: entityId, content, fileName, rawFile });
            showToast("Modelo aprendido! Extrato processado e salvo.", "success");
        } else {
            // Converte as transações geradas pelo laboratório em Contribuintes
            const contributors: Contributor[] = processedData.map(t => ({
                name: t.description,
                cleanedName: t.cleanedDescription,
                normalizedName: normalizeString(t.description, customIgnoreKeywords),
                amount: t.amount,
                date: t.date,
                originalAmount: t.originalAmount,
                contributionType: t.contributionType
            }));

            setContributorFiles(prev => {
                const other = prev.filter(f => f.churchId !== entityId);
                return [...other, { churchId: entityId, content, fileName, contributors }];
            });
            showToast("Modelo aprendido! Lista de contribuintes processada.", "success");
        }
        
        setPendingTraining(null);
    }, [pendingTraining, customIgnoreKeywords, setBankStatementFile, setContributorFiles, showToast]);

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

    const handleCompare = useCallback(async () => {
        if (!bankStatementFile) return;
        setIsLoading(true);

        try {
            // Processa o Extrato (busca modelo novamente para garantir, ou usa o parseWithModel se tiver cache)
            let transactions: Transaction[] = [];
            const stmtModel = findMatchingModel(bankStatementFile.content, fileModels);
            
            if (stmtModel) {
                transactions = parseWithModel(bankStatementFile.content, stmtModel, customIgnoreKeywords);
            } else {
                // Fallback de segurança extremo (não deveria acontecer no novo fluxo)
                throw new Error("Modelo do extrato não encontrado. Por favor, reabra o laboratório.");
            }

            if (comparisonType === 'income') transactions = transactions.filter(t => t.amount > 0);
            else if (comparisonType === 'expenses') transactions = transactions.filter(t => t.amount < 0);

            // Prepara os dados dos contribuintes
            // Agora contributorFiles JÁ TEM os contributors processados corretamente pelo handleTrainingSuccess ou handleContributorsUpload
            const contributorData = contributorFiles.map(cf => {
                const church = churches.find(c => c.id === cf.churchId) || PLACEHOLDER_CHURCH;
                
                // Se por algum motivo os contributors não estiverem cacheados, tenta processar na hora (Resiliência)
                let contributors = cf.contributors;
                if (!contributors || contributors.length === 0) {
                    const model = findMatchingModel(cf.content, fileModels);
                    if (model) {
                        const txs = parseWithModel(cf.content, model, customIgnoreKeywords);
                        contributors = txs.map(t => ({
                            name: t.description,
                            cleanedName: t.cleanedDescription,
                            normalizedName: normalizeString(t.description, customIgnoreKeywords),
                            amount: t.amount,
                            date: t.date,
                            originalAmount: t.originalAmount,
                            contributionType: t.contributionType
                        }));
                    } else {
                         // Se chegou aqui, algo grave aconteceu no fluxo de upload.
                         // Ignoramos este arquivo para não quebrar tudo.
                         contributors = [];
                    }
                }

                return {
                    church,
                    contributors: contributors || []
                };
            });

            const results = matchTransactions(transactions, contributorData, { similarityThreshold: similarityLevel, dayTolerance }, learnedAssociations, churches, customIgnoreKeywords);

            setMatchResults(results);
            setReportPreviewData({
                income: groupResultsByChurch(results.filter(r => r.transaction.amount > 0)),
                expenses: { 'all_expenses_group': results.filter(r => r.transaction.amount < 0) }
            });
            setHasActiveSession(true);
            setActiveView('reports');
            showToast("Conciliação finalizada!");
        } catch (e: any) {
            showToast(e.message || "Erro ao processar dados.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [bankStatementFile, contributorFiles, churches, fileModels, similarityLevel, dayTolerance, customIgnoreKeywords, contributionKeywords, learnedAssociations, setMatchResults, setReportPreviewData, setHasActiveSession, setActiveView, showToast, setIsLoading, comparisonType]);

    // ... (rest of the hook remains the same: updateReportData, discardCurrentReport, manual handlers, etc.)
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
        handleTrainingSuccess, // Exportado para o Modal usar
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
