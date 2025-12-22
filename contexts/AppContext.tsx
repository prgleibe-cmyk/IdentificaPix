
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
    SavingReportState, LearnedAssociation, MatchMethod
} from '../types';
import { groupResultsByChurch, PLACEHOLDER_CHURCH } from '../services/processingService';
import { Logger } from '../services/monitoringService';
import { supabase } from '../services/supabaseClient';
import { useTranslation } from './I18nContext';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { RecompareModal } from '../components/modals/RecompareModal';

interface AppContextType {
    // Data State (from useReferenceData)
    banks: Bank[];
    churches: Church[];
    setBanks: React.Dispatch<React.SetStateAction<Bank[]>>;
    setChurches: React.Dispatch<React.SetStateAction<Church[]>>;
    similarityLevel: number;
    setSimilarityLevel: React.Dispatch<React.SetStateAction<number>>;
    dayTolerance: number;
    setDayTolerance: React.Dispatch<React.SetStateAction<number>>;
    customIgnoreKeywords: string[];
    addIgnoreKeyword: (keyword: string) => void;
    removeIgnoreKeyword: (keyword: string) => void;
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
    bankStatementFile: { bankId: string, content: string, fileName: string } | null;
    contributorFiles: { churchId: string; content: string; fileName: string }[];
    matchResults: MatchResult[];
    setMatchResults: React.Dispatch<React.SetStateAction<MatchResult[]>>;
    reportPreviewData: { income: GroupedReportData; expenses: GroupedReportData } | null;
    setReportPreviewData: React.Dispatch<React.SetStateAction<{ income: GroupedReportData; expenses: GroupedReportData } | null>>;
    loadingAiId: string | null;
    aiSuggestion: { id: string, name: string } | null;
    comparisonType: ComparisonType;
    setComparisonType: React.Dispatch<React.SetStateAction<ComparisonType>>;
    hasActiveSession: boolean;
    allContributorsWithChurch: (Contributor & { church: Church; uniqueId: string })[];
    isCompareDisabled: boolean;

    handleStatementUpload: (content: string, fileName: string, bankId: string) => void;
    handleContributorsUpload: (content: string, fileName: string, churchId: string) => void;
    removeBankStatementFile: () => void;
    removeContributorFile: (churchId: string) => void;
    handleCompare: () => void;
    handleAnalyze: (transactionId: string) => void;
    handleBackToSettings: () => void;
    updateReportData: (updatedRow: MatchResult, reportType: 'income' | 'expenses') => void;
    discardCurrentReport: () => void;

    // Manual Operations
    manualIdentificationTx: Transaction | null;
    bulkIdentificationTxs: Transaction[] | null;
    openManualIdentify: (transactionId: string) => void;
    openBulkManualIdentify: (transactions: Transaction[]) => void;
    closeManualIdentify: () => void;
    confirmManualIdentification: (transactionId: string, churchId: string) => void;
    confirmBulkManualIdentification: (transactionIds: string[], churchId: string) => void;
    manualMatchState: { record: MatchResult, suggestions: Transaction[] } | null;
    openManualMatchModal: (recordToMatch: MatchResult) => void;
    closeManualMatchModal: () => void;
    confirmManualAssociation: (selectedTx: Transaction) => void;
    divergenceConfirmation: MatchResult | null;
    openDivergenceModal: (match: MatchResult) => void;
    closeDivergenceModal: () => void;
    confirmDivergence: (divergentMatch: MatchResult) => void;
    rejectDivergence: (divergentMatch: MatchResult) => void;
    learnAssociation: (matchResult: MatchResult) => Promise<void>;
    findMatchResult: (transactionId: string) => MatchResult | undefined;
    
    // Recompare Modal
    isRecompareModalOpen: boolean;
    openRecompareModal: () => void;
    closeRecompareModal: () => void;

    // Reports & Search (from useReportManager)
    savedReports: SavedReport[];
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
    const { user } = useAuth();
    const { t } = useTranslation();
    const { showToast, setIsLoading, setActiveView } = useUI();

    const referenceData = useReferenceData(user, showToast);
    const reportManager = useReportManager(user, showToast);
    const reconciliation = useReconciliation({
        churches: referenceData.churches,
        banks: referenceData.banks, // Passando bancos para o hook
        similarityLevel: referenceData.similarityLevel,
        dayTolerance: referenceData.dayTolerance,
        customIgnoreKeywords: referenceData.customIgnoreKeywords,
        learnedAssociations: referenceData.learnedAssociations,
        showToast,
        setIsLoading,
        setActiveView
    });

    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isRecompareModalOpen, setIsRecompareModalOpen] = useState(false);

    const [summary, setSummary] = usePersistentState('identificapix-dashboard-summary-v6', {
        autoConfirmed: { count: 0, value: 0 },
        manualConfirmed: { count: 0, value: 0 },
        pending: { count: 0, value: 0 },
        identifiedCount: 0,
        unidentifiedCount: 0,
        totalValue: 0,
        valuePerChurch: [],
        isHistorical: false,
        methodBreakdown: { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 }
    }, false);

    useEffect(() => {
        if (!user) return;
        
        const fetchData = async () => {
            try {
                const fetchPromise = Promise.all([
                    supabase.from('churches').select('*').order('name'),
                    supabase.from('banks').select('*').order('name'),
                    supabase.from('saved_reports').select('id, name, created_at, record_count, user_id, data').eq('user_id', user.id).order('created_at', { ascending: false }),
                ]);

                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Supabase Timeout")), 10000)
                );

                const results = await Promise.race([fetchPromise, timeoutPromise]) as any[];
                const [churchesResult, banksResult, savedReportsResult] = results;
        
                if (churchesResult.data) referenceData.setChurches(churchesResult.data as any || []);
                if (banksResult.data) referenceData.setBanks(banksResult.data as any || []);
                if (savedReportsResult.data) {
                    const mappedReports = (savedReportsResult.data || []).map(report => {
                        let parsedData = report.data;
                        if (typeof report.data === 'string') {
                            try { parsedData = JSON.parse(report.data); } catch (e) { parsedData = { results: [] }; }
                        }
                        return { id: report.id, name: report.name, createdAt: report.created_at, recordCount: report.record_count, user_id: report.user_id, data: parsedData as unknown as SavedReport['data'] };
                    });
                    reportManager.setSavedReports(mappedReports);
                }
            } catch (err) {
                Logger.error('Fetch initial data failed', err);
            } finally {
                setIsLoading(false);
                setInitialDataLoaded(true);
            }
        };
        fetchData();
    }, [user?.id]);

    const resultsHash = JSON.stringify(reconciliation.matchResults.map(r => r.transaction.id + r.status));
    const reportsHash = reportManager.savedReports.length;

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!initialDataLoaded) return;

            let resultsToProcess = reconciliation.matchResults;
            let isHistorical = false;

            if (resultsToProcess.length === 0 && reportManager.savedReports.length > 0) {
                resultsToProcess = reportManager.savedReports.flatMap(report => report.data?.results || []);
                isHistorical = true;
            }

            const autoConfirmed = resultsToProcess.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod));
            const manualConfirmed = resultsToProcess.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));
            const pending = resultsToProcess.filter(r => r.status === 'NÃO IDENTIFICADO');
    
            const valuePerChurch = new Map<string, number>();
            const methodBreakdown: Record<MatchMethod, number> = { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 };

            resultsToProcess.forEach(r => {
                if (r.status === 'IDENTIFICADO') {
                    if (r.church && r.church.name !== '---' && r.transaction.amount > 0) {
                        const current = valuePerChurch.get(r.church.name) || 0;
                        valuePerChurch.set(r.church.name, current + r.transaction.amount);
                    }
                    const method = r.matchMethod || 'AUTOMATIC';
                    if (Object.prototype.hasOwnProperty.call(methodBreakdown, method)) methodBreakdown[method]++;
                }
            });
            
            const newTotal = resultsToProcess.reduce((sum, r) => sum + r.transaction.amount, 0);
            
            setSummary(prev => {
                if (prev.totalValue === newTotal && prev.identifiedCount === (autoConfirmed.length + manualConfirmed.length) && prev.isHistorical === isHistorical) return prev;
                return {
                    autoConfirmed: { count: autoConfirmed.length, value: autoConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0) },
                    manualConfirmed: { count: manualConfirmed.length, value: manualConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0) },
                    pending: { count: pending.length, value: pending.reduce((sum, r) => sum + r.transaction.amount, 0) },
                    identifiedCount: autoConfirmed.length + manualConfirmed.length,
                    unidentifiedCount: pending.length,
                    totalValue: newTotal,
                    valuePerChurch: Array.from(valuePerChurch.entries()).sort((a, b) => b[1] - a[1]),
                    isHistorical,
                    methodBreakdown
                };
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [resultsHash, reportsHash, initialDataLoaded]);

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
        } else if (deletingItem.type === 'uploaded-files') {
            reconciliation.clearUploadedFiles();
        } else if (deletingItem.type === 'match-results') {
            reconciliation.clearMatchResults();
        } else if (deletingItem.type === 'learned-associations') {
            referenceData.setLearnedAssociations([]);
            await supabase.from('learned_associations').delete().eq('user_id', user?.id);
        }
        closeDeleteConfirmation();
        showToast("Ação realizada com sucesso.");
    }, [deletingItem, user, referenceData, reportManager, reconciliation, showToast, closeDeleteConfirmation]);

    const viewSavedReport = useCallback((reportId: string) => {
        const report = reportManager.savedReports.find(r => r.id === reportId);
        if (!report || !report.data) return;
        try {
            const validResults = report.data.results.map(r => ({ ...r, church: r.church || PLACEHOLDER_CHURCH }));
            reconciliation.setMatchResults(validResults);
            reconciliation.setReportPreviewData({
                income: groupResultsByChurch(validResults.filter(r => r.transaction.amount > 0)),
                expenses: { 'all_expenses_group': validResults.filter(r => r.transaction.amount < 0) }
            });
            reconciliation.setHasActiveSession(true);
            setActiveView('reports'); 
        } catch (error) { showToast("Erro ao abrir relatório.", 'error'); }
    }, [reportManager.savedReports, reconciliation, setActiveView, showToast]);

    const findMatchResult = useCallback((transactionId: string) => reconciliation.matchResults.find(r => r.transaction.id === transactionId) || reportManager.allHistoricalResults.find(r => r.transaction.id === transactionId), [reconciliation.matchResults, reportManager.allHistoricalResults]);

    const openManualIdentify = useCallback((transactionId: string) => {
        const result = findMatchResult(transactionId);
        if (result) reconciliation.setManualIdentificationTx(result.transaction);
    }, [findMatchResult, reconciliation]);

    const openBulkManualIdentify = useCallback((transactions: Transaction[]) => {
        reconciliation.setBulkIdentificationTxs(transactions);
    }, [reconciliation]);

    const confirmManualIdentification = useCallback((transactionId: string, churchId: string) => {
        const church = referenceData.churches.find(c => c.id === churchId);
        const result = findMatchResult(transactionId);
        if (church && result) {
            const updated: MatchResult = { ...result, status: 'IDENTIFICADO', church, contributor: { id: `manual-${transactionId}`, name: result.transaction.cleanedDescription || result.transaction.description, amount: result.transaction.amount }, matchMethod: 'MANUAL', similarity: 100, contributorAmount: result.transaction.amount };
            if (reconciliation.matchResults.some(r => r.transaction.id === transactionId)) reconciliation.updateReportData(updated, 'income');
            else reportManager.updateSavedReportTransaction(transactionId, updated);
            reconciliation.closeManualIdentify();
            showToast('Identificação realizada.', 'success');
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
                    contributor: { 
                        id: `manual-${id}`, 
                        name: result.transaction.cleanedDescription || result.transaction.description, 
                        amount: result.transaction.amount 
                    }, 
                    matchMethod: 'MANUAL', 
                    similarity: 100, 
                    contributorAmount: result.transaction.amount 
                };
                
                // Aprendizado para as próximas vezes
                referenceData.learnAssociation(updated);

                if (reconciliation.matchResults.some(r => r.transaction.id === id)) {
                    reconciliation.updateReportData(updated, 'income');
                } else {
                    reportManager.updateSavedReportTransaction(id, updated);
                }
            }
        });

        reconciliation.setBulkIdentificationTxs(null);
        showToast(`${transactionIds.length} transações identificadas.`, 'success');
    }, [referenceData, findMatchResult, reconciliation, reportManager, showToast]);

    const value = useMemo(() => ({
        ...referenceData, 
        ...reconciliation, 
        isCompareDisabled: !reconciliation.bankStatementFile, 
        openManualIdentify, 
        openBulkManualIdentify,
        confirmManualIdentification, 
        confirmBulkManualIdentification,
        findMatchResult, 
        ...reportManager, 
        viewSavedReport, 
        handleBackToSettings, 
        deletingItem, 
        openDeleteConfirmation, 
        closeDeleteConfirmation, 
        confirmDeletion, 
        initialDataLoaded, 
        summary, 
        isPaymentModalOpen, 
        openPaymentModal: () => setIsPaymentModalOpen(true), 
        closePaymentModal: () => setIsPaymentModalOpen(false), 
        isRecompareModalOpen, 
        openRecompareModal: () => setIsRecompareModalOpen(true), 
        closeRecompareModal: () => setIsRecompareModalOpen(false)
    }), [referenceData, reconciliation, reportManager, viewSavedReport, handleBackToSettings, deletingItem, openDeleteConfirmation, closeDeleteConfirmation, confirmDeletion, initialDataLoaded, summary, isPaymentModalOpen, isRecompareModalOpen, openManualIdentify, openBulkManualIdentify, confirmManualIdentification, confirmBulkManualIdentification, findMatchResult]);

    return <AppContext.Provider value={value}>{children}<RecompareModal /></AppContext.Provider>;
};
