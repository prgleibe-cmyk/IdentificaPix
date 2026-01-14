
import { useState, useCallback, useMemo, useEffect } from 'react';
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
import { consolidationService } from '../services/ConsolidationService';
import { getAISuggestion } from '../services/geminiService';

interface UseReconciliationProps {
    user: User | null;
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
    
    const userSuffix = user ? `-${user.id}` : '-guest';

    const [activeBankFiles, setBankStatementFile] = usePersistentState<{ 
        bankId: string, 
        content: string, 
        fileName: string, 
        rawFile?: File,
        processedTransactions?: Transaction[]
    }[]>(`identificapix-bank-files-v1${userSuffix}`, [], true);

    const [selectedBankIds, setSelectedBankIds] = usePersistentState<string[]>(`identificapix-selected-banks-v1${userSuffix}`, [], false);

    const [contributorFiles, setContributorFiles] = usePersistentState<{ churchId: string; content: string; fileName: string, contributors?: Contributor[] }[]>(`identificapix-contributors-v6${userSuffix}`, [], true);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>(`identificapix-results-v6${userSuffix}`, [], true);
    const [reportPreviewData, setReportPreviewData] = usePersistentState<{ income: GroupedReportData; expenses: GroupedReportData } | null>(`identificapix-report-preview-v6${userSuffix}`, null, true);
    const [hasActiveSession, setHasActiveSession] = usePersistentState<boolean>(`identificapix-has-session-v6${userSuffix}`, false, false);
    const [activeReportId, setActiveReportId] = usePersistentState<string | null>(`identificapix-active-report-id${userSuffix}`, null, false);

    const [comparisonType, setComparisonType] = useState<ComparisonType>('both');
    const [pendingTraining, setPendingTraining] = useState<{ content: string; fileName: string; type: 'statement' | 'contributor'; entityId: string, rawFile?: File } | null>(null);

    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [bulkIdentificationTxs, setBulkIdentificationTxs] = useState<Transaction[] | null>(null);
    const [manualMatchState, setManualMatchState] = useState<{ record: MatchResult, suggestions: Transaction[] } | null>(null);
    const [divergenceConfirmation, setDivergenceConfirmation] = useState<MatchResult | null>(null);
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<{ id: string, name: string } | null>(null);

    const cleaningKeywords = useMemo(() => {
        return Array.from(new Set([...customIgnoreKeywords, ...contributionKeywords]));
    }, [customIgnoreKeywords, contributionKeywords]);

    const toggleBankSelection = useCallback((bankId: string) => {
        setSelectedBankIds(prev => {
            if (prev.includes(bankId)) return prev.filter(id => id !== bankId);
            return [...prev, bankId];
        });
    }, [setSelectedBankIds]);

    const handleStatementUpload = useCallback((content: string, fileName: string, bankId: string, rawFile: File) => {
        setIsLoading(true);
        try {
            const result = processFileContent(content, fileName, fileModels, cleaningKeywords);
            const transactions = result.transactions;

            if (transactions.length > 0) {
                setBankStatementFile(prevFiles => {
                    const existingIndex = prevFiles.findIndex(f => f.bankId === bankId);
                    const newEntry = { 
                        bankId, 
                        content, 
                        fileName, 
                        rawFile,
                        processedTransactions: transactions 
                    };

                    if (existingIndex >= 0) {
                        const updated = [...prevFiles];
                        updated[existingIndex] = newEntry;
                        return updated;
                    } else {
                        return [...prevFiles, newEntry];
                    }
                });

                setSelectedBankIds(prev => prev.includes(bankId) ? prev : [...prev, bankId]);
                
                if (result.appliedModel) {
                    showToast("Modelo identificado e aplicado.", "success");
                } else {
                    showToast(`Extrato carregado.`, 'success');
                }

                if (user) {
                    const consolidationData = transactions.map(t => ({
                        transaction_date: t.date,
                        amount: t.amount,
                        description: t.description,
                        type: (t.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
                        pix_key: null,
                        source: 'file' as 'file',
                        user_id: user.id,
                        bank_id: bankId 
                    }));

                    consolidationService.addTransactions(consolidationData)
                        .catch(err => console.warn("[Consolidation] Background sync skipped:", err));
                }

            } else {
                showToast("Formato de arquivo não reconhecido.", "error");
            }
        } catch (e: any) {
            console.error(e);
            showToast("Erro ao ler o arquivo: " + e.message, "error");
        } finally {
            setIsLoading(false);
        }
    }, [setBankStatementFile, setSelectedBankIds, showToast, setIsLoading, fileModels, cleaningKeywords, user]);

    const handleContributorsUpload = useCallback((content: string, fileName: string, churchId: string, rawFile?: File) => {
        setIsLoading(true);
        try {
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
                showToast(`Lista carregada.`, 'success');
            } else {
                showToast("Formato de lista não reconhecido.", "error");
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
            setBankStatementFile(prevFiles => {
                const existingIndex = prevFiles.findIndex(f => f.bankId === entityId);
                const newEntry = { bankId: entityId, content, fileName, rawFile, processedTransactions: processedData };
                if (existingIndex >= 0) {
                    const updated = [...prevFiles];
                    updated[existingIndex] = newEntry;
                    return updated;
                } else {
                    return [...prevFiles, newEntry];
                }
            });
            setSelectedBankIds(prev => prev.includes(entityId) ? prev : [...prev, entityId]);
            showToast("Extrato salvo!", "success");

            if (user && processedData.length > 0) {
                const consolidationData = processedData.map(t => ({
                    transaction_date: t.date,
                    amount: t.amount,
                    description: t.description,
                    type: (t.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
                    pix_key: null,
                    source: 'file' as 'file',
                    user_id: user.id,
                    bank_id: entityId
                }));
                consolidationService.addTransactions(consolidationData).catch(() => {});
            }
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
            showToast("Lista salva!", "success");
        }
        setPendingTraining(null);
    }, [pendingTraining, cleaningKeywords, setBankStatementFile, setContributorFiles, showToast, user, setSelectedBankIds]);

    const openLabManually = useCallback((targetFile?: { content: string, fileName: string, type: 'statement' | 'contributor', id: string, rawFile?: File }) => {
        if (targetFile) {
            setPendingTraining({ content: targetFile.content, fileName: targetFile.fileName, type: targetFile.type, entityId: targetFile.id, rawFile: targetFile.rawFile });
        } else if (activeBankFiles.length > 0) {
            const firstBank = activeBankFiles[0];
            setPendingTraining({ content: firstBank.content, fileName: firstBank.fileName, type: 'statement', entityId: firstBank.bankId, rawFile: firstBank.rawFile });
        } else {
            showToast("Carregue um arquivo primeiro.", "error");
        }
    }, [activeBankFiles, showToast]);

    // --- BLINDAGEM DA EXCLUSÃO ---
    const removeBankStatementFile = useCallback(async (bankId?: string) => {
        // 1. Atualização Otimista
        if (bankId) {
            setBankStatementFile(prev => prev.filter(f => f.bankId !== bankId));
            setSelectedBankIds(prev => prev.filter(id => id !== bankId));
        } else {
            setBankStatementFile([]);
            setSelectedBankIds([]);
        }

        // 2. Persistência Assíncrona Segura
        if (user) {
            consolidationService.deletePendingTransactions(user.id, bankId)
                .catch(e => {
                    // Log apenas, não trava a UI pois já foi removido visualmente
                    console.warn("[Consolidation] Delete sync warning:", e); 
                });
        }
    }, [setBankStatementFile, setSelectedBankIds, user]);

    const removeContributorFile = useCallback((churchId: string) => {
        setContributorFiles(prev => prev.filter(f => f.churchId !== churchId));
    }, [setContributorFiles]);

    const clearFiles = useCallback(() => {
        setBankStatementFile([]);
        setContributorFiles([]);
        setSelectedBankIds([]);
    }, [setBankStatementFile, setContributorFiles, setSelectedBankIds]);

    const resetReconciliation = useCallback(async () => {
        // 1. Limpeza Local
        setBankStatementFile([]);
        setContributorFiles([]);
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false);
        setActiveReportId(null);
        setSelectedBankIds([]);
        
        // 2. Limpeza DB Segura
        if (user) {
            try {
                // Passa undefined explicitamente para indicar "delete all"
                await consolidationService.deletePendingTransactions(user.id, undefined);
                console.log("[Consolidation] Reset DB command sent.");
            } catch (e) {
                console.error("[Consolidation] Reset DB failed:", e);
            }
        }
        showToast("Ambiente limpo.", "success");
    }, [setBankStatementFile, setContributorFiles, setMatchResults, setReportPreviewData, setHasActiveSession, showToast, setActiveReportId, setSelectedBankIds, user]);

    // --- ENGINE ---
    const handleCompare = useCallback(async () => {
        if (selectedBankIds.length === 0 && !activeReportId) {
            showToast("Selecione pelo menos um banco.", "error");
            return;
        }
        
        setIsLoading(true);
        try {
            let activeTransactions: Transaction[] = [];
            
            if (activeBankFiles.length > 0) {
                const filesToProcess = activeBankFiles.filter(f => selectedBankIds.includes(f.bankId));
                activeTransactions = filesToProcess.flatMap(file => {
                    if (file.processedTransactions && file.processedTransactions.length > 0) {
                        return file.processedTransactions;
                    }
                    return processFileContent(file.content, file.fileName, fileModels, cleaningKeywords).transactions;
                });
            } else if (activeReportId && user) {
                try {
                    const dbTransactions = await consolidationService.getPendingTransactions(user.id);
                    activeTransactions = dbTransactions.map(dbTx => ({
                        id: dbTx.id,
                        date: dbTx.transaction_date,
                        amount: dbTx.amount,
                        description: dbTx.description,
                        cleanedDescription: dbTx.description,
                        contributionType: dbTx.type,
                        originalAmount: String(dbTx.amount)
                    }));
                } catch(e) {
                    activeTransactions = matchResults.filter(r => r.status === 'NÃO IDENTIFICADO').map(r => r.transaction);
                }
            } else if (activeReportId) {
                activeTransactions = matchResults.filter(r => r.status === 'NÃO IDENTIFICADO').map(r => r.transaction);
            }

            if (activeTransactions.length === 0) {
                showToast("Não há transações pendentes.", "error");
                return;
            }

            let filteredTransactions = activeTransactions;
            if (comparisonType === 'income') filteredTransactions = activeTransactions.filter(t => t.amount > 0);
            else if (comparisonType === 'expenses') filteredTransactions = activeTransactions.filter(t => t.amount < 0);

            const contributorData = contributorFiles.map(cf => {
                const church = churches.find(c => c.id === cf.churchId) || PLACEHOLDER_CHURCH;
                if (cf.contributors && cf.contributors.length > 0) return { church, contributors: cf.contributors };
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
                return { church, contributors: currentContributors };
            });

            const newResults = matchTransactions(
                filteredTransactions, 
                contributorData, 
                { similarityThreshold: similarityLevel, dayTolerance }, 
                learnedAssociations, 
                churches, 
                cleaningKeywords
            );

            if (activeReportId) {
                setMatchResults(prevResults => {
                    const finalResults = [...prevResults];
                    newResults.forEach(newRes => {
                        const index = finalResults.findIndex(r => r.transaction.id === newRes.transaction.id);
                        if (index !== -1) {
                            const existing = finalResults[index];
                            if (existing.matchMethod === 'MANUAL' || existing.matchMethod === 'AI') return;
                            if (newRes.status === 'IDENTIFICADO' && existing.status !== 'IDENTIFICADO') finalResults[index] = newRes;
                            else if (newRes.suggestion && !existing.suggestion) finalResults[index] = newRes;
                        } else {
                            finalResults.push(newRes);
                        }
                    });
                    setReportPreviewData({
                        income: groupResultsByChurch(finalResults.filter(r => r.transaction.amount > 0 || r.status === 'PENDENTE')),
                        expenses: { 'all_expenses_group': finalResults.filter(r => r.transaction.amount < 0) }
                    });
                    return finalResults;
                });
                showToast("Dados atualizados!", 'success');
            } else {
                setMatchResults(newResults);
                setReportPreviewData({
                    income: groupResultsByChurch(newResults.filter(r => r.transaction.amount > 0 || r.status === 'PENDENTE')),
                    expenses: { 'all_expenses_group': newResults.filter(r => r.transaction.amount < 0) }
                });
                showToast("Conciliação finalizada!", 'success');
            }

            if (user) {
                const autoMatches = newResults.filter(r => r.status === 'IDENTIFICADO' && r.transaction.id && !r.transaction.id.startsWith('ghost-'));
                if (autoMatches.length > 0) {
                    const updatePromises = autoMatches.map(m => consolidationService.markAsIdentified(m.transaction.id).catch(() => {}));
                    Promise.all(updatePromises);
                }
            }

            setHasActiveSession(true);
            setActiveView('reports');

        } catch (e: any) {
            console.error(e);
            showToast("Erro ao processar.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [activeBankFiles, selectedBankIds, activeReportId, contributorFiles, churches, similarityLevel, dayTolerance, cleaningKeywords, learnedAssociations, setMatchResults, setReportPreviewData, setHasActiveSession, setActiveView, showToast, setIsLoading, comparisonType, fileModels, matchResults, user]);

    const updateReportData = useCallback((updatedRow: MatchResult, reportType: 'income' | 'expenses', idToRemove?: string) => {
        setMatchResults(prev => {
            let next = prev;
            if (idToRemove) next = next.filter(r => r.transaction.id !== idToRemove);
            return next.map(r => r.transaction.id === updatedRow.transaction.id ? updatedRow : r);
        });
        setReportPreviewData(prev => {
            if (!prev) return null;
            const newPreview = JSON.parse(JSON.stringify(prev));
            const targetGroup = reportType === 'expenses' ? newPreview.expenses : newPreview.income;
            if (reportType === 'income') {
                Object.keys(targetGroup).forEach(key => {
                    targetGroup[key] = targetGroup[key].filter((r: MatchResult) => {
                        const isTarget = r.transaction.id === updatedRow.transaction.id;
                        const isGhost = idToRemove && r.transaction.id === idToRemove;
                        return !isTarget && !isGhost;
                    });
                });
                const currentChurchId = updatedRow.church.id || 'unidentified';
                if (!newPreview.income[currentChurchId]) newPreview.income[currentChurchId] = [];
                newPreview.income[currentChurchId].push(updatedRow);
            } else {
                Object.keys(targetGroup).forEach(key => {
                    targetGroup[key] = targetGroup[key].map((r: MatchResult) => r.transaction.id === updatedRow.transaction.id ? updatedRow : r);
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

    const closeManualIdentify = useCallback(() => { setManualIdentificationTx(null); setBulkIdentificationTxs(null); }, []);
    const openManualMatchModal = useCallback((record: MatchResult) => { setManualMatchState({ record, suggestions: matchResults.map(r => r.transaction) }); }, [matchResults]);
    const closeManualMatchModal = useCallback(() => setManualMatchState(null), []);

    const confirmManualAssociation = useCallback((selectedTx: Transaction) => {
        if (!manualMatchState) return;
        const { record } = manualMatchState;
        const ghostIdToRemove = record.status === 'PENDENTE' ? record.transaction.id : undefined;
        const updatedResult: MatchResult = { ...record, transaction: selectedTx, status: 'IDENTIFICADO', matchMethod: 'MANUAL', similarity: 100 };
        updateReportData(updatedResult, 'income', ghostIdToRemove);
        closeManualMatchModal();
        showToast("Associado.", "success");
    }, [manualMatchState, updateReportData, closeManualMatchModal, showToast]);

    const openDivergenceModal = useCallback((match: MatchResult) => setDivergenceConfirmation(match), []);
    const closeDivergenceModal = useCallback(() => setDivergenceConfirmation(null), []);
    const confirmDivergence = useCallback((divergentMatch: MatchResult) => { updateReportData({ ...divergentMatch, status: 'IDENTIFICADO' }, 'income'); setDivergenceConfirmation(null); }, [updateReportData]);
    const rejectDivergence = useCallback((divergentMatch: MatchResult) => {
        if (divergentMatch.divergence?.expectedChurch) {
             const restored: MatchResult = { ...divergentMatch, church: divergentMatch.divergence.expectedChurch, status: 'IDENTIFICADO' };
             updateReportData(restored, 'income');
        } else {
             updateReportData({ ...divergentMatch, status: 'NÃO IDENTIFICADO', church: PLACEHOLDER_CHURCH, contributor: null }, 'income');
        }
        setDivergenceConfirmation(null);
    }, [updateReportData]);

    const handleAnalyze = useCallback(async (tx: Transaction, contributors: Contributor[]) => {
        setLoadingAiId(tx.id);
        setAiSuggestion(null);
        try {
            const result = await getAISuggestion(tx, contributors);
            setAiSuggestion({ id: tx.id, name: result });
        } catch (error) {
            console.error("AI Analysis failed", error);
            showToast("Falha na análise de IA", "error");
        } finally {
            setLoadingAiId(null);
        }
    }, [showToast, setLoadingAiId, setAiSuggestion]);

    const isCompareDisabled = selectedBankIds.length === 0 && !activeReportId;

    return useMemo(() => ({
        activeBankFiles, selectedBankIds, toggleBankSelection,
        bankStatementFile: activeBankFiles.length > 0 ? activeBankFiles[0] : null,
        contributorFiles, matchResults, setMatchResults, reportPreviewData, setReportPreviewData, hasActiveSession, setHasActiveSession,
        activeReportId, setActiveReportId, pendingTraining, setPendingTraining, comparisonType, setComparisonType,
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile, clearFiles, 
        handleCompare, updateReportData, discardCurrentReport, openLabManually, handleTrainingSuccess, resetReconciliation,
        manualIdentificationTx, setManualIdentificationTx, bulkIdentificationTxs, setBulkIdentificationTxs, closeManualIdentify,
        manualMatchState, setManualMatchState, openManualMatchModal, closeManualMatchModal, confirmManualAssociation,
        divergenceConfirmation, setDivergenceConfirmation, openDivergenceModal, closeDivergenceModal, confirmDivergence, rejectDivergence,
        loadingAiId, setLoadingAiId, aiSuggestion, setAiSuggestion, handleAnalyze,
        setBankStatementFile: (files: any) => setBankStatementFile(files),
        isCompareDisabled
    }), [activeBankFiles, selectedBankIds, toggleBankSelection, contributorFiles, matchResults, reportPreviewData, hasActiveSession, activeReportId, pendingTraining, comparisonType, handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile, clearFiles, handleCompare, updateReportData, discardCurrentReport, openLabManually, handleTrainingSuccess, setMatchResults, setReportPreviewData, setHasActiveSession, setActiveReportId, resetReconciliation, manualIdentificationTx, bulkIdentificationTxs, closeManualIdentify, manualMatchState, openManualMatchModal, closeManualMatchModal, confirmManualAssociation, divergenceConfirmation, openDivergenceModal, closeDivergenceModal, confirmDivergence, rejectDivergence, loadingAiId, aiSuggestion, handleAnalyze, setBankStatementFile, isCompareDisabled]);
};
