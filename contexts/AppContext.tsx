
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
    openManualIdentify: (transactionId: string) => void;
    closeManualIdentify: () => void;
    confirmManualIdentification: (transactionId: string, churchId: string) => void;
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

    // --- 1. Composition: Use Domain-Specific Hooks ---
    // These hooks now return MEMOIZED objects, so 'referenceData' etc. are stable unless their internals change.
    const referenceData = useReferenceData(user, showToast);
    const reportManager = useReportManager(user, showToast);
    const reconciliation = useReconciliation({
        churches: referenceData.churches,
        similarityLevel: referenceData.similarityLevel,
        dayTolerance: referenceData.dayTolerance,
        customIgnoreKeywords: referenceData.customIgnoreKeywords,
        learnedAssociations: referenceData.learnedAssociations,
        showToast,
        setIsLoading,
        setActiveView
    });

    // --- 2. Global UI State & Lifecycle ---
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isRecompareModalOpen, setIsRecompareModalOpen] = useState(false);

    // --- 3. Dashboard Summary Calculation (Heavy, Derived) ---
    // Kept here as it aggregates data from multiple sources
    // UPDATED KEY TO '_v5' TO FORCE RESET AND FIX LOOPS caused by corrupt data
    const [summary, setSummary] = usePersistentState('identificapix-dashboard-summary-v5', {
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

    // --- 4. Global Effects ---
    // Fetch Initial Data
    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            const hasCachedData = referenceData.banks.length > 0 || referenceData.churches.length > 0 || reconciliation.hasActiveSession;
            if (!hasCachedData) setIsLoading(true);
            
            try {
                const [churchesResult, banksResult, savedReportsResult] = await Promise.all([
                    supabase.from('churches').select('*').order('name'),
                    supabase.from('banks').select('*').order('name'),
                    supabase.from('saved_reports').select('id, name, created_at, record_count, user_id, data').eq('user_id', user.id).order('created_at', { ascending: false }),
                ]);
        
                if (churchesResult.data) referenceData.setChurches(churchesResult.data as any || []);
                if (banksResult.data) referenceData.setBanks(banksResult.data as any || []);
                if (savedReportsResult.data) {
                    const mappedReports = (savedReportsResult.data || []).map(report => {
                        // Ensure data is parsed if it comes as string (double encoded)
                        let parsedData = report.data;
                        if (typeof report.data === 'string') {
                            try {
                                parsedData = JSON.parse(report.data);
                            } catch (e) {
                                console.error("Failed to parse saved report data", e);
                                parsedData = { results: [] };
                            }
                        }
                        
                        return {
                            id: report.id,
                            name: report.name,
                            createdAt: report.created_at,
                            recordCount: report.record_count,
                            user_id: report.user_id,
                            data: parsedData as unknown as SavedReport['data'], 
                        };
                    });
                    reportManager.setSavedReports(mappedReports);
                }
                referenceData.setLearnedAssociations([]);
                
            } catch (err) {
                Logger.error('Unexpected error fetching initial data', err);
            } finally {
                setIsLoading(false);
                setInitialDataLoaded(true);
            }
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]); 

    // Summary Calculation Effect - OPTIMIZED TO PREVENT LOOPS
    // We use JSON.stringify on the IDs to detect meaningful changes, rather than object references.
    const resultsHash = JSON.stringify(reconciliation.matchResults.map(r => r.transaction.id + r.status + (r.contributor?.id || '')));
    const reportsHash = reportManager.savedReports.length;

    useEffect(() => {
        const timer = setTimeout(() => {
            // Safety check: if data isn't loaded or arrays are empty, don't re-calculate
            if (!initialDataLoaded && reconciliation.matchResults.length === 0) return;

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
                    if (Object.prototype.hasOwnProperty.call(methodBreakdown, method)) {
                        methodBreakdown[method]++;
                    }
                }
            });
            
            const newTotalValue = resultsToProcess.reduce((sum, r) => sum + r.transaction.amount, 0);
            
            setSummary(prev => {
                // Strict equality check to prevent React Loop
                if (prev.totalValue === newTotalValue && 
                    prev.identifiedCount === (autoConfirmed.length + manualConfirmed.length) &&
                    prev.isHistorical === isHistorical) {
                    return prev;
                }
                
                return {
                    autoConfirmed: { count: autoConfirmed.length, value: autoConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0) },
                    manualConfirmed: { count: manualConfirmed.length, value: manualConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0) },
                    pending: { count: pending.length, value: pending.reduce((sum, r) => sum + r.transaction.amount, 0) },
                    identifiedCount: autoConfirmed.length + manualConfirmed.length,
                    unidentifiedCount: pending.length,
                    totalValue: newTotalValue,
                    valuePerChurch: Array.from(valuePerChurch.entries()).sort((a, b) => b[1] - a[1]),
                    isHistorical,
                    methodBreakdown
                };
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [resultsHash, reportsHash, initialDataLoaded]);

    // --- 5. Handlers ---

    const handleBackToSettings = useCallback(() => setActiveView('upload'), [setActiveView]);

    const resetApplicationData = useCallback(async () => {
        if (!user) return;
        
        await Promise.all([
            supabase.from('banks').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
            supabase.from('churches').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
            supabase.from('saved_reports').delete().eq('user_id', user.id)
        ]);

        referenceData.setChurches([]);
        referenceData.setBanks([]);
        reportManager.setSavedReports([]);
        referenceData.setLearnedAssociations([]);
        reconciliation.clearUploadedFiles();
        reconciliation.clearMatchResults();
        referenceData.setSimilarityLevel(80);
        referenceData.setDayTolerance(2);
        showToast("Todos os dados da aplicação foram redefinidos.", 'success');
    }, [user, referenceData, reportManager, reconciliation, showToast]);

    const openDeleteConfirmation = useCallback((item: DeletingItem) => setDeletingItem(item), []);
    const closeDeleteConfirmation = useCallback(() => setDeletingItem(null), []);

    const confirmDeletion = useCallback(async () => {
        if (!deletingItem) return;
        
        if (deletingItem.type === 'report-row') {
             reconciliation.setReportPreviewData(prev => {
                 if (!prev) return null;
                 const newPreview = { ...prev };
                 const targetGroup = deletingItem.meta?.reportType === 'expenses' ? newPreview.expenses : newPreview.income;
                 Object.keys(targetGroup).forEach(key => {
                     targetGroup[key] = targetGroup[key].filter(r => r.transaction.id !== deletingItem.id);
                 });
                 return newPreview;
             });
             reconciliation.setMatchResults(prev => prev.filter(r => r.transaction.id !== deletingItem.id));
             showToast("Linha excluída com sucesso.", 'success');
        }
        else if (deletingItem.type === 'report-group') {
             reconciliation.setReportPreviewData(prev => {
                 if (!prev) return null;
                 const newPreview = { ...prev };
                 const targetGroup = deletingItem.meta?.reportType === 'expenses' ? newPreview.expenses : newPreview.income;
                 if (targetGroup[deletingItem.id]) {
                     const idsToRemove = targetGroup[deletingItem.id].map(r => r.transaction.id);
                     delete targetGroup[deletingItem.id];
                     reconciliation.setMatchResults(prevResults => prevResults.filter(r => !idsToRemove.includes(r.transaction.id)));
                 }
                 return newPreview;
             });
             showToast("Grupo excluído com sucesso.", 'success');
        }
        else if (deletingItem.type === 'bank') {
            if(!user) return;
            referenceData.setBanks(prev => prev.filter(b => b.id !== deletingItem.id));
            await supabase.from('banks').delete().eq('id', deletingItem.id);
            showToast('Banco excluído.', 'success');
        } else if (deletingItem.type === 'church') {
            if(!user) return;
            referenceData.setChurches(prev => prev.filter(c => c.id !== deletingItem.id));
            await supabase.from('churches').delete().eq('id', deletingItem.id);
            showToast('Igreja excluída.', 'success');
        } else if (deletingItem.type === 'report-saved') {
            if(!user) return;
            reportManager.setSavedReports(prev => prev.filter(r => r.id !== deletingItem.id));
            await supabase.from('saved_reports').delete().eq('id', deletingItem.id);
            showToast('Relatório excluído.', 'success');
        } else if (deletingItem.type === 'uploaded-files') {
            reconciliation.clearUploadedFiles();
        } else if (deletingItem.type === 'match-results') {
            reconciliation.clearMatchResults();
        } else if (deletingItem.type === 'learned-associations') {
            if(!user) return;
            referenceData.setLearnedAssociations([]);
            await supabase.from('learned_associations').delete().eq('user_id', user.id);
            showToast('Associações aprendidas removidas.', 'success');
        } else if (deletingItem.type === 'all-data') {
            resetApplicationData();
        }
        closeDeleteConfirmation();
    }, [deletingItem, user, referenceData, reportManager, reconciliation, showToast, resetApplicationData, closeDeleteConfirmation]);

    const viewSavedReport = useCallback((reportId: string) => {
        const report = reportManager.savedReports.find(r => r.id === reportId);
        
        // Validation
        if (!report) {
            showToast("Relatório não encontrado.", 'error');
            return;
        }
        
        // Robust check for data integrity
        if (!report.data || !Array.isArray(report.data.results)) {
             console.error("Saved report data corrupted:", report);
             showToast("Este relatório não contém dados válidos ou está corrompido.", 'error');
             return;
        }

        try {
            const rawResults = report.data.results;
            
            // Filter out any potential malformed records that could crash the app
            // And inject default values for missing objects (like church)
            const validResults = rawResults
                .filter(r => r && r.transaction && typeof r.transaction === 'object')
                .map(r => ({
                    ...r,
                    // Ensure church exists to prevent render crashes accessing church.name
                    church: r.church || { ...PLACEHOLDER_CHURCH, name: 'Igreja Desconhecida (Histórico)' },
                    status: r.status || 'NÃO IDENTIFICADO',
                    transaction: {
                        ...r.transaction,
                        amount: Number(r.transaction.amount) || 0
                    },
                    // Ensure contributor exists if identified
                    contributor: r.contributor || null
                }));

            const incomeResults = validResults.filter(r => (r.transaction.amount || 0) > 0);
            const expenseResults = validResults.filter(r => (r.transaction.amount || 0) < 0);
            
            const previewData: { income: GroupedReportData; expenses: GroupedReportData } = {
                income: groupResultsByChurch(incomeResults),
                expenses: {}
            };

            if (expenseResults.length > 0) {
                previewData.expenses = { 'all_expenses_group': expenseResults };
            }

            // Important: Set results AND preview data
            reconciliation.setMatchResults(validResults);
            reconciliation.setReportPreviewData(previewData);
            reconciliation.setHasActiveSession(true);

            // HYDRATE FILES FOR RE-COMPARISON (NEW FEATURE)
            if (report.data.bankStatementFile) {
                reconciliation.setBankStatementFile(report.data.bankStatementFile);
            }
            if (report.data.sourceFiles && Array.isArray(report.data.sourceFiles)) {
                // Ensure type safety when mapping
                const sourceFilesHydrated = report.data.sourceFiles.map((sf: any) => ({
                    churchId: sf.churchId,
                    content: sf.content,
                    fileName: sf.fileName
                }));
                reconciliation.setContributorFiles(sourceFilesHydrated);
            }

            // Redirect immediately
            setActiveView('reports'); 
        } catch (error) {
            console.error("Erro ao abrir relatório:", error);
            showToast("Erro crítico ao processar os dados do relatório.", 'error');
        }
    }, [reportManager.savedReports, reconciliation, setActiveView, showToast]);

    const openPaymentModal = useCallback(() => setIsPaymentModalOpen(true), []);
    const closePaymentModal = useCallback(() => setIsPaymentModalOpen(false), []);

    // Recompare Modal Controls
    const openRecompareModal = useCallback(() => setIsRecompareModalOpen(true), []);
    const closeRecompareModal = useCallback(() => setIsRecompareModalOpen(false), []);

    // --- Unified Manual Identification Logic ---
    // Helper to find transaction anywhere
    const findMatchResult = useCallback((transactionId: string): MatchResult | undefined => {
        // 1. Try Current Session
        const current = reconciliation.matchResults.find(r => r.transaction.id === transactionId);
        if (current) return current;

        // 2. Try Saved Reports
        return reportManager.allHistoricalResults.find(r => r.transaction.id === transactionId);
    }, [reconciliation.matchResults, reportManager.allHistoricalResults]);

    // Override openManualIdentify to search globally
    const openManualIdentify = useCallback((transactionId: string) => {
        const result = findMatchResult(transactionId);
        if (result) {
            reconciliation.setManualIdentificationTx(result.transaction);
        }
    }, [findMatchResult, reconciliation]);

    // Override confirmManualIdentification to update the correct source
    const confirmManualIdentification = useCallback((transactionId: string, churchId: string) => {
        const church = referenceData.churches.find(c => c.id === churchId);
        const result = findMatchResult(transactionId);
        
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
            
            // Check where it belongs and update accordingly
            const isInCurrent = reconciliation.matchResults.some(r => r.transaction.id === transactionId);
            
            if (isInCurrent) {
                reconciliation.updateReportData(updatedRow, 'income');
            } else {
                reportManager.updateSavedReportTransaction(transactionId, updatedRow);
            }

            reconciliation.closeManualIdentify();
            showToast('Identificação manual realizada.', 'success');
        }
    }, [referenceData.churches, findMatchResult, reconciliation, reportManager, showToast]);


    // --- 6. Provider Value ---
    const value = useMemo(() => ({
        // Reference Data
        ...referenceData,
        // Reconciliation
        ...reconciliation,
        isCompareDisabled: !reconciliation.bankStatementFile,
        openManualIdentify, // Override with global version
        confirmManualIdentification, // Override with global version
        findMatchResult, // Helper
        // Reports
        ...reportManager,
        viewSavedReport,
        // Handlers overrides/extras
        handleBackToSettings,
        // UI Globals
        deletingItem, openDeleteConfirmation, closeDeleteConfirmation, confirmDeletion,
        initialDataLoaded, summary,
        isPaymentModalOpen, openPaymentModal, closePaymentModal,
        isRecompareModalOpen, openRecompareModal, closeRecompareModal
    }), [
        referenceData, reconciliation, reportManager, 
        viewSavedReport, handleBackToSettings, 
        deletingItem, openDeleteConfirmation, closeDeleteConfirmation, confirmDeletion,
        initialDataLoaded, summary, 
        isPaymentModalOpen, openPaymentModal, closePaymentModal,
        isRecompareModalOpen, openRecompareModal, closeRecompareModal,
        openManualIdentify, confirmManualIdentification, findMatchResult
    ]);

    return (
        <AppContext.Provider value={value}>
            {children}
            <RecompareModal />
        </AppContext.Provider>
    );
};
