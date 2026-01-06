
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
import { User } from '@supabase/supabase-js';

interface UseReconciliationProps {
    user: User | null; // Adicionado User
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
    
    // Cria um sufixo único baseado no ID do usuário para isolar os dados no LocalStorage/IndexedDB
    const userSuffix = user ? `-${user.id}` : '-guest';

    const [bankStatementFile, setBankStatementFile] = usePersistentState<{ 
        bankId: string, 
        content: string, 
        fileName: string, 
        rawFile?: File,
        processedTransactions?: Transaction[]
    } | null>(`identificapix-statement-v7${userSuffix}`, null, true);

    const [contributorFiles, setContributorFiles] = usePersistentState<{ churchId: string; content: string; fileName: string, contributors?: Contributor[] }[]>(`identificapix-contributors-v6${userSuffix}`, [], true);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>(`identificapix-results-v6${userSuffix}`, [], true);
    const [reportPreviewData, setReportPreviewData] = usePersistentState<{ income: GroupedReportData; expenses: GroupedReportData } | null>(`identificapix-report-preview-v6${userSuffix}`, null, true);
    const [hasActiveSession, setHasActiveSession] = usePersistentState<boolean>(`identificapix-has-session-v6${userSuffix}`, false, false);
    // NOVO: Rastreia se estamos editando um relatório já salvo
    const [activeReportId, setActiveReportId] = usePersistentState<string | null>(`identificapix-active-report-id${userSuffix}`, null, false);

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

    // Limpa apenas os arquivos (usado ao abrir um relatório salvo para evitar estado sujo)
    const clearFiles = useCallback(() => {
        setBankStatementFile(null);
        setContributorFiles([]);
    }, [setBankStatementFile, setContributorFiles]);

    // Função para limpar tudo e iniciar nova conciliação
    const resetReconciliation = useCallback(() => {
        setBankStatementFile(null);
        setContributorFiles([]);
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false);
        setActiveReportId(null); // Limpa o ID do relatório ativo
        setManualIdentificationTx(null);
        setBulkIdentificationTxs(null);
        setManualMatchState(null);
        setDivergenceConfirmation(null);
        setAiSuggestion(null);
        showToast("Ambiente limpo para nova conciliação.", "success");
    }, [setBankStatementFile, setContributorFiles, setMatchResults, setReportPreviewData, setHasActiveSession, showToast, setActiveReportId]);

    // --- RECONCILIATION ENGINE JIT (Just-In-Time) ---
    const handleCompare = useCallback(async () => {
        if (!bankStatementFile && !activeReportId) return; // Bloqueio padrão
        
        setIsLoading(true);

        try {
            let activeTransactions: Transaction[] = [];
            
            // CENÁRIO A: Novo Extrato Carregado -> Processamento Completo do Zero
            if (bankStatementFile) {
                const stmtResult = processFileContent(bankStatementFile.content, bankStatementFile.fileName, fileModels, cleaningKeywords);
                activeTransactions = stmtResult.transactions;

                if (activeTransactions.length === 0) {
                    throw new Error("O extrato não gerou transações válidas. Verifique o arquivo.");
                }
                setBankStatementFile(prev => prev ? { ...prev, processedTransactions: activeTransactions } : null);
            } 
            // CENÁRIO B: Modo Aditivo (Sem novo extrato, apenas novas listas para o relatório ativo)
            else if (activeReportId && contributorFiles.length > 0) {
                // Recupera as transações do banco que ainda não foram identificadas
                // E também as que foram identificadas manualmente (para preservar)
                // O objetivo é tentar identificar apenas os "buracos" usando as novas listas
                activeTransactions = matchResults
                    .filter(r => r.status === 'NÃO IDENTIFICADO')
                    .map(r => r.transaction);
                
                if (activeTransactions.length === 0) {
                    // Se não tiver pendências, talvez o usuário queira apenas adicionar listas para fins de registro (fantasmas)
                    // Não lançamos erro, apenas prosseguimos com array vazio para gerar os PENDENTES da lista
                }
            }

            let filteredTransactions = activeTransactions;
            if (comparisonType === 'income') filteredTransactions = activeTransactions.filter(t => t.amount > 0);
            else if (comparisonType === 'expenses') filteredTransactions = activeTransactions.filter(t => t.amount < 0);

            // 2. Processamento das Listas de Contribuintes (Recém carregadas)
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
            // Se estiver no modo aditivo, isso vai rodar apenas nas transações pendentes
            const newResults = matchTransactions(
                filteredTransactions, 
                contributorData, 
                { similarityThreshold: similarityLevel, dayTolerance }, 
                learnedAssociations, 
                churches, 
                cleaningKeywords
            );

            // 4. MERGE DE RESULTADOS (Crucial para o modo aditivo)
            if (!bankStatementFile && activeReportId) {
                // Mescla os novos resultados com os antigos
                // A prioridade é: Identificado Agora > Identificado Antes > Pendente
                
                setMatchResults(prevResults => {
                    const finalResults = [...prevResults];
                    
                    newResults.forEach(newRes => {
                        // Se for uma transação do banco que agora foi identificada
                        if (newRes.transaction.id && !newRes.transaction.id.startsWith('ghost-')) {
                            const index = finalResults.findIndex(r => r.transaction.id === newRes.transaction.id);
                            if (index !== -1) {
                                // Só atualiza se o novo resultado for um sucesso (IDENTIFICADO)
                                if (newRes.status === 'IDENTIFICADO') {
                                    finalResults[index] = newRes;
                                } else if (newRes.suggestion && !finalResults[index].suggestion) {
                                    // Se não identificou mas achou sugestão nova, atualiza sugestão
                                    finalResults[index] = newRes;
                                }
                            }
                        } 
                        // Se for um item da lista que não bateu (Ghost/Pendente), adiciona
                        else {
                            finalResults.push(newRes);
                        }
                    });
                    
                    // Atualiza Preview
                    setReportPreviewData({
                        income: groupResultsByChurch(finalResults.filter(r => r.transaction.amount > 0 || r.status === 'PENDENTE')),
                        expenses: { 'all_expenses_group': finalResults.filter(r => r.transaction.amount < 0) }
                    });
                    
                    return finalResults;
                });
                
                showToast("Novas listas processadas e adicionadas ao relatório!", 'success');

            } else {
                // Modo Normal (Sobrescreve tudo)
                setMatchResults(newResults);
                setReportPreviewData({
                    income: groupResultsByChurch(newResults.filter(r => r.transaction.amount > 0 || r.status === 'PENDENTE')),
                    expenses: { 'all_expenses_group': newResults.filter(r => r.transaction.amount < 0) }
                });
                showToast("Conciliação finalizada!", 'success');
            }

            setHasActiveSession(true);
            setActiveView('reports');

        } catch (e: any) {
            console.error(e);
            showToast(e.message || "Erro ao processar dados.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [bankStatementFile, activeReportId, contributorFiles, churches, similarityLevel, dayTolerance, cleaningKeywords, learnedAssociations, setMatchResults, setReportPreviewData, setHasActiveSession, setActiveView, showToast, setIsLoading, comparisonType, setBankStatementFile, fileModels, matchResults]);

    const updateReportData = useCallback((updatedRow: MatchResult, reportType: 'income' | 'expenses', idToRemove?: string) => {
        // 1. Atualiza lista plana (MatchResults)
        setMatchResults(prev => {
            let next = prev;
            // Se tiver ID para remover (Transação Fantasma Pendente), remove antes
            if (idToRemove) {
                next = next.filter(r => r.transaction.id !== idToRemove);
            }
            return next.map(r => r.transaction.id === updatedRow.transaction.id ? updatedRow : r);
        });

        // 2. Atualiza dados agrupados (ReportPreview)
        setReportPreviewData(prev => {
            if (!prev) return null;
            const newPreview = JSON.parse(JSON.stringify(prev));
            const targetGroup = reportType === 'expenses' ? newPreview.expenses : newPreview.income;
            
            if (reportType === 'income') {
                // LÓGICA DE ENTRADAS (Income)
                // Remove o item de qualquer grupo onde ele esteja (tanto o ID real quanto o ID fantasma)
                // Isso evita duplicação ao mover de 'unidentified' ou 'pendente' para uma igreja específica
                Object.keys(targetGroup).forEach(key => {
                    targetGroup[key] = targetGroup[key].filter((r: MatchResult) => {
                        const isTarget = r.transaction.id === updatedRow.transaction.id;
                        const isGhost = idToRemove && r.transaction.id === idToRemove;
                        return !isTarget && !isGhost;
                    });
                });

                // Adiciona o item atualizado ao grupo correto
                const currentChurchId = updatedRow.church.id || 'unidentified';
                if (!newPreview.income[currentChurchId]) newPreview.income[currentChurchId] = [];
                newPreview.income[currentChurchId].push(updatedRow);

            } else {
                // LÓGICA DE SAÍDAS (Expenses) - Mantém comportamento padrão de atualização in-place
                Object.keys(targetGroup).forEach(key => {
                    targetGroup[key] = targetGroup[key].map((r: MatchResult) => 
                        r.transaction.id === updatedRow.transaction.id ? updatedRow : r
                    );
                });
            }

            return newPreview;
        });
    }, [setMatchResults, setReportPreviewData]);

    const discardCurrentReport = useCallback(() => {
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false);
        setActiveReportId(null);
        setActiveView('upload');
    }, [setMatchResults, setReportPreviewData, setHasActiveSession, setActiveView, setActiveReportId]);

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
        
        // Se o registro original era PENDENTE, significa que era uma transação fantasma da lista.
        // Precisamos capturar esse ID para removê-lo, pois ele será substituído pela transação real do banco.
        const ghostIdToRemove = record.status === 'PENDENTE' ? record.transaction.id : undefined;

        const updatedResult: MatchResult = {
            ...record,
            transaction: selectedTx,
            status: 'IDENTIFICADO',
            matchMethod: 'MANUAL',
            similarity: 100
        };
        
        updateReportData(updatedResult, 'income', ghostIdToRemove);
        closeManualMatchModal();
        showToast("Associação manual aplicada.", "success");
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
        activeReportId, setActiveReportId, // EXPORTED
        pendingTraining, setPendingTraining, comparisonType, setComparisonType,
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile, clearFiles, // EXPORTED
        handleCompare, updateReportData, discardCurrentReport, openLabManually,
        handleTrainingSuccess, resetReconciliation,
        manualIdentificationTx, setManualIdentificationTx,
        bulkIdentificationTxs, setBulkIdentificationTxs,
        closeManualIdentify,
        manualMatchState, setManualMatchState,
        openManualMatchModal, closeManualMatchModal, confirmManualAssociation,
        divergenceConfirmation, setDivergenceConfirmation,
        openDivergenceModal, closeDivergenceModal, confirmDivergence, rejectDivergence,
        loadingAiId, setLoadingAiId, aiSuggestion, setAiSuggestion, handleAnalyze,
        setBankStatementFile // EXPORTED
    }), [
        bankStatementFile, contributorFiles, matchResults, reportPreviewData, hasActiveSession, activeReportId, pendingTraining, comparisonType, 
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile, clearFiles, handleCompare, updateReportData, discardCurrentReport, openLabManually, handleTrainingSuccess,
        setMatchResults, setReportPreviewData, setHasActiveSession, setActiveReportId, resetReconciliation,
        manualIdentificationTx, bulkIdentificationTxs, closeManualIdentify,
        manualMatchState, openManualMatchModal, closeManualMatchModal, confirmManualAssociation,
        divergenceConfirmation, openDivergenceModal, closeDivergenceModal, confirmDivergence, rejectDivergence,
        loadingAiId, aiSuggestion, handleAnalyze, setBankStatementFile
    ]);
};
