
import React, { createContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { useReferenceData } from '../hooks/useReferenceData';
import { useReconciliation } from '../hooks/useReconciliation';
import { useReportManager } from '../hooks/useReportManager';
import { usePersistentState } from '../hooks/usePersistentState';
import {
    Transaction, Contributor, MatchResult, Bank, Church, ChurchFormData,
    DeletingItem, ComparisonType, GroupedReportData, SearchFilters, SavedReport,
    SavingReportState, LearnedAssociation, MatchMethod, FileModel
} from '../types';
import { groupResultsByChurch, PLACEHOLDER_CHURCH } from '../services/processingService';

import { supabase } from '../services/supabaseClient';
import { useTranslation } from './I18nContext';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { RecompareModal } from '../components/modals/RecompareModal';

interface AppContextType {
    // Data State (from useReferenceData)
    banks: Bank[];
    churches: Church[];
    fileModels: FileModel[];
    fetchModels: () => Promise<void>;
    setBanks: React.Dispatch<React.SetStateAction<Bank[]>>;
    setChurches: React.Dispatch<React.SetStateAction<Church[]>>;
    similarityLevel: number;
    setSimilarityLevel: React.Dispatch<React.SetStateAction<number>>;
    dayTolerance: number;
    setDayTolerance: React.Dispatch<React.SetStateAction<number>>;
    customIgnoreKeywords: string[]; 
    effectiveIgnoreKeywords: string[]; 
    addIgnoreKeyword: (keyword: string) => void;
    removeIgnoreKeyword: (keyword: string) => void;
    contributionKeywords: string[];
    addContributionKeyword: (keyword: string) => void;
    removeContributionKeyword: (keyword: string) => void;
    learnedAssociations: LearnedAssociation[];
    
    // Edit States
    editingBank: Bank | null;
    editingChurch: Church | null;
    openEditBank: (bank: Bank) => void;
    closeEditBank: () => void;
    updateBank: (bankId: string, name: string) => void;
    addBank: (name: string) => Promise<boolean>;
    openEditChurch: (church: Church) => void;
    closeEditChurch: () => void;
    updateChurch: (churchId: string, data: ChurchFormData) => void;
    addChurch: (data: ChurchFormData) => Promise<boolean>;

    // Reconciliation State (from useReconciliation)
    bankStatementFile: { bankId: string, content: string, fileName: string, rawFile?: File } | null;
    contributorFiles: { churchId: string; content: string; fileName: string; contributors?: Contributor[] }[];
    matchResults: MatchResult[];
    setMatchResults: React.Dispatch<React.SetStateAction<MatchResult[]>>;
    reportPreviewData: { income: GroupedReportData; expenses: GroupedReportData } | null;
    setReportPreviewData: React.Dispatch<React.SetStateAction<{ income: GroupedReportData; expenses: GroupedReportData } | null>>;
    comparisonType: ComparisonType;
    setComparisonType: React.Dispatch<React.SetStateAction<ComparisonType>>;
    hasActiveSession: boolean;
    isCompareDisabled: boolean;
    pendingTraining: any;
    setPendingTraining: (val: any) => void;

    // Reconciliation Actions
    openLabManually: (targetFile?: { content: string, fileName: string, type: 'statement' | 'contributor', id: string, rawFile?: File }) => void;
    handleStatementUpload: (content: string, fileName: string, bankId: string, rawFile: File) => void;
    handleContributorsUpload: (content: string, fileName: string, churchId: string) => void;
    handleTrainingSuccess: (model: FileModel, data: Transaction[]) => void;
    removeBankStatementFile: () => void;
    removeContributorFile: (churchId: string) => void;
    handleCompare: () => void;
    handleBackToSettings: () => void;
    updateReportData: (updatedRow: MatchResult, reportType: 'income' | 'expenses', idToRemove?: string) => void;
    discardCurrentReport: () => void;
    resetReconciliation: () => void; // NOVO

    // Manual Operations State & Handlers
    manualIdentificationTx: Transaction | null;
    setManualIdentificationTx: React.Dispatch<React.SetStateAction<Transaction | null>>;
    bulkIdentificationTxs: Transaction[] | null;
    setBulkIdentificationTxs: React.Dispatch<React.SetStateAction<Transaction[] | null>>;
    
    openManualIdentify: (transactionId: string) => void;
    openBulkManualIdentify: (transactions: Transaction[]) => void;
    closeManualIdentify: () => void;
    confirmManualIdentification: (transactionId: string, churchId: string) => void;
    confirmBulkManualIdentification: (transactionIds: string[], churchId: string) => void;
    
    manualMatchState: { record: MatchResult, suggestions: Transaction[] } | null;
    setManualMatchState: React.Dispatch<React.SetStateAction<{ record: MatchResult, suggestions: Transaction[] } | null>>;
    openManualMatchModal: (recordToMatch: MatchResult) => void;
    closeManualMatchModal: () => void;
    confirmManualAssociation: (selectedTx: Transaction) => void;
    
    // Smart Edit (NEW)
    smartEditTarget: MatchResult | null;
    openSmartEdit: (match: MatchResult) => void;
    closeSmartEdit: () => void;
    saveSmartEdit: (updatedMatch: MatchResult) => void;

    divergenceConfirmation: MatchResult | null;
    setDivergenceConfirmation: React.Dispatch<React.SetStateAction<MatchResult | null>>;
    openDivergenceModal: (match: MatchResult) => void;
    closeDivergenceModal: () => void;
    confirmDivergence: (divergentMatch: MatchResult) => void;
    rejectDivergence: (divergentMatch: MatchResult) => void;
    
    learnAssociation: (matchResult: MatchResult) => Promise<void>;
    findMatchResult: (transactionId: string) => MatchResult | undefined;
    
    // AI
    loadingAiId: string | null;
    aiSuggestion: { id: string, name: string } | null;
    handleAnalyze: (transaction: Transaction, candidates: Contributor[]) => void;

    // Recompare Modal
    isRecompareModalOpen: boolean;
    openRecompareModal: () => void;
    closeRecompareModal: () => void;

    // Reports & Search (from useReportManager)
    savedReports: SavedReport[];
    maxSavedReports: number; // NOVO: Limite de relatórios
    searchFilters: SearchFilters;
    setSearchFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
    isSearchFiltersOpen: boolean;
    openSearchFilters: () => void;
    closeSearchFilters: () => void;
    clearSearchFilters: () => void;
    allHistoricalResults: MatchResult[];
    
    savingReportState: SavingReportState | null;
    openSaveReportModal: (state: SavingReportState) => void;
    closeSaveReportModal: () => void;
    confirmSaveReport: (name: string) => void;
    viewSavedReport: (reportId: string) => void;
    updateSavedReportName: (reportId: string, newName: string) => void;
    saveFilteredReport: (results: MatchResult[]) => void;

    // Global
    deletingItem: DeletingItem | null;
    openDeleteConfirmation: (item: DeletingItem) => void;
    closeDeleteConfirmation: () => void;
    confirmDeletion: () => void;
    initialDataLoaded: boolean;
    isSyncing: boolean; // NOVO: Estado para indicar sincronização em background
    summary: {
        autoConfirmed: { count: number; value: number; };
        manualConfirmed: { count: number; value: number; };
        pending: { count: number; value: number; };
        identifiedCount: number;
        unidentifiedCount: number;
        totalValue: number;
        valuePerChurch: [string, number][];
        isHistorical: boolean;
        methodBreakdown: Record<MatchMethod, number>;
    };
    isPaymentModalOpen: boolean;
    openPaymentModal: () => void;
    closePaymentModal: () => void;
}

export const AppContext = createContext<AppContextType>(null!);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, systemSettings, incrementAiUsage } = useAuth();
    const { t } = useTranslation();
    const { showToast, setIsLoading, setActiveView } = useUI();

    const referenceData = useReferenceData(user, showToast);
    const reportManager = useReportManager(user, showToast);
    
    const effectiveIgnoreKeywords = useMemo(() => {
        return systemSettings.globalIgnoreKeywords || [];
    }, [systemSettings.globalIgnoreKeywords]);

    const reconciliation = useReconciliation({
        user, 
        churches: referenceData.churches,
        banks: referenceData.banks,
        fileModels: [],
        similarityLevel: referenceData.similarityLevel,
        dayTolerance: referenceData.dayTolerance,
        customIgnoreKeywords: effectiveIgnoreKeywords,
        contributionKeywords: referenceData.contributionKeywords,
        learnedAssociations: referenceData.learnedAssociations,
        showToast, setIsLoading, setActiveView
    });

    const [initialDataLoaded, setInitialDataLoaded] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false); // Inicializa sem sync
    
    const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isRecompareModalOpen, setIsRecompareModalOpen] = useState(false);
    
    const [smartEditTarget, setSmartEditTarget] = useState<MatchResult | null>(null);

    const userSuffix = user ? `-${user.id}` : '-guest';
    const [summary, setSummary] = usePersistentState(`identificapix-dashboard-summary-v6${userSuffix}`, {
        autoConfirmed: { count: 0, value: 0 },
        manualConfirmed: { count: 0, value: 0 },
        pending: { count: 0, value: 0 },
        identifiedCount: 0, unidentifiedCount: 0, totalValue: 0, valuePerChurch: [], isHistorical: false,
        methodBreakdown: { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0, 'TEMPLATE': 0 }
    }, false);

    // Fetch de Dados (Background Sync) - NÃO BLOQUEANTE
    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            // Usamos isSyncing para dar feedback sutil (ex: na sidebar) se necessário.
            setIsSyncing(true);
            
            try {
                // OTIMIZAÇÃO CRÍTICA (Resource Exhaustion Fix):
                // NÃO selecionamos a coluna 'data' (JSON pesado) na listagem inicial.
                // Isso evita o erro de "Exhausting multiple resources" no Supabase Nano.
                const [churchesRes, banksRes, reportsRes] = await Promise.all([
                    supabase.from('churches').select('*').order('name'),
                    supabase.from('banks').select('*').order('name'),
                    supabase.from('saved_reports')
                        .select('id, name, created_at, record_count, user_id') // SEM 'data'
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false }),
                ]);

                if (churchesRes.data) referenceData.setChurches(churchesRes.data as any);
                if (banksRes.data) referenceData.setBanks(banksRes.data as any);
                
                if (reportsRes.data) {
                    reportManager.setSavedReports((reportsRes.data || []).map(r => ({ 
                        id: r.id, 
                        name: r.name, 
                        createdAt: r.created_at, 
                        recordCount: r.record_count, 
                        user_id: r.user_id, 
                        data: null // Lazy Load: Iniciamos sem dados pesados
                    })));
                }
            } catch (err) { console.error('Background sync failed', err); } 
            finally { 
                setIsSyncing(false); 
                setInitialDataLoaded(true); 
            }
        };
        fetchData();
    }, [user?.id]);

    const resultsHash = JSON.stringify(reconciliation.matchResults.map(r => r.transaction.id + r.status));
    const reportsHash = reportManager.savedReports.length;

    useEffect(() => {
        const timer = setTimeout(() => {
            let resultsToProcess = reconciliation.matchResults;
            let isHistorical = false;
            // No modo Lazy Load, o Dashboard histórico fica limitado aos dados já carregados na memória
            // ou apenas à sessão ativa, para evitar crash.
            if (resultsToProcess.length === 0 && reportManager.savedReports.length > 0) {
                resultsToProcess = reportManager.savedReports.flatMap(report => report.data?.results || []);
                isHistorical = true;
            }
            const autoConfirmed = resultsToProcess.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod));
            const manualConfirmed = resultsToProcess.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));
            const pending = resultsToProcess.filter(r => r.status === 'NÃO IDENTIFICADO');
            const valuePerChurch = new Map<string, number>();
            const methodBreakdown: Record<MatchMethod, number> = { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0, 'TEMPLATE': 0 };
            resultsToProcess.forEach(r => {
                if (r.status === 'IDENTIFICADO') {
                    if (r.church && r.church.name !== '---' && r.transaction.amount > 0) {
                        const current = valuePerChurch.get(r.church.name) || 0;
                        valuePerChurch.set(r.church.name, current + r.transaction.amount);
                    }
                    const method = r.matchMethod || 'AUTOMATIC';
                    if (methodBreakdown[method] !== undefined) methodBreakdown[method]++;
                }
            });
            const newTotal = resultsToProcess.reduce((sum, r) => sum + r.transaction.amount, 0);
            setSummary(prev => ({
                autoConfirmed: { count: autoConfirmed.length, value: autoConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0) },
                manualConfirmed: { count: manualConfirmed.length, value: manualConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0) },
                pending: { count: pending.length, value: pending.reduce((sum, r) => sum + r.transaction.amount, 0) },
                identifiedCount: autoConfirmed.length + manualConfirmed.length,
                unidentifiedCount: pending.length, totalValue: newTotal,
                valuePerChurch: Array.from(valuePerChurch.entries()).sort((a, b) => b[1] - a[1]),
                isHistorical, methodBreakdown
            }));
        }, 300);
        return () => clearTimeout(timer);
    }, [resultsHash, reportsHash]);

    const handleBackToSettings = useCallback(() => setActiveView('upload'), [setActiveView]);
    const openDeleteConfirmation = useCallback((item: DeletingItem) => setDeletingItem(item), []);
    const closeDeleteConfirmation = useCallback(() => setDeletingItem(null), []);
    const confirmDeletion = useCallback(async () => {
        if (!deletingItem) return;
        if (deletingItem.type === 'report-row') {
             reconciliation.setReportPreviewData(prev => {
                 if (!prev) return null;
                 const newPreview = { ...prev };
                 const targetGroup = deletingItem.meta?.reportType === 'expenses' ? newPreview.expenses : newPreview.income;
                 Object.keys(targetGroup).forEach(key => { targetGroup[key] = targetGroup[key].filter(r => r.transaction.id !== deletingItem.id); });
                 return newPreview;
             });
             reconciliation.setMatchResults(prev => prev.filter(r => r.transaction.id !== deletingItem.id));
        } else if (deletingItem.type === 'report-group') {
             reconciliation.setReportPreviewData(prev => {
                 if (!prev) return null;
                 const newPreview = { ...prev };
                 const targetGroup = deletingItem.meta?.reportType === 'expenses' ? newPreview.expenses : newPreview.income;
                 if (targetGroup[deletingItem.id]) {
                     const idsToRemove = targetGroup[deletingItem.id].map(r => r.transaction.id);
                     delete targetGroup[deletingItem.id];
                     reconciliation.setMatchResults(prev => prev.filter(r => !idsToRemove.includes(r.transaction.id)));
                 }
                 return newPreview;
             });
        } else if (deletingItem.type === 'bank') {
            referenceData.setBanks(prev => prev.filter(b => b.id !== deletingItem.id));
            await supabase.from('banks').delete().eq('id', deletingItem.id);
        } else if (deletingItem.type === 'church') {
            referenceData.setChurches(prev => prev.filter(c => c.id !== deletingItem.id));
            await supabase.from('churches').delete().eq('id', deletingItem.id);
        } else if (deletingItem.type === 'report-saved') {
            reportManager.setSavedReports(prev => prev.filter(r => r.id !== deletingItem.id));
            await supabase.from('saved_reports').delete().eq('id', deletingItem.id);
        } else if (deletingItem.type === 'uploaded-files') { reconciliation.removeBankStatementFile(); }
        closeDeleteConfirmation();
        showToast("Ação realizada com sucesso.");
    }, [deletingItem, user, referenceData, reportManager, reconciliation, showToast, closeDeleteConfirmation]);

    const viewSavedReport = useCallback(async (reportId: string) => {
        setIsLoading(true);
        try {
            let report = reportManager.savedReports.find(r => r.id === reportId);
            if (!report) return;

            // LAZY LOAD LOGIC: Busca o conteúdo 'data' apenas se ele estiver vazio
            if (!report.data) {
                const { data: reportContent, error } = await supabase
                    .from('saved_reports')
                    .select('data')
                    .eq('id', reportId)
                    .single();

                if (error) throw error;

                if (reportContent) {
                    const parsedData = typeof reportContent.data === 'string' 
                        ? JSON.parse(reportContent.data) 
                        : reportContent.data;
                    
                    report = { ...report, data: parsedData };
                    // Atualiza cache local
                    reportManager.setSavedReports(prev => prev.map(r => r.id === reportId ? report! : r));
                }
            }

            if (!report.data) throw new Error("Conteúdo do relatório vazio.");

            const validResults = report.data.results.map((r: any) => ({ ...r, church: r.church || PLACEHOLDER_CHURCH }));
            reconciliation.setMatchResults(validResults);
            reconciliation.setReportPreviewData({
                income: groupResultsByChurch(validResults.filter((r: any) => r.transaction.amount > 0 || r.status === 'PENDENTE')),
                expenses: { 'all_expenses_group': validResults.filter((r: any) => r.transaction.amount < 0) }
            });
            reconciliation.setHasActiveSession(true); 
            setActiveView('reports'); 
        } catch (error: any) {
            console.error(error);
            showToast("Erro ao abrir relatório: " + error.message, "error");
        } finally {
            setIsLoading(false);
        }
    }, [reportManager.savedReports, reconciliation, setActiveView, setIsLoading, showToast]);

    const findMatchResult = useCallback((transactionId: string) => reconciliation.matchResults.find(r => r.transaction.id === transactionId) || reportManager.allHistoricalResults.find(r => r.transaction.id === transactionId), [reconciliation.matchResults, reportManager.allHistoricalResults]);
    
    const openManualIdentify = useCallback((transactionId: string) => {
        const result = findMatchResult(transactionId);
        if (result) reconciliation.setManualIdentificationTx(result.transaction);
    }, [findMatchResult, reconciliation]);

    const openBulkManualIdentify = useCallback((transactions: Transaction[]) => { reconciliation.setBulkIdentificationTxs(transactions); }, [reconciliation]);
    
    const confirmManualIdentification = useCallback((transactionId: string, churchId: string) => {
        const church = referenceData.churches.find(c => c.id === churchId);
        const result = findMatchResult(transactionId);
        if (church && result) {
            const updated: MatchResult = { ...result, status: 'IDENTIFICADO', church, contributor: { id: `manual-${transactionId}`, name: result.transaction.cleanedDescription || result.transaction.description, amount: result.transaction.amount }, matchMethod: 'MANUAL', similarity: 100, contributorAmount: result.transaction.amount };
            if (reconciliation.matchResults.some(r => r.transaction.id === transactionId)) reconciliation.updateReportData(updated, 'income');
            else reportManager.updateSavedReportTransaction(transactionId, updated);
            reconciliation.closeManualIdentify(); showToast('Identificação realizada.', 'success');
        }
    }, [referenceData.churches, findMatchResult, reconciliation, reportManager, showToast]);

    const confirmBulkManualIdentification = useCallback((transactionIds: string[], churchId: string) => {
        const church = referenceData.churches.find(c => c.id === churchId);
        if (!church) return;
        
        transactionIds.forEach(id => {
            const result = findMatchResult(id);
            if (result) {
                const updated: MatchResult = { 
                    ...result, 
                    status: 'IDENTIFICADO', 
                    church, 
                    contributor: { id: `manual-${id}`, name: result.transaction.cleanedDescription || result.transaction.description, amount: result.transaction.amount }, 
                    matchMethod: 'MANUAL', 
                    similarity: 100, 
                    contributorAmount: result.transaction.amount 
                };
                if (reconciliation.matchResults.some(r => r.transaction.id === id)) reconciliation.updateReportData(updated, 'income');
                else reportManager.updateSavedReportTransaction(id, updated);
            }
        });
        reconciliation.closeManualIdentify();
        showToast(`${transactionIds.length} transações identificadas.`, 'success');
    }, [referenceData.churches, findMatchResult, reconciliation, reportManager, showToast]);

    const openSmartEdit = useCallback((match: MatchResult) => {
        setSmartEditTarget(match);
    }, []);

    const closeSmartEdit = useCallback(() => {
        setSmartEditTarget(null);
        reconciliation.setAiSuggestion(null);
    }, [reconciliation]);

    const saveSmartEdit = useCallback((updatedMatch: MatchResult) => {
        if (reconciliation.matchResults.some(r => r.transaction.id === updatedMatch.transaction.id)) {
            // Se for uma edição de match reverso, precisamos remover o ID fantasma
            const ghostId = smartEditTarget?.status === 'PENDENTE' ? smartEditTarget.transaction.id : undefined;
            reconciliation.updateReportData(updatedMatch, 'income', ghostId);
        } else {
            reportManager.updateSavedReportTransaction(updatedMatch.transaction.id, updatedMatch);
        }
        showToast("Edição salva com sucesso.", "success");
        setSmartEditTarget(null);
        reconciliation.setAiSuggestion(null);
    }, [reconciliation, reportManager, showToast, smartEditTarget]);

    const handleAnalyze = useCallback(async (transaction: Transaction, candidates: Contributor[]) => {
        reconciliation.setLoadingAiId(transaction.id);
        try {
            const candidateNames = candidates.slice(0, 50).map(c => c.name);
            const response = await fetch('/api/ai/suggestion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactionDescription: transaction.description,
                    contributorNames: candidateNames
                })
            });

            if (!response.ok) throw new Error('Falha na API de IA');
            const data = await response.json();
            const suggestionText = data.text;

            if (suggestionText && !suggestionText.includes("Nenhuma sugestão clara")) {
                reconciliation.setAiSuggestion({ id: transaction.id, name: suggestionText });
                incrementAiUsage(); 
            } else {
                reconciliation.setAiSuggestion(null);
            }
        } catch (error) {
            console.error("Erro na análise IA:", error);
            showToast("Não foi possível obter sugestão da IA.", "error");
        } finally {
            reconciliation.setLoadingAiId(null);
        }
    }, [incrementAiUsage, showToast, reconciliation]);

    const value = useMemo(() => ({
        ...referenceData, ...reconciliation, isCompareDisabled: !reconciliation.bankStatementFile,
        effectiveIgnoreKeywords, 
        openManualIdentify, openBulkManualIdentify, confirmManualIdentification, confirmBulkManualIdentification, findMatchResult,
        ...reportManager, viewSavedReport, handleBackToSettings, deletingItem, openDeleteConfirmation,
        closeDeleteConfirmation, confirmDeletion, initialDataLoaded, isSyncing, summary, isPaymentModalOpen,
        openPaymentModal: () => setIsPaymentModalOpen(true), closePaymentModal: () => setIsPaymentModalOpen(false),
        isRecompareModalOpen, openRecompareModal: () => setIsRecompareModalOpen(true), closeRecompareModal: () => setIsRecompareModalOpen(false),
        smartEditTarget, openSmartEdit, closeSmartEdit, saveSmartEdit, handleAnalyze
    }), [referenceData, reconciliation, effectiveIgnoreKeywords, reportManager, viewSavedReport, handleBackToSettings, deletingItem, openDeleteConfirmation, closeDeleteConfirmation, confirmDeletion, initialDataLoaded, isSyncing, summary, isPaymentModalOpen, isRecompareModalOpen, openManualIdentify, openBulkManualIdentify, confirmManualIdentification, confirmBulkManualIdentification, findMatchResult, smartEditTarget, openSmartEdit, closeSmartEdit, saveSmartEdit, handleAnalyze]);

    return <AppContext.Provider value={value}>{children}<RecompareModal /></AppContext.Provider>;
};
