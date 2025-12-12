
import { useState, useCallback, useEffect, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';
import { Transaction, MatchResult, GroupedReportData, ComparisonType, Contributor, Church, ContributorFile } from '../types';
import { parseBankStatement, parseContributors, matchTransactions, processExpenses, groupResultsByChurch, parseDate, normalizeString } from '../services/processingService';
import { getAISuggestion } from '../services/geminiService';
import { Logger, Metrics } from '../services/monitoringService';
import { PLACEHOLDER_CHURCH } from '../services/processingService';
import { useAuth } from '../contexts/AuthContext';

interface UseReconciliationProps {
    churches: Church[];
    similarityLevel: number;
    dayTolerance: number;
    customIgnoreKeywords: string[];
    learnedAssociations: any[];
    showToast: (msg: string, type: 'success' | 'error') => void;
    setIsLoading: (loading: boolean) => void;
    setActiveView: (view: any) => void;
}

export const useReconciliation = ({
    churches,
    similarityLevel,
    dayTolerance,
    customIgnoreKeywords,
    learnedAssociations,
    showToast,
    setIsLoading,
    setActiveView
}: UseReconciliationProps) => {
    
    // Auth Context for Usage tracking
    const { subscription, incrementAiUsage } = useAuth();

    // --- File State ---
    const [bankStatementFile, setBankStatementFile] = usePersistentState<{ bankId: string, content: string, fileName: string } | null>('identificapix-statement', null, true);
    const [contributorFiles, setContributorFiles] = usePersistentState<{ churchId: string; content: string; fileName: string }[]>('identificapix-contributors', [], true);
    
    // --- Results State ---
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>('identificapix-results', [], true);
    const [reportPreviewData, setReportPreviewData] = usePersistentState<{ income: GroupedReportData; expenses: GroupedReportData } | null>('identificapix-report-preview', null, true);
    const [hasActiveSession, setHasActiveSession] = usePersistentState<boolean>('identificapix-has-session', false, false);

    // --- UI Logic State ---
    const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<{ id: string, name: string } | null>(null);
    
    // --- Manual Match States ---
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [manualMatchState, setManualMatchState] = useState<{ record: MatchResult, suggestions: Transaction[] } | null>(null);
    const [divergenceConfirmation, setDivergenceConfirmation] = useState<MatchResult | null>(null);

    // --- Computed: All Contributors ---
    const [allContributorsWithChurch, setAllContributorsWithChurch] = useState<(Contributor & { church: Church; uniqueId: string })[]>([]);

    useEffect(() => {
        const timer = setTimeout(() => {
             const calculated = contributorFiles.flatMap(file => {
                const church = churches.find(c => c.id === file.churchId);
                if (!church) return [];
                const contributors = parseContributors(file.content, customIgnoreKeywords);
                return contributors.map((contributor, index) => ({
                    ...contributor,
                    church,
                    uniqueId: `${church.id}-${contributor.normalizedName}-${index}`
                }));
            });
            setAllContributorsWithChurch(calculated);
        }, 10);
        return () => clearTimeout(timer);
    }, [contributorFiles, churches, customIgnoreKeywords]);

    // --- Actions ---

    const handleStatementUpload = useCallback((content: string, fileName: string, bankId: string) => {
        setBankStatementFile({ bankId, content, fileName });
    }, [setBankStatementFile]);

    const handleContributorsUpload = useCallback((content: string, fileName: string, churchId: string) => {
        setContributorFiles(prev => {
            const existing = prev.filter(f => f.churchId !== churchId);
            return [...existing, { churchId, content, fileName }];
        });
    }, [setContributorFiles]);

    const removeBankStatementFile = useCallback(() => {
        setBankStatementFile(null);
        showToast("Extrato bancário removido.", 'success');
    }, [setBankStatementFile, showToast]);
    
    const removeContributorFile = useCallback((churchId: string) => {
        setContributorFiles(prev => prev.filter(f => f.churchId !== churchId));
        showToast("Lista de contribuintes removida.", 'success');
    }, [setContributorFiles, showToast]);

    const updateReportData = useCallback((updatedRow: MatchResult, reportType: 'income' | 'expenses') => {
        setReportPreviewData(prev => {
            if (!prev) return null;
            const newPreview = { ...prev };
            const groupKey = reportType === 'income' ? (updatedRow.church.id || 'unidentified') : 'all_expenses_group';
            const targetGroup = reportType === 'income' ? newPreview.income : newPreview.expenses;
            
            Object.keys(targetGroup).forEach(key => {
                targetGroup[key] = targetGroup[key].filter(r => r.transaction.id !== updatedRow.transaction.id);
            });

            if (!targetGroup[groupKey]) targetGroup[groupKey] = [];
            targetGroup[groupKey].push(updatedRow);
            
            setMatchResults(prevResults => {
                return prevResults.map(r => r.transaction.id === updatedRow.transaction.id ? updatedRow : r);
            });

            return newPreview;
        });
    }, [setReportPreviewData, setMatchResults]);

    const handleCompare = useCallback(async () => {
        if (!bankStatementFile && comparisonType !== 'expenses') return;
        if (!bankStatementFile) return;
    
        setIsLoading(true);
        // Yield to UI
        await new Promise(resolve => setTimeout(resolve, 50));
        Metrics.reset();
        const startTime = performance.now();
    
        try {
            const transactions = parseBankStatement(bankStatementFile.content, customIgnoreKeywords);
            const incomeTransactions = transactions.filter(t => t.amount > 0);
            const expenseTransactions = transactions.filter(t => t.amount < 0);
            
            const parsedContributorFiles = contributorFiles.map(file => ({
                church: churches.find(c => c.id === file.churchId),
                contributors: parseContributors(file.content, customIgnoreKeywords),
            })).filter(f => f.church) as ContributorFile[];
    
            const previewResults: { income: GroupedReportData; expenses: GroupedReportData } = { income: {}, expenses: {} };
            let incomeResultsForDashboard: MatchResult[] = [];
    
            if (comparisonType === 'income' || comparisonType === 'both') {
                if (incomeTransactions.length > 0) {
                    const incomeResults = matchTransactions(
                        incomeTransactions, parsedContributorFiles, { similarityThreshold: similarityLevel, dayTolerance }, learnedAssociations, churches, customIgnoreKeywords
                    );
                    previewResults.income = groupResultsByChurch(incomeResults);
                    incomeResultsForDashboard = incomeResults;
                }
            }
            
            if (comparisonType === 'expenses' || comparisonType === 'both') {
                if (expenseTransactions.length > 0) {
                    const expenseResults = processExpenses(expenseTransactions);
                    previewResults.expenses = {
                        'all_expenses_group': expenseResults
                    };
                    if (incomeResultsForDashboard.length > 0) {
                        incomeResultsForDashboard = [...incomeResultsForDashboard, ...expenseResults];
                    } else {
                        incomeResultsForDashboard = expenseResults;
                    }
                }
            }
    
            setMatchResults(incomeResultsForDashboard);
            setReportPreviewData(previewResults);
            setHasActiveSession(true);
            setActiveView('reports');
            
            const endTime = performance.now();
            Metrics.set('processingTimeMs', endTime - startTime);
            showToast('Conciliação concluída com sucesso!', 'success');
    
        } catch (error) {
            Logger.error('Error during comparison', error);
            showToast('Erro ao processar a conciliação.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [bankStatementFile, contributorFiles, churches, similarityLevel, dayTolerance, customIgnoreKeywords, comparisonType, learnedAssociations, setMatchResults, setReportPreviewData, setHasActiveSession, setActiveView, showToast, setIsLoading]);

    const handleAnalyze = useCallback(async (transactionId: string) => {
        // Enforce AI Limit
        const currentUsage = subscription.aiUsage || 0;
        const limit = subscription.aiLimit || 100;
        
        if (currentUsage >= limit) {
            showToast("Limite de análises IA atingido. Faça upgrade do seu plano.", 'error');
            return;
        }

        const result = matchResults.find(r => r.transaction.id === transactionId);
        if (!result) return;

        setLoadingAiId(transactionId);
        try {
            const allContributorNames = allContributorsWithChurch; 
            if (allContributorNames.length === 0) {
                showToast("Não há contribuintes carregados para análise.", 'error');
                return;
            }

            const suggestionName = await getAISuggestion(result.transaction, allContributorNames);
            
            if (suggestionName && !suggestionName.toLowerCase().includes('nenhuma sugestão') && !suggestionName.toLowerCase().includes('erro')) {
                const matchedContributor = allContributorNames.find(c => 
                    c.name === suggestionName || c.normalizedName === normalizeString(suggestionName, customIgnoreKeywords)
                );

                if (matchedContributor) {
                    const newResult: MatchResult = {
                        ...result,
                        status: 'IDENTIFICADO',
                        contributor: matchedContributor,
                        church: matchedContributor.church,
                        matchMethod: 'AI',
                        similarity: 90, 
                        contributorAmount: matchedContributor.amount
                    };
                    
                    updateReportData(newResult, 'income');
                    
                    // Increment usage on success
                    await incrementAiUsage();

                    setAiSuggestion({ id: transactionId, name: suggestionName });
                    setTimeout(() => setAiSuggestion(null), 5000);
                    showToast(`IA Sugeriu: ${suggestionName}`, 'success');
                } else {
                     showToast("IA sugeriu um nome, mas não foi encontrado na lista.", 'error');
                }
            } else {
                showToast("IA não encontrou uma correspondência clara.", 'error');
            }
        } catch (error) {
            Logger.error("AI Analysis failed", error);
            showToast("Erro ao analisar com IA.", 'error');
        } finally {
            setLoadingAiId(null);
        }
    }, [matchResults, allContributorsWithChurch, customIgnoreKeywords, updateReportData, showToast, subscription, incrementAiUsage]);

    // Manual Identification Logic
    const openManualIdentify = useCallback((transactionId: string) => {
        const tx = matchResults.find(r => r.transaction.id === transactionId)?.transaction;
        if (tx) setManualIdentificationTx(tx);
    }, [matchResults]);
    const closeManualIdentify = useCallback(() => setManualIdentificationTx(null), []);
    const confirmManualIdentification = useCallback((transactionId: string, churchId: string) => {
        const church = churches.find(c => c.id === churchId);
        const result = matchResults.find(r => r.transaction.id === transactionId);
        
        if (church && result) {
            const newContributor: Contributor = {
                id: `manual-${transactionId}`,
                name: result.transaction.cleanedDescription || result.transaction.description, 
                cleanedName: result.transaction.cleanedDescription,
                amount: result.transaction.amount,
                originalAmount: result.transaction.originalAmount,
                date: result.transaction.date
            };

            const updatedRow: MatchResult = {
                ...result,
                status: 'IDENTIFICADO',
                church,
                contributor: newContributor,
                matchMethod: 'MANUAL',
                similarity: 100,
                contributorAmount: result.transaction.amount
            };
            
            updateReportData(updatedRow, 'income');
            closeManualIdentify();
            showToast('Identificação manual realizada.', 'success');
        }
    }, [churches, matchResults, updateReportData, closeManualIdentify, showToast]);

    // Manual Match Modal Logic
    const openManualMatchModal = useCallback((record: MatchResult) => {
        // daysDifference helper
        const daysDiff = (d1: Date, d2: Date) => Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));

        const pendingTransactions = matchResults
            .filter(r => r.status === 'NÃO IDENTIFICADO' && !r.transaction.id.startsWith('pending-'))
            .map(r => r.transaction);

        const suggestions = pendingTransactions.filter(tx => {
            if (Math.abs(tx.amount - (record.contributor?.amount || 0)) > 0.05) return false;
            const txDate = parseDate(tx.date);
            const recDate = record.contributor?.date ? parseDate(record.contributor.date) : null;
            if (txDate && recDate) {
                return daysDiff(txDate, recDate) <= (dayTolerance + 2); 
            }
            return true;
        });

        setManualMatchState({ record, suggestions });
    }, [matchResults, dayTolerance]);
    
    const closeManualMatchModal = useCallback(() => setManualMatchState(null), []);
    const confirmManualAssociation = useCallback((selectedTx: Transaction) => {
        if (!manualMatchState) return;
        const { record } = manualMatchState;
        const bankTxResult = matchResults.find(r => r.transaction.id === selectedTx.id);
        
        if (bankTxResult && record.contributor) {
             const updatedRow: MatchResult = {
                ...bankTxResult,
                status: 'IDENTIFICADO',
                church: record.church,
                contributor: record.contributor,
                matchMethod: 'MANUAL',
                similarity: 100,
                contributorAmount: record.contributor.amount
            };

            // Complex logic to remove the "pending" row and update the "real" row
            setReportPreviewData(prev => {
                if (!prev) return null;
                const newPreview = { ...prev };
                const incomeGroup = newPreview.income;
                if (incomeGroup[record.church.id]) incomeGroup[record.church.id] = incomeGroup[record.church.id].filter(r => r.transaction.id !== record.transaction.id);
                if (incomeGroup['unidentified']) incomeGroup['unidentified'] = incomeGroup['unidentified'].filter(r => r.transaction.id !== selectedTx.id);
                if (!incomeGroup[record.church.id]) incomeGroup[record.church.id] = [];
                incomeGroup[record.church.id].push(updatedRow);
                return newPreview;
            });

            setMatchResults(prev => {
                const filtered = prev.filter(r => r.transaction.id !== record.transaction.id);
                return filtered.map(r => r.transaction.id === selectedTx.id ? updatedRow : r);
            });
            
            showToast("Associação realizada com sucesso!", 'success');
            closeManualMatchModal();
        }
    }, [manualMatchState, matchResults, setReportPreviewData, setMatchResults, closeManualMatchModal, showToast]);

    // Divergence Logic
    const openDivergenceModal = useCallback((match: MatchResult) => setDivergenceConfirmation(match), []);
    const closeDivergenceModal = useCallback(() => setDivergenceConfirmation(null), []);
    const confirmDivergence = useCallback((match: MatchResult) => {
        const updatedMatch = { ...match, divergence: undefined };
        updateReportData(updatedMatch, 'income');
        closeDivergenceModal();
        showToast("Divergência aceita.", 'success');
    }, [updateReportData, closeDivergenceModal, showToast]);
    const rejectDivergence = useCallback((match: MatchResult) => {
        if (match.divergence) {
            const updatedMatch = { 
                ...match, 
                church: match.divergence.expectedChurch,
                divergence: undefined 
            };
            updateReportData(updatedMatch, 'income');
            closeDivergenceModal();
            showToast("Igreja corrigida para a esperada.", 'success');
        }
    }, [updateReportData, closeDivergenceModal, showToast]);

    const discardCurrentReport = useCallback(() => {
        setReportPreviewData(null);
        setMatchResults([]);
        setHasActiveSession(false);
        setActiveView('upload');
        showToast("Relatório descartado.", 'success');
    }, [setReportPreviewData, setMatchResults, setHasActiveSession, setActiveView, showToast]);

    const clearUploadedFiles = useCallback(() => {
        setBankStatementFile(null);
        setContributorFiles([]);
        showToast("Arquivos carregados foram removidos.", 'success');
    }, [setBankStatementFile, setContributorFiles, showToast]);

    const clearMatchResults = useCallback(() => {
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false); 
        showToast("Resultados da conciliação foram limpos.", 'success');
    }, [setMatchResults, setReportPreviewData, setHasActiveSession, showToast]);

    return useMemo(() => ({
        bankStatementFile, setBankStatementFile,
        contributorFiles, setContributorFiles,
        matchResults, setMatchResults,
        reportPreviewData, setReportPreviewData,
        hasActiveSession, setHasActiveSession,
        
        comparisonType, setComparisonType,
        loadingAiId, aiSuggestion, setAiSuggestion,
        allContributorsWithChurch,

        handleStatementUpload, handleContributorsUpload,
        removeBankStatementFile, removeContributorFile,
        clearUploadedFiles, clearMatchResults,
        
        handleCompare, handleAnalyze,
        updateReportData, discardCurrentReport,

        manualIdentificationTx, openManualIdentify, closeManualIdentify, confirmManualIdentification,
        manualMatchState, openManualMatchModal, closeManualMatchModal, confirmManualAssociation,
        divergenceConfirmation, openDivergenceModal, closeDivergenceModal, confirmDivergence, rejectDivergence
    }), [
        bankStatementFile, contributorFiles, matchResults, reportPreviewData, hasActiveSession,
        comparisonType, loadingAiId, aiSuggestion, allContributorsWithChurch,
        manualIdentificationTx, manualMatchState, divergenceConfirmation,
        setBankStatementFile, setContributorFiles, setMatchResults, setReportPreviewData, setHasActiveSession,
        setComparisonType, setAiSuggestion,
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile, clearUploadedFiles, clearMatchResults,
        handleCompare, handleAnalyze, updateReportData, discardCurrentReport,
        openManualIdentify, closeManualIdentify, confirmManualIdentification,
        openManualMatchModal, closeManualMatchModal, confirmManualAssociation,
        openDivergenceModal, closeDivergenceModal, confirmDivergence, rejectDivergence
    ]);
};
