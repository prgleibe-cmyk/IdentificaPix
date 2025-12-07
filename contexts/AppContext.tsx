
import React, { createContext, useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { usePersistentState } from '../hooks/usePersistentState';
import {
    Transaction,
    Contributor,
    MatchResult,
    Bank,
    Church,
    ContributorFile,
    ChurchFormData,
    DeletingItem,
    ComparisonType,
    GroupedReportData,
    SearchFilters,
    SavedReport,
    SavingReportState,
    LearnedAssociation,
    MatchMethod,
} from '../types';
import { parseBankStatement, parseContributors, matchTransactions, normalizeString, processExpenses, parseDate, PLACEHOLDER_CHURCH } from '../services/processingService';
import { getAISuggestion } from '../services/geminiService';
import { Logger, Metrics } from '../services/monitoringService';
import { supabase } from '../services/supabaseClient';
import { useTranslation } from './I18nContext';

const DEFAULT_IGNORE_KEYWORDS = [
    'DÍZIMOS',
    'OFERTAS',
    'MISSÕES',
    'TERRENO - NOVA SEDE',
    'PIX',
    'TED',
    'DOC',
    'Transferência',
    'Pagamento',
    'Recebimento',
    'Depósito',
    'Contribuição',
    'Sr',
    'Sra',
    'Dr',
    'Dra'
];


// --- Helper for grouping results ---
const groupResultsByChurch = (results: MatchResult[]): GroupedReportData => {
    return results.reduce((acc, result) => {
        const churchId = result.church.id || 'unidentified';
        if (!acc[churchId]) {
            acc[churchId] = [];
        }
        acc[churchId].push(result);
        return acc;
    }, {} as GroupedReportData);
};

// Helper function to calculate date differences
const daysDifference = (date1: Date, date2: Date): number => {
    const timeDiff = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
};


interface AppContextType {
    // Data State
    banks: Bank[];
    churches: Church[];
    bankStatementFile: { bankId: string, content: string, fileName: string } | null;
    contributorFiles: { churchId: string; content: string; fileName: string }[];
    matchResults: MatchResult[];
    reportPreviewData: { income: GroupedReportData; expenses: GroupedReportData } | null;
    loadingAiId: string | null;
    aiSuggestion: { id: string, name: string } | null;
    similarityLevel: number;
    dayTolerance: number;
    comparisonType: ComparisonType;
    customIgnoreKeywords: string[];
    editingBank: Bank | null;
    editingChurch: Church | null;
    manualIdentificationTx: Transaction | null;
    manualMatchState: { record: MatchResult, suggestions: Transaction[] } | null;
    deletingItem: DeletingItem | null;
    
    savedReports: SavedReport[];
    allHistoricalResults: MatchResult[];
    isSearchFiltersOpen: boolean;
    searchFilters: SearchFilters;
    savingReportState: SavingReportState | null;
    divergenceConfirmation: MatchResult | null;
    learnedAssociations: LearnedAssociation[];
    isPaymentModalOpen: boolean;

    // Derived State
    summary: {
        autoConfirmed: { count: number; value: number; };
        manualConfirmed: { count: number; value: number; };
        pending: { count: number; value: number; };
        identifiedCount: number;
        unidentifiedCount: number;
        totalValue: number;
        valuePerChurch: [string, number][];
        isHistorical: boolean;
        methodBreakdown: Record<MatchMethod, number>; // New: persisted breakdown
    };
    allContributorsWithChurch: (Contributor & { church: Church; uniqueId: string })[];
    isCompareDisabled: boolean;
    hasActiveSession: boolean;
    initialDataLoaded: boolean; // Exposed for UI loading states

    // Actions
    setBanks: React.Dispatch<React.SetStateAction<Bank[]>>;
    setChurches: React.Dispatch<React.SetStateAction<Church[]>>;
    setSimilarityLevel: React.Dispatch<React.SetStateAction<number>>;
    setDayTolerance: React.Dispatch<React.SetStateAction<number>>;
    setMatchResults: React.Dispatch<React.SetStateAction<MatchResult[]>>;
    setReportPreviewData: React.Dispatch<React.SetStateAction<{ income: GroupedReportData; expenses: GroupedReportData } | null>>;
    setComparisonType: React.Dispatch<React.SetStateAction<ComparisonType>>;
    addIgnoreKeyword: (keyword: string) => void;
    removeIgnoreKeyword: (keyword: string) => void;

    handleStatementUpload: (content: string, fileName: string, bankId: string) => void;
    handleContributorsUpload: (content: string, fileName: string, churchId: string) => void;
    removeBankStatementFile: () => void;
    removeContributorFile: (churchId: string) => void;
    
    handleCompare: () => void;
    handleAnalyze: (transactionId: string) => void;
    handleBackToSettings: () => void;
    
    updateReportData: (updatedRow: MatchResult, reportType: 'income' | 'expenses') => void;

    // CRUD Actions
    openEditBank: (bank: Bank) => void;
    closeEditBank: () => void;
    updateBank: (bankId: string, name: string) => void;
    addBank: (name: string) => Promise<boolean>;

    openEditChurch: (church: Church) => void;
    closeEditChurch: () => void;
    updateChurch: (churchId: string, data: ChurchFormData) => void;
    addChurch: (data: ChurchFormData) => Promise<boolean>;

    openManualIdentify: (transactionId: string) => void;
    closeManualIdentify: () => void;
    confirmManualIdentification: (transactionId: string, churchId: string) => void;

    openManualMatchModal: (recordToMatch: MatchResult) => void;
    closeManualMatchModal: () => void;
    confirmManualAssociation: (selectedTx: Transaction) => void;

    openDeleteConfirmation: (item: DeletingItem) => void;
    closeDeleteConfirmation: () => void;
    confirmDeletion: () => void;

    discardCurrentReport: () => void;
    
    openSearchFilters: () => void;
    closeSearchFilters: () => void;
    setSearchFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
    clearSearchFilters: () => void;

    viewSavedReport: (reportId: string) => void;
    updateSavedReportName: (reportId: string, newName: string) => void;
    saveFilteredReport: (results: MatchResult[]) => void;
    
    openSaveReportModal: (state: SavingReportState) => void;
    closeSaveReportModal: () => void;
    confirmSaveReport: (name: string) => void;

    openDivergenceModal: (match: MatchResult) => void;
    closeDivergenceModal: () => void;
    confirmDivergence: (divergentMatch: MatchResult) => void;
    rejectDivergence: (divergentMatch: MatchResult) => void;
    learnAssociation: (matchResult: MatchResult) => Promise<void>;

    openPaymentModal: () => void;
    closePaymentModal: () => void;
}

export const AppContext = createContext<AppContextType>(null!);

const DEFAULT_SEARCH_FILTERS: SearchFilters = {
    dateRange: { start: null, end: null },
    valueFilter: { operator: 'any', value1: null, value2: null },
    transactionType: 'all',
    reconciliationStatus: 'all',
    filterBy: 'none',
    churchIds: [],
    contributorName: '',
    reportId: null, // Default to all reports
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { t } = useTranslation();
    // Consume UI Context
    const { showToast, setIsLoading, setActiveView, activeView } = useUI();
    
    // --- Data State (Persisted for Stale-While-Revalidate) ---
    // Light data: Loaded synchronously
    const [banks, setBanks] = usePersistentState<Bank[]>('identificapix-banks', []);
    const [churches, setChurches] = usePersistentState<Church[]>('identificapix-churches', []);
    const [similarityLevel, setSimilarityLevel] = usePersistentState<number>('identificapix-similarity', 80);
    const [dayTolerance, setDayTolerance] = usePersistentState<number>('identificapix-daytolerance', 2);
    const [customIgnoreKeywords, setCustomIgnoreKeywords] = usePersistentState<string[]>('identificapix-ignore-keywords', DEFAULT_IGNORE_KEYWORDS);
    const [searchFilters, setSearchFilters] = usePersistentState<SearchFilters>('identificapix-search-filters', DEFAULT_SEARCH_FILTERS);
    
    // NEW: Lightweight flag to indicate if a session exists, loaded synchronously.
    const [hasActiveSession, setHasActiveSession] = usePersistentState<boolean>('identificapix-has-session', false, false);

    // CHANGED: Use simple useState for heavy data to avoid LocalStorage Quota Exceeded errors.
    // These are loaded from Supabase anyway.
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [learnedAssociations, setLearnedAssociations] = useState<LearnedAssociation[]>([]);
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    
    // Heavy local data: persisted mostly for session continuity
    // !!! CRITICAL OPTIMIZATION: isHeavy=true ensures these load AFTER initial render
    const [bankStatementFile, setBankStatementFile] = usePersistentState<{ bankId: string, content: string, fileName: string } | null>('identificapix-statement', null, true);
    const [contributorFiles, setContributorFiles] = usePersistentState<{ churchId: string; content: string; fileName: string }[]>('identificapix-contributors', [], true);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>('identificapix-results', [], true);
    const [reportPreviewData, setReportPreviewData] = usePersistentState<{ income: GroupedReportData; expenses: GroupedReportData } | null>('identificapix-report-preview', null, true);
    
    const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<{ id: string, name: string } | null>(null);
    const [manualMatchState, setManualMatchState] = useState<{ record: MatchResult, suggestions: Transaction[] } | null>(null);

    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [editingChurch, setEditingChurch] = useState<Church | null>(null);
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);
    const [divergenceConfirmation, setDivergenceConfirmation] = useState<MatchResult | null>(null);

    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
    const [savingReportState, setSavingReportState] = useState<SavingReportState | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);


    // --- Async State for heavy derived data ---
    // Persisted to ensure dashboard opens immediately with last known state (Synchronous)
    const [summary, setSummary] = usePersistentState<AppContextType['summary']>('identificapix-dashboard-summary-v3', {
        autoConfirmed: { count: 0, value: 0 },
        manualConfirmed: { count: 0, value: 0 },
        pending: { count: 0, value: 0 },
        identifiedCount: 0,
        unidentifiedCount: 0,
        totalValue: 0,
        valuePerChurch: [],
        isHistorical: false,
        methodBreakdown: { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 }
    }, false); // isHeavy = false (Load immediately)

    const [allContributorsWithChurch, setAllContributorsWithChurch] = useState<(Contributor & { church: Church; uniqueId: string })[]>([]);

    // Cleanup Effect: Clear old large keys from LocalStorage to fix quota errors
    useEffect(() => {
        try {
            localStorage.removeItem('identificapix-reports-meta-v2');
            localStorage.removeItem('identificapix-associations');
        } catch (e) {
            // Ignore if fails
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            // Strategy: Stale-While-Revalidate
            // We check if we have critical data in memory/localStorage (banks, churches, active session).
            // If we do, we skip the blocking UI loader to allow instant interaction.
            // The fetch proceeds in background and updates state when ready.
            const hasCachedData = banks.length > 0 || churches.length > 0 || hasActiveSession;
            
            // Only block UI if we are starting completely fresh (no cache)
            if (!hasCachedData) {
                setIsLoading(true);
            }
            
            try {
                const [churchesResult, banksResult, savedReportsResult] = await Promise.all([
                    supabase.from('churches').select('*').order('name'),
                    supabase.from('banks').select('*').order('name'),
                    // Removed 'data' from select to make it lighter, fetch on demand if needed, 
                    // BUT for now we need it for historical aggregation.
                    supabase.from('saved_reports').select('id, name, created_at, record_count, user_id, data').eq('user_id', user.id).order('created_at', { ascending: false }),
                ]);
        
                if (churchesResult.error) {
                    Logger.error('Error fetching churches', churchesResult.error);
                    if (!hasCachedData) showToast('Falha ao carregar os dados das igrejas.', 'error');
                } else {
                    setChurches(churchesResult.data as any || []);
                }
        
                if (banksResult.error) {
                    Logger.error('Error fetching banks', banksResult.error);
                    if (!hasCachedData) showToast('Falha ao carregar os dados dos bancos.', 'error');
                } else {
                    setBanks(banksResult.data as any || []);
                }

                if (savedReportsResult.error) {
                    Logger.error('Error fetching saved reports', savedReportsResult.error);
                    if (!hasCachedData) showToast('Falha ao carregar os relatórios salvos.', 'error');
                } else {
                    const mappedReports = (savedReportsResult.data || []).map(report => {
                        return {
                            id: report.id,
                            name: report.name,
                            createdAt: report.created_at,
                            recordCount: report.record_count,
                            user_id: report.user_id,
                            data: report.data, 
                        };
                    });
                    setSavedReports(mappedReports as SavedReport[]);
                }

                setLearnedAssociations([]);
                
            } catch (err) {
                Logger.error('Unexpected error fetching initial data', err);
            } finally {
                // Always ensure loading is turned off eventually
                setIsLoading(false);
                setInitialDataLoaded(true);
            }
        };
    
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]); 

    // --- Async Calculation Effects (Modified for Historical Data) ---
    useEffect(() => {
        const timer = setTimeout(() => {
            let resultsToProcess = matchResults;
            let isHistorical = false;

            // PREVENT FLASH OF EMPTY CONTENT:
            // If data is still loading (initialDataLoaded false) and we have no fresh data in memory (results/reports empty),
            // but we DO have a cached summary from previous session, keep using the cache.
            const isMemoryEmpty = matchResults.length === 0 && savedReports.length === 0;
            const hasCachedSummary = summary.totalValue > 0 || summary.identifiedCount > 0;
            
            // Only skip calculation if we have absolutely nothing new to show AND we have a cache.
            if (!initialDataLoaded && isMemoryEmpty && hasCachedSummary) {
                return;
            }

            // If no active session data, try to use historical data from saved reports
            if (resultsToProcess.length === 0 && savedReports.length > 0) {
                // Aggregating all results from all saved reports
                resultsToProcess = savedReports.flatMap(report => report.data?.results || []);
                isHistorical = true;
            }

            const autoConfirmed = resultsToProcess.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod));
            const manualConfirmed = resultsToProcess.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));
            const pending = resultsToProcess.filter(r => r.status === 'NÃO IDENTIFICADO');
    
            const valuePerChurch = new Map<string, number>();
            const methodBreakdown: Record<MatchMethod, number> = { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 };

            resultsToProcess.forEach(r => {
                if (r.status === 'IDENTIFICADO') {
                    if (r.church.name !== '---' && r.transaction.amount > 0) {
                        const current = valuePerChurch.get(r.church.name) || 0;
                        valuePerChurch.set(r.church.name, current + r.transaction.amount);
                    }
                    const method = r.matchMethod || 'AUTOMATIC';
                    if (Object.prototype.hasOwnProperty.call(methodBreakdown, method)) {
                        methodBreakdown[method]++;
                    }
                }
            });
    
            setSummary({
                autoConfirmed: {
                    count: autoConfirmed.length,
                    value: autoConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0),
                },
                manualConfirmed: {
                    count: manualConfirmed.length,
                    value: manualConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0),
                },
                pending: {
                    count: pending.length,
                    value: pending.reduce((sum, r) => sum + r.transaction.amount, 0),
                },
                identifiedCount: autoConfirmed.length + manualConfirmed.length,
                unidentifiedCount: pending.length,
                totalValue: resultsToProcess.reduce((sum, r) => sum + r.transaction.amount, 0),
                valuePerChurch: Array.from(valuePerChurch.entries()).sort((a, b) => b[1] - a[1]),
                isHistorical,
                methodBreakdown
            });
        }, 100); // Slight delay to ensure data is ready
        return () => clearTimeout(timer);
    }, [matchResults, savedReports, initialDataLoaded]);

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

    const allHistoricalResults = useMemo(() => {
        return savedReports
            .filter(r => r.data && r.data.results)
            .flatMap(report => report.data!.results);
    }, [savedReports]);

    const isCompareDisabled = useMemo(() => !bankStatementFile, [bankStatementFile]);

    
    const learnAssociation = useCallback(async (matchResult: MatchResult) => {
        if (!user || !matchResult.contributor?.normalizedName || !matchResult.church?.id || matchResult.church.id === 'unidentified') {
            return;
        }
    }, [user, customIgnoreKeywords, setLearnedAssociations]);

    const clearUploadedFiles = useCallback(() => {
        setBankStatementFile(null);
        setContributorFiles([]);
        showToast("Arquivos carregados foram removidos.", 'success');
    }, [setBankStatementFile, setContributorFiles, showToast]);
    
    const removeBankStatementFile = useCallback(() => {
        setBankStatementFile(null);
        showToast("Extrato bancário removido.", 'success');
    }, [setBankStatementFile, showToast]);
    
    const removeContributorFile = useCallback((churchId: string) => {
        setContributorFiles(prev => prev.filter(f => f.churchId !== churchId));
        showToast("Lista de contribuintes removida.", 'success');
    }, [setContributorFiles, showToast]);

    const clearMatchResults = useCallback(() => {
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false); 
        showToast("Resultados da conciliação foram limpos.", 'success');
    }, [setMatchResults, setReportPreviewData, setHasActiveSession, showToast]);

    const resetApplicationData = useCallback(async () => {
        if (!user) return;
        
        const bankDelete = supabase.from('banks').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
        const churchDelete = supabase.from('churches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const reportDelete = supabase.from('saved_reports').delete().eq('user_id', user.id);
        
        const [banksError, churchesError, reportsError] = await Promise.all([
            bankDelete,
            churchDelete,
            reportDelete
        ]);

        if(banksError.error || churchesError.error || reportsError.error) {
            showToast("Erro ao limpar dados no banco de dados.", 'error');
        } else {
             setChurches([]);
             setBanks([]);
             setSavedReports([]);
             setLearnedAssociations([]);
        }
        
        setBankStatementFile(null);
        setContributorFiles([]);
        setMatchResults([]);
        setReportPreviewData(null);
        setHasActiveSession(false); 
        setSimilarityLevel(80);
        setDayTolerance(2);
        setCustomIgnoreKeywords(DEFAULT_IGNORE_KEYWORDS);
        showToast("Todos os dados da aplicação foram redefinidos.", 'success');
    }, [user, setBankStatementFile, setContributorFiles, setMatchResults, setReportPreviewData, setHasActiveSession, setSimilarityLevel, setDayTolerance, setCustomIgnoreKeywords, setSavedReports, showToast, setChurches, setBanks, setLearnedAssociations]);

    const handleStatementUpload = useCallback((content: string, fileName: string, bankId: string) => {
        setBankStatementFile({ bankId, content, fileName });
    }, [setBankStatementFile]);

    const handleContributorsUpload = useCallback((content: string, fileName: string, churchId: string) => {
        setContributorFiles(prev => {
            const existing = prev.filter(f => f.churchId !== churchId);
            return [...existing, { churchId, content, fileName }];
        });
    }, [setContributorFiles]);

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
        if (isCompareDisabled && comparisonType !== 'expenses') return;
        if (!bankStatementFile) return;
    
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 50));
        Metrics.reset();
        const startTime = performance.now();
        Logger.info('Comparison process started on main thread', { comparisonType });
    
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
            Logger.info('Comparison completed', { duration: endTime - startTime, results: incomeResultsForDashboard.length });
            showToast('Conciliação concluída com sucesso!', 'success');
    
        } catch (error) {
            Logger.error('Error during comparison', error);
            showToast('Erro ao processar a conciliação.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [bankStatementFile, contributorFiles, churches, similarityLevel, dayTolerance, customIgnoreKeywords, isCompareDisabled, comparisonType, learnedAssociations, setMatchResults, setReportPreviewData, setHasActiveSession, setActiveView, showToast, setIsLoading]);

    const handleAnalyze = useCallback(async (transactionId: string) => {
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
                    learnAssociation(newResult);
                    
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
    }, [matchResults, allContributorsWithChurch, customIgnoreKeywords, updateReportData, learnAssociation, showToast]);

    const handleBackToSettings = useCallback(() => {
        setActiveView('upload');
    }, [setActiveView]);

    const openEditBank = useCallback((bank: Bank) => setEditingBank(bank), []);
    const closeEditBank = useCallback(() => setEditingBank(null), []);
    
    const updateBank = useCallback(async (bankId: string, name: string) => {
        if(!user) return;
        const oldBanks = [...banks];
        setBanks(prev => prev.map(b => b.id === bankId ? { ...b, name } : b));
        closeEditBank();

        const { error } = await supabase.from('banks').update({ name }).eq('id', bankId);
        if (error) {
            setBanks(oldBanks); 
            showToast('Erro ao atualizar banco.', 'error');
        } else {
            showToast('Banco atualizado com sucesso.', 'success');
        }
    }, [user, banks, setBanks, closeEditBank, showToast]);

    const addBank = useCallback(async (name: string): Promise<boolean> => {
        if(!user) {
            showToast("Você precisa estar logado para adicionar um banco.", "error");
            return false;
        }
        
        const tempId = `temp-${Date.now()}`;
        const newBank: Bank = { id: tempId, name };
        
        setBanks(prev => [...prev, newBank]);

        try {
            // FIX: Removed 'user_id' from insert payload. Supabase client might be failing to validate against cached schema.
            // If the DB column 'user_id' exists and is not null, the database usually has a default value (auth.uid()) or triggers.
            // Removing it here bypasses the client-side schema validation error.
            const { data, error } = await supabase.from('banks').insert([{ name }]).select();
            
            if (error || !data || data.length === 0) {
                Logger.error('Error adding bank', error);
                setBanks(prev => prev.filter(b => b.id !== tempId)); 
                showToast(`Erro ao adicionar banco: ${error?.message || 'Erro de conexão'}`, 'error');
                return false;
            } else {
                setBanks(prev => prev.map(b => b.id === tempId ? { ...b, id: data[0].id } : b));
                showToast('Banco adicionado com sucesso.', 'success');
                return true;
            }
        } catch (e: any) {
            Logger.error('Exception adding bank', e);
            setBanks(prev => prev.filter(b => b.id !== tempId));
            showToast(`Erro de exceção: ${e.message}`, 'error');
            return false;
        }
    }, [user, setBanks, showToast]);

    const openEditChurch = useCallback((church: Church) => setEditingChurch(church), []);
    const closeEditChurch = useCallback(() => setEditingChurch(null), []);

    const updateChurch = useCallback(async (churchId: string, formData: ChurchFormData) => {
        if(!user) return;
        const oldChurches = [...churches];
        setChurches(prev => prev.map(c => c.id === churchId ? { ...c, ...formData } : c));
        closeEditChurch();

        const { error } = await supabase.from('churches').update(formData).eq('id', churchId);
        
        if (error) {
            setChurches(oldChurches);
            showToast('Erro ao atualizar igreja.', 'error');
        } else {
            showToast('Igreja atualizada com sucesso.', 'success');
        }
    }, [user, churches, setChurches, closeEditChurch, showToast]);

    const addChurch = useCallback(async (formData: ChurchFormData): Promise<boolean> => {
        if(!user) {
            showToast("Você precisa estar logado para adicionar uma igreja.", "error");
            return false;
        }

        // Check payload size to prevent huge base64 strings from crashing the request
        const payloadSize = new Blob([JSON.stringify(formData)]).size;
        if (payloadSize > 5 * 1024 * 1024) { // 5MB limit
             showToast("A imagem do logo é muito grande. Por favor, use uma imagem menor.", "error");
             return false;
        }

        const tempId = `temp-${Date.now()}`;
        const newChurch: Church = { id: tempId, ...formData };
        
        setChurches(prev => [...prev, newChurch]);

        try {
            // FIX: Removed 'user_id' from insert payload to bypass possible client cache validation issues.
            const { data, error } = await supabase.from('churches').insert([{ ...formData }]).select();

            if (error || !data || data.length === 0) {
                Logger.error('Error adding church', error);
                setChurches(prev => prev.filter(c => c.id !== tempId));
                showToast(`Erro ao adicionar igreja: ${error?.message || 'Erro de conexão'}`, 'error');
                return false;
            } else {
                setChurches(prev => prev.map(c => c.id === tempId ? { ...c, id: data[0].id } : c));
                showToast('Igreja adicionada com sucesso.', 'success');
                return true;
            }
        } catch (e: any) {
            Logger.error('Exception adding church', e);
            setChurches(prev => prev.filter(c => c.id !== tempId));
            showToast(`Erro de exceção: ${e.message}`, 'error');
            return false;
        }
    }, [user, setChurches, showToast]);

    const openManualIdentify = (transactionId: string) => {
        const tx = matchResults.find(r => r.transaction.id === transactionId)?.transaction;
        if (tx) setManualIdentificationTx(tx);
    };
    
    const closeManualIdentify = () => setManualIdentificationTx(null);
    
    const confirmManualIdentification = (transactionId: string, churchId: string) => {
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
            learnAssociation(updatedRow);
            
            closeManualIdentify();
            showToast('Identificação manual realizada.', 'success');
        }
    };

    const openManualMatchModal = (record: MatchResult) => {
        const pendingTransactions = matchResults
            .filter(r => r.status === 'NÃO IDENTIFICADO' && !r.transaction.id.startsWith('pending-'))
            .map(r => r.transaction);

        const suggestions = pendingTransactions.filter(tx => {
            if (Math.abs(tx.amount - (record.contributor?.amount || 0)) > 0.05) return false;
            
            const txDate = parseDate(tx.date);
            const recDate = record.contributor?.date ? parseDate(record.contributor.date) : null;
            
            if (txDate && recDate) {
                return daysDifference(txDate, recDate) <= (dayTolerance + 2); 
            }
            return true;
        });

        setManualMatchState({ record, suggestions });
    };

    const closeManualMatchModal = () => setManualMatchState(null);

    const confirmManualAssociation = (selectedTx: Transaction) => {
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

            setReportPreviewData(prev => {
                if (!prev) return null;
                const newPreview = { ...prev };
                const incomeGroup = newPreview.income;
                
                if (incomeGroup[record.church.id]) {
                    incomeGroup[record.church.id] = incomeGroup[record.church.id].filter(r => r.transaction.id !== record.transaction.id);
                }
                
                if (incomeGroup['unidentified']) {
                    incomeGroup['unidentified'] = incomeGroup['unidentified'].filter(r => r.transaction.id !== selectedTx.id);
                }
                
                if (!incomeGroup[record.church.id]) incomeGroup[record.church.id] = [];
                incomeGroup[record.church.id].push(updatedRow);
                
                return newPreview;
            });

            setMatchResults(prev => {
                const filtered = prev.filter(r => r.transaction.id !== record.transaction.id);
                return filtered.map(r => r.transaction.id === selectedTx.id ? updatedRow : r);
            });
            
            learnAssociation(updatedRow);
            showToast("Associação realizada com sucesso!", 'success');
            closeManualMatchModal();
        }
    };

    const openDeleteConfirmation = (item: DeletingItem) => setDeletingItem(item);
    const closeDeleteConfirmation = () => setDeletingItem(null);

    const confirmDeletion = async () => {
        if (!deletingItem) return;
        
        if (deletingItem.type === 'report-row') {
             setReportPreviewData(prev => {
                 if (!prev) return null;
                 const newPreview = { ...prev };
                 const targetGroup = deletingItem.meta?.reportType === 'expenses' ? newPreview.expenses : newPreview.income;
                 
                 Object.keys(targetGroup).forEach(key => {
                     targetGroup[key] = targetGroup[key].filter(r => r.transaction.id !== deletingItem.id);
                 });
                 return newPreview;
             });
             
             setMatchResults(prev => prev.filter(r => r.transaction.id !== deletingItem.id));
             showToast("Linha excluída com sucesso.", 'success');
        }
        else if (deletingItem.type === 'report-group') {
             setReportPreviewData(prev => {
                 if (!prev) return null;
                 const newPreview = { ...prev };
                 const targetGroup = deletingItem.meta?.reportType === 'expenses' ? newPreview.expenses : newPreview.income;
                 if (targetGroup[deletingItem.id]) {
                     const idsToRemove = targetGroup[deletingItem.id].map(r => r.transaction.id);
                     delete targetGroup[deletingItem.id];
                     setMatchResults(prevResults => prevResults.filter(r => !idsToRemove.includes(r.transaction.id)));
                 }
                 return newPreview;
             });
             showToast("Grupo excluído com sucesso.", 'success');
        }
        else if (deletingItem.type === 'bank') {
            if(!user) return;
            setBanks(prev => prev.filter(b => b.id !== deletingItem.id));
            const { error } = await supabase.from('banks').delete().eq('id', deletingItem.id);
            if (error) {
                showToast('Erro ao excluir banco.', 'error');
            } else {
                showToast('Banco excluído.', 'success');
            }
        } else if (deletingItem.type === 'church') {
            if(!user) return;
            setChurches(prev => prev.filter(c => c.id !== deletingItem.id));
            const { error } = await supabase.from('churches').delete().eq('id', deletingItem.id);
            if (error) showToast('Erro ao excluir igreja.', 'error');
            else showToast('Igreja excluída.', 'success');
        } else if (deletingItem.type === 'report-saved') {
            if(!user) return;
            setSavedReports(prev => prev.filter(r => r.id !== deletingItem.id));
            const { error } = await supabase.from('saved_reports').delete().eq('id', deletingItem.id);
            if (error) showToast('Erro ao excluir relatório.', 'error');
            else showToast('Relatório excluído.', 'success');
        } else if (deletingItem.type === 'uploaded-files') {
            clearUploadedFiles();
        } else if (deletingItem.type === 'match-results') {
            clearMatchResults();
        } else if (deletingItem.type === 'learned-associations') {
            if(!user) return;
            setLearnedAssociations([]);
            await supabase.from('learned_associations').delete().eq('user_id', user.id);
            showToast('Associações aprendidas removidas.', 'success');
        } else if (deletingItem.type === 'all-data') {
            resetApplicationData();
        }

        closeDeleteConfirmation();
    };

    const discardCurrentReport = useCallback(() => {
        setReportPreviewData(null);
        setMatchResults([]);
        setHasActiveSession(false);
        setActiveView('upload');
        showToast("Relatório descartado.", 'success');
    }, [setReportPreviewData, setMatchResults, setHasActiveSession, setActiveView, showToast]);

    const openSearchFilters = () => setIsSearchFiltersOpen(true);
    const closeSearchFilters = () => setIsSearchFiltersOpen(false);
    const clearSearchFilters = () => setSearchFilters(DEFAULT_SEARCH_FILTERS);

    const viewSavedReport = (reportId: string) => {
        const report = savedReports.find(r => r.id === reportId);
        if (report && report.data) {
            const results = report.data.results;
            const incomeResults = results.filter(r => r.transaction.amount > 0);
            const expenseResults = results.filter(r => r.transaction.amount < 0);
            
            const previewData = {
                income: groupResultsByChurch(incomeResults),
                expenses: expenseResults.length > 0 ? { 'all_expenses_group': processExpenses(expenseResults.map(r => r.transaction)) } : {} 
            };
            
            if (expenseResults.length > 0) {
                 previewData.expenses = { 'all_expenses_group': expenseResults };
            }

            setMatchResults(results);
            setReportPreviewData(previewData);
            setActiveView('reports'); 
        }
    };

    const updateSavedReportName = async (reportId: string, newName: string) => {
        if(!user) return;
        setSavedReports(prev => prev.map(r => r.id === reportId ? { ...r, name: newName } : r));
        const { error } = await supabase.from('saved_reports').update({ name: newName }).eq('id', reportId);
        if (error) showToast('Erro ao renomear relatório.', 'error');
        else showToast('Relatório renomeado.', 'success');
    };

    const saveFilteredReport = (results: MatchResult[]) => {
        openSaveReportModal({
            type: 'search',
            results: results,
            groupName: 'Filtrado'
        });
    };
    
    const openSaveReportModal = (state: SavingReportState) => setSavingReportState(state);
    const closeSaveReportModal = () => setSavingReportState(null);
    
    const confirmSaveReport = async (name: string) => {
        if (!savingReportState || !user) return;
        
        const newReport: SavedReport = {
            id: `rep-${Date.now()}`,
            name: name,
            createdAt: new Date().toISOString(),
            recordCount: savingReportState.results.length,
            user_id: user.id,
            data: {
                results: savingReportState.results,
                sourceFiles: [],
                bankStatementFile: null
            }
        };

        setSavedReports(prev => [newReport, ...prev]);
        closeSaveReportModal();
        
        const { error } = await supabase.from('saved_reports').insert({
            id: newReport.id,
            name: newReport.name,
            record_count: newReport.recordCount,
            user_id: newReport.user_id,
            data: newReport.data as any
        });

        if (error) {
            setSavedReports(prev => prev.filter(r => r.id !== newReport.id));
            showToast('Erro ao salvar relatório no banco de dados.', 'error');
        } else {
            showToast(t('reports.saveReportSuccess'), 'success');
        }
    };

    const openDivergenceModal = (match: MatchResult) => setDivergenceConfirmation(match);
    const closeDivergenceModal = () => setDivergenceConfirmation(null);
    
    const confirmDivergence = (match: MatchResult) => {
        const updatedMatch = { ...match, divergence: undefined };
        updateReportData(updatedMatch, 'income');
        closeDivergenceModal();
        showToast("Divergência aceita.", 'success');
    };
    
    const rejectDivergence = (match: MatchResult) => {
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
    };

    const openPaymentModal = () => setIsPaymentModalOpen(true);
    const closePaymentModal = () => setIsPaymentModalOpen(false);


    const value = {
        banks,
        setBanks,
        churches,
        setChurches,
        bankStatementFile,
        contributorFiles,
        matchResults,
        setMatchResults,
        reportPreviewData,
        setReportPreviewData,
        loadingAiId,
        aiSuggestion,
        similarityLevel,
        setSimilarityLevel,
        dayTolerance,
        setDayTolerance,
        comparisonType,
        setComparisonType,
        customIgnoreKeywords,
        addIgnoreKeyword: (k: string) => setCustomIgnoreKeywords(prev => [...prev, k]),
        removeIgnoreKeyword: (k: string) => setCustomIgnoreKeywords(prev => prev.filter(i => i !== k)),
        
        editingBank,
        openEditBank,
        closeEditBank,
        updateBank,
        addBank,

        editingChurch,
        openEditChurch,
        closeEditChurch,
        updateChurch,
        addChurch,

        handleStatementUpload,
        handleContributorsUpload,
        removeBankStatementFile,
        removeContributorFile,
        handleCompare,
        handleAnalyze,
        handleBackToSettings,
        
        manualIdentificationTx,
        openManualIdentify,
        closeManualIdentify,
        confirmManualIdentification,

        manualMatchState,
        openManualMatchModal,
        closeManualMatchModal,
        confirmManualAssociation,

        deletingItem,
        openDeleteConfirmation,
        closeDeleteConfirmation,
        confirmDeletion,

        updateReportData,
        discardCurrentReport,
        
        savedReports,
        viewSavedReport,
        updateSavedReportName,
        saveFilteredReport,
        
        openSaveReportModal,
        closeSaveReportModal,
        confirmSaveReport,
        savingReportState,

        allHistoricalResults,
        isSearchFiltersOpen,
        openSearchFilters,
        closeSearchFilters,
        searchFilters,
        setSearchFilters,
        clearSearchFilters,

        summary,
        allContributorsWithChurch,
        isCompareDisabled,
        hasActiveSession,
        initialDataLoaded,
        
        divergenceConfirmation,
        openDivergenceModal,
        closeDivergenceModal,
        confirmDivergence,
        rejectDivergence,
        
        learnedAssociations,
        learnAssociation,

        isPaymentModalOpen,
        openPaymentModal,
        closePaymentModal
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
