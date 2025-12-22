
import { useState, useCallback, useEffect, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';
import { Transaction, MatchResult, GroupedReportData, ComparisonType, Contributor, Church, ContributorFile, Bank } from '../types';
import { parseBankStatement, parseContributors, matchTransactions, processExpenses, groupResultsByChurch, parseDate, normalizeString } from '../services/processingService';
import { getAISuggestion } from '../services/geminiService';
import { Logger, Metrics } from '../services/monitoringService';
import { PLACEHOLDER_CHURCH } from '../services/processingService';
import { useAuth } from '../contexts/AuthContext';

interface UseReconciliationProps {
    churches: Church[];
    banks: Bank[]; // Adicionado banks para validação
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
    banks,
    similarityLevel,
    dayTolerance,
    customIgnoreKeywords,
    learnedAssociations,
    showToast,
    setIsLoading,
    setActiveView
}: UseReconciliationProps) => {
    
    const { subscription, incrementAiUsage } = useAuth();

    const [bankStatementFile, setBankStatementFile] = usePersistentState<{ bankId: string, content: string, fileName: string } | null>('identificapix-statement-v6', null, true);
    const [contributorFiles, setContributorFiles] = usePersistentState<{ churchId: string; content: string; fileName: string }[]>('identificapix-contributors-v6', [], true);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>('identificapix-results-v6', [], true);
    const [reportPreviewData, setReportPreviewData] = usePersistentState<{ income: GroupedReportData; expenses: GroupedReportData } | null>('identificapix-report-preview-v6', null, true);
    const [hasActiveSession, setHasActiveSession] = usePersistentState<boolean>('identificapix-has-session-v6', false, false);

    // --- Validação de Integridade (Resiliência contra IDs Órfãos) ---
    useEffect(() => {
        // Se temos um extrato, mas o banco não existe mais na lista atual, limpamos o estado para destravar a UI
        if (bankStatementFile && banks.length > 0) {
            const bankExists = banks.some(b => b.id === bankStatementFile.bankId);
            if (!bankExists) {
                console.warn("Limpando extrato órfão detectado.");
                setBankStatementFile(null);
            }
        }
        
        // O mesmo para as listas de contribuintes
        if (contributorFiles.length > 0 && churches.length > 0) {
            const validFiles = contributorFiles.filter(f => churches.some(c => c.id === f.churchId));
            if (validFiles.length !== contributorFiles.length) {
                console.warn("Limpando listas de contribuintes órfãs detectadas.");
                setContributorFiles(validFiles);
            }
        }
    }, [banks, churches, bankStatementFile, contributorFiles, setBankStatementFile, setContributorFiles]);

    const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<{ id: string, name: string } | null>(null);
    
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [bulkIdentificationTxs, setBulkIdentificationTxs] = useState<Transaction[] | null>(null);
    const [manualMatchState, setManualMatchState] = useState<{ record: MatchResult, suggestions: Transaction[] } | null>(null);
    const [divergenceConfirmation, setDivergenceConfirmation] = useState<MatchResult | null>(null);

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
        }, 100);
        return () => clearTimeout(timer);
    }, [contributorFiles, churches, customIgnoreKeywords]);

    const handleStatementUpload = useCallback((content: string, fileName: string, bankId: string) => {
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false);
        setBankStatementFile({ bankId, content, fileName });
    }, [setBankStatementFile, setMatchResults, setReportPreviewData, setHasActiveSession]);

    const handleContributorsUpload = useCallback((content: string, fileName: string, churchId: string) => {
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false);
        setContributorFiles(prev => {
            const existing = prev.filter(f => f.churchId !== churchId);
            return [...existing, { churchId, content, fileName }];
        });
    }, [setContributorFiles, setMatchResults, setReportPreviewData, setHasActiveSession]);

    const removeBankStatementFile = useCallback(() => {
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false);
        setBankStatementFile(null);
        showToast("Extrato bancário removido.", 'success');
    }, [setBankStatementFile, setMatchResults, setReportPreviewData, setHasActiveSession, showToast]);
    
    const removeContributorFile = useCallback((churchId: string) => {
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false);
        setContributorFiles(prev => prev.filter(f => f.churchId !== churchId));
        showToast("Lista de contribuintes removida.", 'success');
    }, [setContributorFiles, setMatchResults, setReportPreviewData, setHasActiveSession, showToast]);

    const updateReportData = useCallback((updatedRow: MatchResult, reportType: 'income' | 'expenses') => {
        setReportPreviewData(prev => {
            if (!prev) return null;
            const newPreview = { ...prev };
            if (reportType === 'income') {
                newPreview.income = { ...prev.income };
            } else {
                newPreview.expenses = { ...prev.expenses };
            }
            const groupKey = reportType === 'income' ? (updatedRow.church.id || 'unidentified') : 'all_expenses_group';
            const targetGroup = reportType === 'income' ? newPreview.income : newPreview.expenses;
            Object.keys(targetGroup).forEach(key => {
                targetGroup[key] = targetGroup[key].filter(r => r.transaction.id !== updatedRow.transaction.id);
            });
            if (!targetGroup[groupKey]) targetGroup[groupKey] = [];
            targetGroup[groupKey].push(updatedRow);
            setMatchResults(prevResults => prevResults.map(r => r.transaction.id === updatedRow.transaction.id ? updatedRow : r));
            return newPreview;
        });
    }, [setReportPreviewData, setMatchResults]);

    const handleCompare = useCallback(async () => {
        if (!bankStatementFile) return;
        setIsLoading(true);
        try {
            const transactions = parseBankStatement(bankStatementFile.content, customIgnoreKeywords);
            const incomeTransactions = transactions.filter(t => t.amount > 0);
            const expenseTransactions = transactions.filter(t => t.amount < 0);
            
            const parsedContributorFiles = contributorFiles.map(file => ({
                church: churches.find(c => c.id === file.churchId),
                contributors: parseContributors(file.content, customIgnoreKeywords),
            })).filter(f => f.church) as ContributorFile[];
    
            const previewResults: { income: GroupedReportData; expenses: GroupedReportData } = { income: {}, expenses: {} };
            let allRes: MatchResult[] = [];
    
            if (comparisonType === 'income' || comparisonType === 'both') {
                const incomeResults = matchTransactions(incomeTransactions, parsedContributorFiles, { similarityThreshold: similarityLevel, dayTolerance }, learnedAssociations, churches, customIgnoreKeywords);
                previewResults.income = groupResultsByChurch(incomeResults);
                allRes = incomeResults;
            }
            
            if (comparisonType === 'expenses' || comparisonType === 'both') {
                const expenseResults = processExpenses(expenseTransactions);
                previewResults.expenses = { 'all_expenses_group': expenseResults };
                allRes = [...allRes, ...expenseResults];
            }
    
            setMatchResults(allRes);
            setReportPreviewData(previewResults);
            setHasActiveSession(true);
            setActiveView('reports');
            showToast('Conciliação concluída!', 'success');
        } catch (error) {
            showToast('Erro ao processar.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [bankStatementFile, contributorFiles, churches, similarityLevel, dayTolerance, customIgnoreKeywords, comparisonType, learnedAssociations, setMatchResults, setReportPreviewData, setHasActiveSession, setActiveView, showToast, setIsLoading]);

    const handleAnalyze = useCallback(async (transactionId: string) => {
        const currentUsage = subscription.aiUsage || 0;
        const limit = subscription.aiLimit || 100;
        if (currentUsage >= limit) {
            showToast("Limite de IA atingido.", 'error');
            return;
        }
        const result = matchResults.find(r => r.transaction.id === transactionId);
        if (!result) return;
        setLoadingAiId(transactionId);
        try {
            const suggestionName = await getAISuggestion(result.transaction, allContributorsWithChurch);
            if (suggestionName && !suggestionName.toLowerCase().includes('nenhuma')) {
                const matched = allContributorsWithChurch.find(c => c.name === suggestionName || c.normalizedName === normalizeString(suggestionName, customIgnoreKeywords));
                if (matched) {
                    const newResult: MatchResult = { ...result, status: 'IDENTIFICADO', contributor: matched, church: matched.church, matchMethod: 'AI', similarity: 90, contributorAmount: matched.amount };
                    updateReportData(newResult, 'income');
                    await incrementAiUsage();
                    showToast(`IA Sugeriu: ${suggestionName}`, 'success');
                }
            } else {
                showToast("IA não identificou correspondência.", 'error');
            }
        } catch (error) {
            showToast("Erro na IA.", 'error');
        } finally {
            setLoadingAiId(null);
        }
    }, [matchResults, allContributorsWithChurch, customIgnoreKeywords, updateReportData, showToast, subscription, incrementAiUsage]);

    const openManualIdentify = useCallback((transactionId: string) => {
        const tx = matchResults.find(r => r.transaction.id === transactionId)?.transaction;
        if (tx) setManualIdentificationTx(tx);
    }, [matchResults]);

    const closeManualIdentify = useCallback(() => {
        setManualIdentificationTx(null);
        setBulkIdentificationTxs(null);
    }, []);

    const confirmManualIdentification = useCallback((transactionId: string, churchId: string) => {
        const church = churches.find(c => c.id === churchId);
        const result = matchResults.find(r => r.transaction.id === transactionId);
        if (church && result) {
            const newContributor: Contributor = { id: `manual-${transactionId}`, name: result.transaction.cleanedDescription || result.transaction.description, cleanedName: result.transaction.cleanedDescription, amount: result.transaction.amount, originalAmount: result.transaction.originalAmount, date: result.transaction.date };
            const updatedRow: MatchResult = { ...result, status: 'IDENTIFICADO', church, contributor: newContributor, matchMethod: 'MANUAL', similarity: 100, contributorAmount: result.transaction.amount };
            updateReportData(updatedRow, 'income');
            closeManualIdentify();
            showToast('Identificação realizada.', 'success');
        }
    }, [churches, matchResults, updateReportData, closeManualIdentify, showToast]);

    const openManualMatchModal = useCallback((record: MatchResult) => {
        const pending = matchResults.filter(r => r.status === 'NÃO IDENTIFICADO' && !r.transaction.id.startsWith('pending-')).map(r => r.transaction);
        setManualMatchState({ record, suggestions: pending });
    }, [matchResults]);
    
    const closeManualMatchModal = useCallback(() => setManualMatchState(null), []);

    const confirmManualAssociation = useCallback((selectedTx: Transaction) => {
        if (!manualMatchState) return;
        const { record } = manualMatchState;
        const bankTxResult = matchResults.find(r => r.transaction.id === selectedTx.id);
        if (bankTxResult && record.contributor) {
             const updatedRow: MatchResult = { ...bankTxResult, status: 'IDENTIFICADO', church: record.church, contributor: record.contributor, matchMethod: 'MANUAL', similarity: 100, contributorAmount: record.contributor.amount };
            setReportPreviewData(prev => {
                if (!prev) return null;
                const newPreview = { ...prev };
                newPreview.income = { ...prev.income };
                if (newPreview.income[record.church.id]) newPreview.income[record.church.id] = newPreview.income[record.church.id].filter(r => r.transaction.id !== record.transaction.id);
                if (newPreview.income['unidentified']) newPreview.income['unidentified'] = newPreview.income['unidentified'].filter(r => r.transaction.id !== selectedTx.id);
                if (!newPreview.income[record.church.id]) newPreview.income[record.church.id] = [];
                newPreview.income[record.church.id].push(updatedRow);
                return newPreview;
            });
            setMatchResults(prev => prev.filter(r => r.transaction.id !== record.transaction.id).map(r => r.transaction.id === selectedTx.id ? updatedRow : r));
            showToast("Associação realizada!", 'success');
            closeManualMatchModal();
        }
    }, [manualMatchState, matchResults, setReportPreviewData, setMatchResults, closeManualMatchModal, showToast]);

    const openDivergenceModal = useCallback((match: MatchResult) => {
        setDivergenceConfirmation(match);
    }, []);

    const closeDivergenceModal = useCallback(() => {
        setDivergenceConfirmation(null);
    }, []);

    const confirmDivergence = useCallback((divergentMatch: MatchResult) => {
        const cleanedMatch = { ...divergentMatch, divergence: undefined as any };
        updateReportData(cleanedMatch, 'income');
        setDivergenceConfirmation(null);
        showToast("Divergência confirmada.", 'success');
    }, [updateReportData, showToast]);

    const discardCurrentReport = useCallback(() => {
        setReportPreviewData(null);
        setMatchResults([]);
        setHasActiveSession(false);
        setActiveView('upload');
        showToast("Descartado.", 'success');
    }, [setReportPreviewData, setMatchResults, setHasActiveSession, setActiveView, showToast]);

    const clearUploadedFiles = useCallback(() => {
        setBankStatementFile(null);
        setContributorFiles([]);
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false);
        showToast("Uploads limpos.", 'success');
    }, [setBankStatementFile, setContributorFiles, setMatchResults, setReportPreviewData, setHasActiveSession, showToast]);

    const clearMatchResults = useCallback(() => {
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false); 
        showToast("Resultados limpos.", 'success');
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
        manualIdentificationTx, setManualIdentificationTx, 
        bulkIdentificationTxs, setBulkIdentificationTxs,
        openManualIdentify, closeManualIdentify, confirmManualIdentification,
        manualMatchState, openManualMatchModal, closeManualMatchModal, confirmManualAssociation,
        divergenceConfirmation, openDivergenceModal, closeDivergenceModal, confirmDivergence, rejectDivergence: (m: MatchResult) => setDivergenceConfirmation(null)
    }), [
        bankStatementFile, contributorFiles, matchResults, reportPreviewData, hasActiveSession,
        comparisonType, loadingAiId, aiSuggestion, allContributorsWithChurch,
        manualIdentificationTx, bulkIdentificationTxs, manualMatchState, divergenceConfirmation,
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile, clearUploadedFiles, clearMatchResults,
        handleCompare, handleAnalyze, updateReportData, discardCurrentReport,
        openManualIdentify, closeManualIdentify, confirmManualIdentification,
        openManualMatchModal, closeManualMatchModal, confirmManualAssociation, setManualIdentificationTx,
        openDivergenceModal, closeDivergenceModal, confirmDivergence
    ]);
};
