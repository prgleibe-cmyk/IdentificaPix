import React, { createContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { usePersistentState } from '../hooks/usePersistentState';
import {
    Transaction,
    Contributor,
    MatchResult,
    Bank,
    Church,
    ContributorFile,
    LearnedAssociation,
    ViewType,
    Theme,
    ChurchFormData,
    DeletingItem,
    ComparisonType,
    GroupedReportData,
    SavedReport,
    SavingReportState,
    SearchFilters,
} from '../types';
import { parseBankStatement, parseContributors, matchTransactions, normalizeString, processExpenses, cleanTransactionDescriptionForDisplay, parseDate, calculateNameSimilarity, PLACEHOLDER_CHURCH } from '../services/processingService';
import { getAISuggestion } from '../services/geminiService';
import { Logger, Metrics } from '../services/monitoringService';
import { supabase } from '../services/supabaseClient';
import { useTranslation } from './I18nContext';

// --- Feature Flag ---
const FEATURE_FLAGS = {
    useNewReconciliationPipeline: true,
};

const initialSearchFilters: SearchFilters = {
    dateRange: { start: null, end: null },
    valueFilter: { operator: 'any', value1: null, value2: null },
    churchIds: [],
    transactionType: 'all',
    reconciliationStatus: 'all',
    filterBy: 'none',
    contributorName: '',
};

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

// Helper function to calculate date differences, isolated here to avoid circular dependencies
const daysDifference = (date1: Date, date2: Date): number => {
    const timeDiff = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

// Helper function to rehydrate report data from DB format (with churchId) to app format (with full church object)
const rehydrateReportData = (data: any, allChurches: Church[]): GroupedReportData => {
    const savedData = data as Record<string, any[]>; // Simplified type for processing
    const rehydrated: GroupedReportData = {};
    for (const groupId in savedData) {
        if (!savedData[groupId]) continue;
        rehydrated[groupId] = savedData[groupId].map((result: any) => {
            const church = allChurches.find(c => c.id === result.churchId);
            const { churchId, ...rest } = result;
            return { ...rest, church: church || PLACEHOLDER_CHURCH };
        });
    }
    return rehydrated;
};


// --- Define the shape of the context state and actions ---
interface AppContextType {
    // State
    theme: Theme;
    banks: Bank[];
    churches: Church[];
    learnedAssociations: LearnedAssociation[];
    bankStatementFile: { bankId: string, content: string, fileName: string } | null;
    contributorFiles: { churchId: string; content: string; fileName: string }[];
    matchResults: MatchResult[]; // This will hold INCOME results for the dashboard
    reportPreviewData: { income: GroupedReportData; expenses: GroupedReportData } | null;
    savedReports: SavedReport[];
    activeView: ViewType;
    isLoading: boolean;
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
    toast: { message: string; type: 'success' | 'error' } | null;
    savingReportState: SavingReportState | null;
    isSearchFiltersOpen: boolean;
    searchFilters: SearchFilters;
    
    // Derived State
    summary: {
        autoConfirmed: { count: number; value: number; };
        manualConfirmed: { count: number; value: number; };
        pending: { count: number; value: number; };
        identifiedCount: number;
        unidentifiedCount: number;
        totalValue: number;
        valuePerChurch: [string, number][];
    };
    allContributorsWithChurch: (Contributor & { church: Church; uniqueId: string })[];
    isCompareDisabled: boolean;
    allHistoricalResults: MatchResult[];
    allHistoricalContributors: string[];

    // Actions
    toggleTheme: () => void;
    setActiveView: React.Dispatch<React.SetStateAction<ViewType>>;
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
    addBank: (name: string) => void;

    openEditChurch: (church: Church) => void;
    closeEditChurch: () => void;
    updateChurch: (churchId: string, data: ChurchFormData) => void;
    addChurch: (data: ChurchFormData) => void;

    openManualIdentify: (transactionId: string) => void;
    closeManualIdentify: () => void;
    confirmManualIdentification: (transactionId: string, churchId: string) => void;

    openManualMatchModal: (recordToMatch: MatchResult) => void;
    closeManualMatchModal: () => void;
    confirmManualAssociation: (selectedTx: Transaction) => void;

    openDeleteConfirmation: (item: DeletingItem) => void;
    closeDeleteConfirmation: () => void;
    confirmDeletion: () => void;

    // Report Actions
    saveCurrentReport: () => void;
    saveGroupReport: (groupId: string, groupName: string, results: MatchResult[], reportType: 'income' | 'expenses') => void;
    saveFilteredReport: (results: MatchResult[]) => void;
    confirmSaveReport: (name: string) => void;
    closeSaveReportModal: () => void;
    viewSavedReport: (reportId: string) => void;
    discardCurrentReport: () => void;

    // Search Filter Actions
    openSearchFilters: () => void;
    closeSearchFilters: () => void;
    setSearchFilters: (filters: SearchFilters) => void;
    clearSearchFilters: () => void;
    
    showToast: (message: string, type?: 'success' | 'error') => void;
}

// Create the context
export const AppContext = createContext<AppContextType>(null!);

// --- Provider Component ---
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { t, language } = useTranslation();
    
    // --- State Management ---
    const [theme, setTheme] = usePersistentState<Theme>('identificapix-theme', 'light');
    const [banks, setBanks] = useState<Bank[]>([]);
    const [churches, setChurches] = useState<Church[]>([]);
    const [learnedAssociations, setLearnedAssociations] = useState<LearnedAssociation[]>([]);
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    
    const [bankStatementFile, setBankStatementFile] = usePersistentState<{ bankId: string, content: string, fileName: string } | null>('identificapix-statement', null);
    const [contributorFiles, setContributorFiles] = usePersistentState<{ churchId: string; content: string; fileName: string }[]>('identificapix-contributors', []);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>('identificapix-results', []);
    const [reportPreviewData, setReportPreviewData] = usePersistentState<{ income: GroupedReportData; expenses: GroupedReportData } | null>('identificapix-report-preview', null);
    const [similarityLevel, setSimilarityLevel] = usePersistentState<number>('identificapix-similarity', 80);
    const [dayTolerance, setDayTolerance] = usePersistentState<number>('identificapix-daytolerance', 2);
    const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
    const [customIgnoreKeywords, setCustomIgnoreKeywords] = usePersistentState<string[]>('identificapix-ignore-keywords', DEFAULT_IGNORE_KEYWORDS);
    
    const [activeView, setActiveView] = useState<ViewType>('dashboard');
    const [isLoading, setIsLoading] = useState<boolean>(true); // Start as true to load initial data
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<{ id: string, name: string } | null>(null);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [manualMatchState, setManualMatchState] = useState<{ record: MatchResult, suggestions: Transaction[] } | null>(null);

    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [editingChurch, setEditingChurch] = useState<Church | null>(null);
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [savingReportState, setSavingReportState] = useState<SavingReportState | null>(null);
    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
    const [searchFilters, setSearchFiltersState] = useState<SearchFilters>(initialSearchFilters);


    // --- Effects ---
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            setIsLoading(true);
            const [churchesResult, banksResult, associationsResult, reportsResult] = await Promise.all([
                supabase.from('churches').select('*').eq('user_id', user.id).order('name'),
                supabase.from('banks').select('*').eq('user_id', user.id).order('name'),
                supabase.from('learned_associations').select('*').eq('user_id', user.id),
                supabase.from('saved_reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
            ]);
    
            const fetchedChurches = churchesResult.data || [];
            if (churchesResult.error) {
                Logger.error('Error fetching churches', churchesResult.error);
                showToast('Falha ao carregar os dados das igrejas.', 'error');
            } else {
                setChurches(fetchedChurches);
            }
    
            if (banksResult.error) {
                Logger.error('Error fetching banks', banksResult.error);
                showToast('Falha ao carregar os dados dos bancos.', 'error');
            } else {
                setBanks(banksResult.data || []);
            }

            if (associationsResult.error) {
                Logger.error('Error fetching learned associations', associationsResult.error);
                showToast('Falha ao carregar as associações aprendidas.', 'error');
            } else {
                setLearnedAssociations(associationsResult.data.map(item => ({
                    id: item.id,
                    normalizedDescription: item.normalized_description,
                    churchId: item.church_id,
                    contributorName: item.contributor_name,
                })) || []);
            }

            if (reportsResult.error) {
                Logger.error('Error fetching saved reports', reportsResult.error);
                showToast('Falha ao carregar os relatórios salvos.', 'error');
            } else {
                setSavedReports(reportsResult.data.map(item => ({
                    id: item.id,
                    name: item.name,
                    createdAt: item.created_at,
                    incomeData: rehydrateReportData(item.income_data, fetchedChurches),
                    expenseData: rehydrateReportData(item.expense_data, fetchedChurches),
                    recordCount: item.record_count,
                })) || []);
            }
    
            setIsLoading(false);
        };
    
        fetchData();
    }, [user, showToast]);

    // --- Memoized Derived State ---
    const summary = useMemo(() => {
        const allResultsFromSavedReports: MatchResult[] = savedReports.flatMap(report => 
            Object.values(report.incomeData).flat()
        );

        const stats = {
            autoConfirmed: { count: 0, value: 0 },
            manualConfirmed: { count: 0, value: 0 },
            pending: { count: 0, value: 0 },
            valuePerChurch: {} as Record<string, number>
        };
    
        for (const r of allResultsFromSavedReports) {
            if (r.status === 'IDENTIFICADO') {
                stats.valuePerChurch[r.church.name] = (stats.valuePerChurch[r.church.name] || 0) + r.transaction.amount;
                
                if (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI') {
                    stats.manualConfirmed.count += 1;
                    stats.manualConfirmed.value += r.transaction.amount;
                } else { // AUTOMATIC, LEARNED, or undefined defaults to auto
                    stats.autoConfirmed.count += 1;
                    stats.autoConfirmed.value += r.transaction.amount;
                }
            } else { // 'NÃO IDENTIFICADO'
                stats.pending.count += 1;
                const amount = r.contributorAmount ?? r.transaction.amount;
                stats.pending.value += amount;
            }
        }
    
        return {
            ...stats,
            identifiedCount: stats.autoConfirmed.count + stats.manualConfirmed.count,
            unidentifiedCount: stats.pending.count,
            totalValue: stats.autoConfirmed.value + stats.manualConfirmed.value,
            valuePerChurch: Object.entries(stats.valuePerChurch).sort(([, a], [, b]) => b - a),
        };
    }, [savedReports]);

    const allHistoricalResults = useMemo<MatchResult[]>(() => {
        return savedReports.flatMap(report => [
            ...Object.values(report.incomeData).flat(),
            ...Object.values(report.expenseData).flat()
        ]);
    }, [savedReports]);

    const allHistoricalContributors = useMemo<string[]>(() => {
        const contributorNames = new Set<string>();
        allHistoricalResults.forEach(r => {
            if (r.contributor?.cleanedName) {
                contributorNames.add(r.contributor.cleanedName);
            } else if (r.status === 'NÃO IDENTIFICADO' && r.transaction.cleanedDescription) {
                // Also add names from unidentified transactions to make the search more comprehensive
                contributorNames.add(r.transaction.cleanedDescription);
            }
        });
        return Array.from(contributorNames).sort();
    }, [allHistoricalResults]);

    const allContributorsWithChurch = useMemo<(Contributor & { church: Church; uniqueId: string })[]>(() => {
        return contributorFiles.flatMap(file => {
            const church = churches.find(c => c.id === file.churchId);
            if (!church) return [];
            const contributors = parseContributors(file.content, customIgnoreKeywords);
            return contributors.map((contributor, index) => ({
                ...contributor,
                church,
                uniqueId: `${church.id}-${contributor.normalizedName}-${index}`
            }));
        });
    }, [contributorFiles, churches, customIgnoreKeywords]);

    const isCompareDisabled = useMemo(() => !bankStatementFile || contributorFiles.length === 0, [bankStatementFile, contributorFiles]);

    // --- Memoized Actions & Callbacks ---
    
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
        showToast("Resultados da conciliação foram limpos.", 'success');
    }, [setMatchResults, setReportPreviewData, showToast]);

    const clearLearnedAssociations = useCallback(async () => {
        if (!user) return;
        const { error } = await supabase.from('learned_associations').delete().eq('user_id', user.id);
        if (error) {
            Logger.error('Error clearing learned associations', error);
            showToast("Erro ao limpar associações.", 'error');
        } else {
            setLearnedAssociations([]);
            showToast("Associações aprendidas foram removidas.", 'success');
        }
    }, [user, showToast]);

    const resetApplicationData = useCallback(async () => {
        if (!user) return;
        // IMPORTANT: Saved reports are now preserved during a data reset.
        const [banksError, churchesError, associationsError] = await Promise.all([
            supabase.from('banks').delete().eq('user_id', user.id),
            supabase.from('churches').delete().eq('user_id', user.id),
            supabase.from('learned_associations').delete().eq('user_id', user.id),
        ]);

        if(banksError.error || churchesError.error || associationsError.error) {
            showToast("Erro ao limpar dados no banco de dados.", 'error');
        } else {
             setChurches([]);
             setBanks([]);
             setLearnedAssociations([]);
        }
        
        setBankStatementFile(null);
        setContributorFiles([]);
        setMatchResults([]);
        setReportPreviewData(null);
        setSimilarityLevel(80);
        setDayTolerance(2);
        setCustomIgnoreKeywords(DEFAULT_IGNORE_KEYWORDS);
        showToast("Todos os dados da aplicação foram redefinidos, exceto relatórios salvos.", 'success');
    }, [user, setBankStatementFile, setContributorFiles, setMatchResults, setReportPreviewData, setSimilarityLevel, setDayTolerance, setCustomIgnoreKeywords, showToast]);


    const toggleTheme = useCallback(() => setTheme(prev => (prev === 'light' ? 'dark' : 'light')), [setTheme]);

    const handleStatementUpload = useCallback((content: string, fileName: string, bankId: string) => {
        setBankStatementFile({ bankId, content, fileName });
    }, [setBankStatementFile]);

    const handleContributorsUpload = useCallback((content: string, fileName: string, churchId: string) => {
        setContributorFiles(prev => {
            const existing = prev.filter(f => f.churchId !== churchId);
            return [...existing, { churchId, content, fileName }];
        });
    }, [setContributorFiles]);

    const addLearnedAssociation = useCallback(async (transaction: Transaction, contributor: Contributor, church: Church) => {
        if (!user) return;
        const normalizedDescription = normalizeString(transaction.description, customIgnoreKeywords);
        
        const exists = learnedAssociations.some(a => a.normalizedDescription === normalizedDescription);
        if (exists) return;

        const { data: insertedData, error } = await supabase.from('learned_associations').insert({
            normalized_description: normalizedDescription,
            church_id: church.id,
            contributor_name: contributor.name,
            user_id: user.id
        }).select().single();

        if (error) {
            Logger.error('Error adding learned association', error);
            showToast('Falha ao salvar aprendizado.', 'error');
        } else if (insertedData) {
            setLearnedAssociations(prev => [...prev, {
                id: insertedData.id,
                normalizedDescription: insertedData.normalized_description,
                churchId: insertedData.church_id,
                contributorName: insertedData.contributor_name,
            }]);
        }
    }, [learnedAssociations, customIgnoreKeywords, user, showToast]);

    const handleCompare = useCallback(async () => {
        if (isCompareDisabled && comparisonType !== 'expenses') return;
        if (!bankStatementFile) return;
    
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 50)); // Allow UI to update
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
                        incomeTransactions, parsedContributorFiles, { similarityThreshold: similarityLevel, dayTolerance }, learnedAssociations, customIgnoreKeywords
                    );
                    previewResults.income = groupResultsByChurch(incomeResults);
                    incomeResultsForDashboard = incomeResults;
                }
            }
            
            if (comparisonType === 'expenses' || comparisonType === 'both') {
                if (expenseTransactions.length > 0) {
                    const expenseResults = processExpenses(expenseTransactions);
                    previewResults.expenses = { 'all_expenses_group': expenseResults };
                }
            }
    
            const incomeTxCount = incomeTransactions.length;
            const expenseTxCount = expenseTransactions.length;
    
            if ((comparisonType === 'income' || comparisonType === 'both') && incomeTxCount === 0) {
                 showToast('O extrato não contém entradas (valores positivos).', 'error');
            }
            if ((comparisonType === 'expenses' || comparisonType === 'both') && expenseTxCount === 0) {
                 showToast('O extrato não contém saídas (valores negativos).', 'error');
            }
    
            setAllTransactions(transactions);
            setReportPreviewData(previewResults);
            setMatchResults(comparisonType === 'expenses' ? [] : incomeResultsForDashboard);
            setActiveView('reports');
    
        } catch (error) {
            Logger.error("Comparison process failed", error);
            Metrics.increment('parsingErrors');
            showToast("Falha ao processar os arquivos. Verifique o formato.", 'error');
        } finally {
            const endTime = performance.now();
            Metrics.set('processingTimeMs', endTime - startTime);
            Logger.info('Comparison process finished', { durationMs: Metrics.get().processingTimeMs });
            setIsLoading(false);
        }
    }, [
        isCompareDisabled, bankStatementFile, contributorFiles, churches, similarityLevel, 
        dayTolerance, learnedAssociations, comparisonType, customIgnoreKeywords, showToast, 
        setAllTransactions, setReportPreviewData, setMatchResults, setActiveView, setIsLoading
    ]);
    
    const handleBackToSettings = useCallback(() => {
        setActiveView('upload');
        setReportPreviewData(null);
    }, [setActiveView, setReportPreviewData]);

    const discardCurrentReport = useCallback(() => {
        setReportPreviewData(null);
        setBankStatementFile(null);
        setContributorFiles([]);
        showToast("Sessão descartada. Você pode iniciar uma nova conciliação.", 'success');
        setActiveView('upload');
    }, [setReportPreviewData, setBankStatementFile, setContributorFiles, showToast, setActiveView]);

    const updateReportData = useCallback((updatedRow: MatchResult, reportType: 'income' | 'expenses') => {
        if (updatedRow.contributor) {
            updatedRow.contributor.cleanedName = cleanTransactionDescriptionForDisplay(updatedRow.contributor.name, customIgnoreKeywords);
            updatedRow.contributor.normalizedName = normalizeString(updatedRow.contributor.name, customIgnoreKeywords);
        }
        
        updatedRow.transaction.cleanedDescription = cleanTransactionDescriptionForDisplay(updatedRow.transaction.description, customIgnoreKeywords);

        setReportPreviewData(prevData => {
            if (!prevData) return null;
    
            const reportGroups = { ...prevData[reportType] };
            let originalChurchId: string | null = null;
    
            for (const churchId in reportGroups) {
                if (reportGroups[churchId].some(r => r.transaction.id === updatedRow.transaction.id)) {
                    originalChurchId = churchId;
                    break;
                }
            }
    
            if (!originalChurchId) return prevData;
    
            const newChurchId = updatedRow.church.id;
    
            if (originalChurchId === newChurchId) {
                reportGroups[newChurchId] = reportGroups[newChurchId].map(r =>
                    r.transaction.id === updatedRow.transaction.id ? updatedRow : r
                );
            } else {
                reportGroups[originalChurchId] = reportGroups[originalChurchId].filter(
                    r => r.transaction.id !== updatedRow.transaction.id
                );
    
                const existingNewGroup = reportGroups[newChurchId] || [];
                reportGroups[newChurchId] = [...existingNewGroup, updatedRow];
            }
    
            const newPreviewData = { ...prevData, [reportType]: reportGroups };
            return newPreviewData;
        });
    
        if (reportType === 'income') {
            setMatchResults(prev => prev.map(row =>
                row.transaction.id === updatedRow.transaction.id ? updatedRow : row
            ));
        }
    }, [setReportPreviewData, setMatchResults, customIgnoreKeywords]);

    const handleAnalyze = useCallback(async (transactionId: string) => {
        let result: MatchResult | undefined;
        let reportType: 'income' | 'expenses' | undefined;
    
        if (reportPreviewData) {
            for (const type of ['income', 'expenses'] as const) {
                for (const cId in reportPreviewData[type]) {
                    const found = reportPreviewData[type][cId].find(r => r.transaction.id === transactionId);
                    if (found) {
                        result = found;
                        reportType = type;
                        break;
                    }
                }
                if (result) break;
            }
        }
    
        if (!result) {
            result = matchResults.find(r => r.transaction.id === transactionId);
            if (result) {
                reportType = 'income'; 
            }
        }
        
        if (!result) {
            showToast('Não foi possível encontrar a transação para análise.', 'error');
            return;
        }
    
        setLoadingAiId(transactionId);
        setAiSuggestion(null);
        try {
            const suggestion = await getAISuggestion(result.transaction, allContributorsWithChurch);
            setAiSuggestion({ id: transactionId, name: suggestion });
    
            const suggestedContributor = allContributorsWithChurch.find(c => c.name.toLowerCase() === suggestion.toLowerCase());
            if (suggestedContributor) {
                const updatedRow: MatchResult = { 
                    ...result, 
                    contributor: suggestedContributor, 
                    church: suggestedContributor.church, 
                    status: 'IDENTIFICADO', 
                    matchMethod: 'AI' 
                };
                
                if (activeView === 'reports' && reportType) {
                    updateReportData(updatedRow, reportType);
                } else {
                     setMatchResults(prev => prev.map(r => r.transaction.id === transactionId ? updatedRow : r));
                }
                
                addLearnedAssociation(result.transaction, suggestedContributor, suggestedContributor.church);
            }
        } catch (error) {
            Logger.error("AI Analysis failed", error, { transactionId });
            Metrics.increment('apiErrors');
            setAiSuggestion({ id: transactionId, name: "Erro na análise." });
        } finally {
            setLoadingAiId(null);
        }
    }, [matchResults, reportPreviewData, allContributorsWithChurch, addLearnedAssociation, setMatchResults, updateReportData, activeView, showToast]);

    const closeSaveReportModal = useCallback(() => setSavingReportState(null), []);

    const confirmSaveReport = useCallback(async (name: string) => {
        if (!savingReportState || !user) return;

        const transformResultsForSaving = (data: GroupedReportData) => {
            const savedData: any = {};
            for (const groupId in data) {
                if (!data[groupId]) continue;
                savedData[groupId] = data[groupId].map(result => {
                    const { church, ...rest } = result;
                    return {
                        ...rest,
                        churchId: church.id,
                    };
                });
            }
            return savedData;
        };

        let incomeData: GroupedReportData = {};
        let expenseData: GroupedReportData = {};
        let recordCount = 0;

        if (savingReportState.type === 'global') {
            if (!reportPreviewData) {
                closeSaveReportModal();
                return;
            }
            incomeData = reportPreviewData.income;
            expenseData = reportPreviewData.expenses;
        } else if (savingReportState.type === 'group') {
            if (savingReportState.reportType === 'income') {
                incomeData = { [savingReportState.groupId!]: savingReportState.results! };
            } else {
                expenseData = { [savingReportState.groupId!]: savingReportState.results! };
            }
        } else if (savingReportState.type === 'filtered') {
            if (!savingReportState.results) {
                closeSaveReportModal();
                return;
            }
            const incomeResults = savingReportState.results.filter(r => r.transaction.amount > 0);
            const expenseResults = savingReportState.results.filter(r => r.transaction.amount < 0);
            incomeData = groupResultsByChurch(incomeResults);
            expenseData = groupResultsByChurch(expenseResults);
        }
        
        recordCount = Object.values(incomeData).flat().length + Object.values(expenseData).flat().length;

        const newReportData = {
            name,
            income_data: transformResultsForSaving(incomeData),
            expense_data: transformResultsForSaving(expenseData),
            record_count: recordCount,
            user_id: user.id
        };

        try {
            const { data: insertedData, error } = await supabase
                .from('saved_reports')
                .insert(newReportData)
                .select()
                .single();

            if (error) {
                Logger.error('Error saving report', error);
                showToast('Falha ao salvar relatório.', 'error');
            } else if (insertedData) {
                const newReport: SavedReport = {
                    id: insertedData.id,
                    name: insertedData.name,
                    createdAt: insertedData.created_at,
                    incomeData: rehydrateReportData(insertedData.income_data, churches),
                    expenseData: rehydrateReportData(insertedData.expense_data, churches),
                    recordCount: insertedData.record_count,
                };
                try {
    setSavedReports(prev => [newReport, ...prev]);
    showToast('Relatório salvo com sucesso!');
} catch (err) {
    Logger.error('Critical failure during report save', err);
    showToast('Ocorreu um erro inesperado ao salvar.', 'error');
} finally {
    closeSaveReportModal();
}

    const saveCurrentReport = useCallback(() => {
        if (!reportPreviewData) return;
        setSavingReportState({ type: 'global' });
    }, [reportPreviewData]);

    const saveGroupReport = useCallback((groupId: string, groupName: string, results: MatchResult[], reportType: 'income' | 'expenses') => {
        setSavingReportState({ type: 'group', groupId, groupName, results, reportType });
    }, []);

    const saveFilteredReport = useCallback((results: MatchResult[]) => {
        setSavingReportState({ type: 'filtered', results });
    }, []);

    const viewSavedReport = useCallback((reportId: string) => {
        const report = savedReports.find(r => r.id === reportId);
        if (report) {
            setReportPreviewData({
                income: report.incomeData,
                expenses: report.expenseData,
            });
            setActiveView('reports');
        }
    }, [savedReports, setReportPreviewData, setActiveView]);
    
    const normalizeForComparison = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, '').trim();

    const addIgnoreKeyword = useCallback((keyword: string) => {
        const trimmedKeyword = keyword.trim();
        if (!trimmedKeyword) return;

        const normalizedNewKeyword = normalizeForComparison(trimmedKeyword);
        if (!normalizedNewKeyword) return;
        
        setCustomIgnoreKeywords(prev => {
            const isDuplicate = prev.some(k => normalizeForComparison(k) === normalizedNewKeyword);
            if (isDuplicate) {
                showToast(`'${trimmedKeyword}' já está na lista.`, 'error');
                return prev;
            }
            showToast(`'${trimmedKeyword}' adicionado.`, 'success');
            return [...prev, trimmedKeyword];
        });
    }, [setCustomIgnoreKeywords, showToast]);

    const removeIgnoreKeyword = useCallback((keywordToRemove: string) => {
        setCustomIgnoreKeywords(prev => prev.filter(k => k !== keywordToRemove));
        showToast(`'${keywordToRemove}' removido.`, 'success');
    }, [setCustomIgnoreKeywords, showToast]);
    
    const addBank = useCallback(async (name: string) => {
        if (!name.trim() || !user) return;
        const { data: insertedData, error } = await supabase
            .from('banks')
            .insert({ name: name.trim(), user_id: user.id })
            .select()
            .single();

        if (error) {
            Logger.error('Error adding bank', error);
            showToast('Falha ao adicionar banco.', 'error');
        } else if (insertedData) {
            setBanks(prev => [...prev, insertedData]);
            showToast('Banco adicionado com sucesso!', 'success');
        }
    }, [user, showToast]);

    const openEditBank = useCallback((bank: Bank) => setEditingBank(bank), []);
    const closeEditBank = useCallback(() => setEditingBank(null), []);
    
    const updateBank = useCallback(async (bankId: string, name: string) => {
        if (!name.trim()) return;
        const { data: updatedData, error } = await supabase
            .from('banks')
            .update({ name: name.trim() })
            .eq('id', bankId)
            .select()
            .single();

        if (error) {
            Logger.error('Error updating bank', error);
            showToast('Falha ao atualizar banco.', 'error');
        } else if (updatedData) {
            setBanks(prev => prev.map(b => (b.id === bankId ? updatedData : b)));
            showToast('Banco atualizado com sucesso!', 'success');
            closeEditBank();
        }
    }, [showToast, closeEditBank]);
    
    const addChurch = useCallback(async (data: ChurchFormData) => {
        if (!data.name.trim() || !user) return;

        const newChurchData = {
            name: data.name.trim(),
            address: data.address.trim(),
            pastor: data.pastor.trim(),
            logoUrl: data.logoUrl || `https://placehold.co/100x100/1e293b/ffffff?text=${data.name.trim().charAt(0)}`,
            user_id: user.id
        };

        const { data: insertedData, error } = await supabase
            .from('churches')
            .insert(newChurchData)
            .select()
            .single();

        if (error) {
            Logger.error('Error adding church', error);
            showToast('Falha ao adicionar igreja.', 'error');
        } else if (insertedData) {
            setChurches(prev => [...prev, insertedData]);
            showToast('Igreja adicionada com sucesso!', 'success');
        }
    }, [user, showToast]);

    const openEditChurch = useCallback((church: Church) => setEditingChurch(church), []);
    const closeEditChurch = useCallback(() => setEditingChurch(null), []);
    
    const updateChurch = useCallback(async (churchId: string, data: ChurchFormData) => {
        if (!data.name.trim()) return;
        
        const { data: updatedData, error } = await supabase
            .from('churches')
            .update(data)
            .eq('id', churchId)
            .select()
            .single();

        if (error) {
            Logger.error('Error updating church', error);
            showToast('Falha ao atualizar igreja.', 'error');
        } else if (updatedData) {
            setChurches(prev => prev.map(c => (c.id === churchId ? updatedData : c)));
            showToast('Igreja atualizada com sucesso!', 'success');
            closeEditChurch();
        }
    }, [showToast, closeEditChurch]);
    
    const openManualIdentify = useCallback((transactionId: string) => {
        const resultsSource = reportPreviewData?.income['unidentified'] || matchResults;
        const result = resultsSource.find(r => r.transaction.id === transactionId && r.status === 'NÃO IDENTIFICADO');
        if(result) {
            setManualIdentificationTx(result.transaction);
        } else {
             const allResults = Object.values(reportPreviewData?.income || {}).flat();
             const found = allResults.find(r => r.transaction.id === transactionId);
             if (found) setManualIdentificationTx(found.transaction);
        }
    }, [matchResults, reportPreviewData]);
    const closeManualIdentify = useCallback(() => setManualIdentificationTx(null), []);
    
    const confirmManualIdentification = useCallback((transactionId: string, churchId: string) => {
        const unidentifiedResults = reportPreviewData?.income['unidentified'] || [];
        const originalResult = unidentifiedResults.find(r => r.transaction.id === transactionId);
        const church = churches.find(c => c.id === churchId);
    
        if (!originalResult || !church) {
            showToast('Erro ao encontrar registro ou igreja.', 'error');
            return;
        }
    
        const newContributor: Contributor = {
            id: `manual-${transactionId}`,
            name: originalResult.transaction.cleanedDescription || originalResult.transaction.description,
        };
    
        const updatedRow: MatchResult = {
            ...originalResult,
            status: 'IDENTIFICADO',
            church,
            contributor: newContributor,
            matchMethod: 'MANUAL',
            similarity: 100,
            contributorAmount: originalResult.transaction.amount,
        };
        
        updateReportData(updatedRow, 'income');
        addLearnedAssociation(originalResult.transaction, newContributor, church);
    
        showToast('Identificação salva e relatório da igreja atualizado com sucesso!', 'success');
        closeManualIdentify();
    }, [reportPreviewData, churches, updateReportData, addLearnedAssociation, showToast, closeManualIdentify]);


    const openManualMatchModal = useCallback((recordToMatch: MatchResult) => {
        if (!recordToMatch.contributor) return;

        // Get all transaction IDs that have already been identified
        const matchedTxIds = new Set(
            Object.values(reportPreviewData?.income || {})
                .flat()
                .filter(r => r.status === 'IDENTIFICADO' && !r.transaction.id.startsWith('pending-'))
                .map(r => r.transaction.id)
        );
        
        // The complete list of available transactions from the bank statement
        const availableTransactions = allTransactions.filter(tx => !matchedTxIds.has(tx.id) && tx.amount > 0);
        
        // --- Scoring logic to sort, not filter ---
        const contributorDate = parseDate(recordToMatch.contributor.date || '');
        const contributorAmount = recordToMatch.contributor.amount;

        const scoredSuggestions = availableTransactions.map(tx => {
            const txDate = parseDate(tx.date);
            let amountScore = 0;
            if (contributorAmount && tx.amount > 0) {
                const diff = Math.abs(tx.amount - contributorAmount);
                const pctDiff = diff / contributorAmount;
                amountScore = Math.max(0, 100 - (pctDiff * 200));
            }

            let dateScore = 50;
            if (txDate && contributorDate) {
                 const diff = daysDifference(txDate, contributorDate);
                 dateScore = (diff <= dayTolerance) ? (100 - (diff / dayTolerance) * 50) : 0;
            }
            
            const nameScore = calculateNameSimilarity(tx.description, recordToMatch.contributor!, customIgnoreKeywords);
            const finalScore = (nameScore * 10) + amountScore + (dateScore / 10);

            return { tx, score: finalScore };
        });

        // Sort all available transactions by score to show the best matches first
        const sortedSuggestions = scoredSuggestions
            .sort((a, b) => b.score - a.score)
            .map(s => s.tx);

        setManualMatchState({ record: recordToMatch, suggestions: sortedSuggestions });
    }, [allTransactions, reportPreviewData, dayTolerance, customIgnoreKeywords]);

    const closeManualMatchModal = useCallback(() => {
        setManualMatchState(null);
    }, []);

    const confirmManualAssociation = useCallback((selectedTx: Transaction) => {
        if (!manualMatchState) return;
        const { record: recordToMatch } = manualMatchState;

        addLearnedAssociation(selectedTx, recordToMatch.contributor!, recordToMatch.church);

        const updateState = (prevState: MatchResult[]): MatchResult[] => {
            const originalBankTxResult = prevState.find(r => r.transaction.id === selectedTx.id);
            if (!originalBankTxResult) return prevState;

            const mergedResult: MatchResult = {
                ...originalBankTxResult,
                contributor: recordToMatch.contributor,
                church: recordToMatch.church,
                status: 'IDENTIFICADO',
                matchMethod: 'MANUAL',
                similarity: 100,
                contributorAmount: recordToMatch.contributor?.amount,
                transaction: selectedTx,
            };

            const updatedList = prevState.filter(r => 
                r.transaction.id !== recordToMatch.transaction.id && 
                r.transaction.id !== selectedTx.id
            );
            updatedList.push(mergedResult);
            return updatedList;
        };
        
        setMatchResults(updateState);

        setReportPreviewData(prev => {
            if (!prev) return null;
            
            const newIncomeData = { ...prev.income };
            const idOfPending = recordToMatch.transaction.id;
            const churchIdOfPending = recordToMatch.church.id;
            const idOfBankTx = selectedTx.id;

            let originalBankTxResult: MatchResult | undefined;
            let churchIdOfBankTx: string | undefined;

            for(const [cId, results] of Object.entries(newIncomeData)) {
                const found = (results as MatchResult[]).find(r => r.transaction.id === idOfBankTx);
                if(found) {
                    originalBankTxResult = found;
                    churchIdOfBankTx = cId;
                    break;
                }
            }
            
            if (!originalBankTxResult || !churchIdOfBankTx) return prev;

            const mergedResult: MatchResult = {
                ...originalBankTxResult,
                contributor: recordToMatch.contributor,
                church: recordToMatch.church,
                status: 'IDENTIFICADO',
                matchMethod: 'MANUAL',
                similarity: 100,
                contributorAmount: recordToMatch.contributor?.amount,
                transaction: selectedTx,
            };
            
            newIncomeData[churchIdOfBankTx] = (newIncomeData[churchIdOfBankTx] || []).filter(r => r.transaction.id !== idOfBankTx);
            if (newIncomeData[churchIdOfBankTx].length === 0) delete newIncomeData[churchIdOfBankTx];

            newIncomeData[churchIdOfPending] = (newIncomeData[churchIdOfPending] || []).filter(r => r.transaction.id !== idOfPending);
            if (newIncomeData[churchIdOfPending].length === 0) delete newIncomeData[churchIdOfPending];
            
            const targetChurchId = mergedResult.church.id;
            newIncomeData[targetChurchId] = [...(newIncomeData[targetChurchId] || []), mergedResult];

            return { ...prev, income: newIncomeData };
        });

        closeManualMatchModal();
        showToast('Associação manual confirmada com sucesso!');
    }, [manualMatchState, addLearnedAssociation, closeManualMatchModal, showToast, setMatchResults, setReportPreviewData]);


    const openDeleteConfirmation = useCallback((item: DeletingItem) => setDeletingItem(item), []);
    const closeDeleteConfirmation = useCallback(() => setDeletingItem(null), []);

    const confirmDeletion = useCallback(async () => {
        if (!deletingItem) return;

        switch (deletingItem.type) {
            case 'bank':
                const { error: bankError } = await supabase.from('banks').delete().eq('id', deletingItem.id);
                if (bankError) {
                    Logger.error('Error deleting bank', bankError);
                    showToast('Falha ao excluir banco.', 'error');
                } else {
                    setBanks(prev => prev.filter(b => b.id !== deletingItem.id));
                    if (bankStatementFile?.bankId === deletingItem.id) {
                        setBankStatementFile(null);
                    }
                    showToast('Banco excluído com sucesso!', 'success');
                }
                break;
            case 'church':
                const { error: churchError } = await supabase.from('churches').delete().eq('id', deletingItem.id);
                if (churchError) {
                    Logger.error('Error deleting church', churchError);
                    showToast('Falha ao excluir igreja.', 'error');
                } else {
                    setChurches(prev => prev.filter(c => c.id !== deletingItem.id));
                    setContributorFiles(prev => prev.filter(f => f.churchId !== deletingItem.id));
                    showToast('Igreja excluída com sucesso!', 'success');
                }
                break;
            case 'association':
                const { error: assocError } = await supabase.from('learned_associations').delete().eq('id', deletingItem.id);
                 if (assocError) {
                    Logger.error('Error deleting association', assocError);
                    showToast('Falha ao excluir associação.', 'error');
                } else {
                    setLearnedAssociations(prev => prev.filter(a => a.id !== assocError.id));
                    showToast('Associação excluída com sucesso!', 'success');
                }
                break;
            case 'report-group':
                const { meta } = deletingItem;
                if (meta?.reportType) {
                    setReportPreviewData(prev => {
                        if (!prev) return null;
                        const newPreviewData = { ...prev };
                        const groupData = { ...newPreviewData[meta.reportType] };
                        delete groupData[deletingItem.id];
                        newPreviewData[meta.reportType] = groupData;
                        return newPreviewData;
                    });
                     if (meta.reportType === 'income') {
                        setMatchResults(prev => prev.filter(r => r.church.id !== deletingItem.id));
                    }
                }
                break;
            case 'report-row':
                setReportPreviewData(prev => {
                    if (!prev) return null;
                    const newPreview = { income: { ...prev.income }, expenses: { ...prev.expenses } };

                    // Search and remove from income
                    for (const churchId in newPreview.income) {
                        newPreview.income[churchId] = newPreview.income[churchId].filter(
                            r => r.transaction.id !== deletingItem.id
                        );
                    }

                    // Search and remove from expenses
                    for (const groupId in newPreview.expenses) {
                        newPreview.expenses[groupId] = newPreview.expenses[groupId].filter(
                            r => r.transaction.id !== deletingItem.id
                        );
                    }
                    return newPreview;
                });
                setMatchResults(prev => prev.filter(r => r.transaction.id !== deletingItem.id));
                showToast('Linha do relatório excluída com sucesso!', 'success');
                break;
            case 'report-saved':
                const { error: reportError } = await supabase.from('saved_reports').delete().eq('id', deletingItem.id);
                if (reportError) {
                    Logger.error('Error deleting saved report', reportError);
                    showToast('Falha ao excluir relatório.', 'error');
                } else {
                    setSavedReports(prev => prev.filter(r => r.id !== deletingItem.id));
                    showToast('Relatório excluído com sucesso!', 'success');
                }
                break;
            case 'uploaded-files':
                clearUploadedFiles();
                break;
            case 'match-results':
                clearMatchResults();
                break;
            case 'learned-associations':
                await clearLearnedAssociations();
                break;
            case 'all-data':
                await resetApplicationData();
                break;
        }
        closeDeleteConfirmation();
    }, [deletingItem, bankStatementFile, setBankStatementFile, setContributorFiles, setReportPreviewData, setMatchResults, closeDeleteConfirmation, resetApplicationData, clearUploadedFiles, clearMatchResults, clearLearnedAssociations, showToast]);

    // --- Search Filter Actions ---
    const openSearchFilters = useCallback(() => setIsSearchFiltersOpen(true), []);
    const closeSearchFilters = useCallback(() => setIsSearchFiltersOpen(false), []);
    const setSearchFilters = useCallback((filters: SearchFilters) => setSearchFiltersState(filters), []);
    const clearSearchFilters = useCallback(() => setSearchFiltersState(initialSearchFilters), []);


    const value = useMemo(() => ({
        theme, banks, churches, learnedAssociations, bankStatementFile, contributorFiles, matchResults, activeView,
        isLoading, loadingAiId, aiSuggestion, similarityLevel, dayTolerance, editingBank, editingChurch,
        manualIdentificationTx, deletingItem, toast, summary, allContributorsWithChurch, isCompareDisabled, reportPreviewData,
        savedReports, comparisonType, setComparisonType, customIgnoreKeywords, savingReportState, allHistoricalResults, allHistoricalContributors,
        isSearchFiltersOpen, searchFilters,
        toggleTheme, setActiveView, setBanks, setChurches, setSimilarityLevel, setDayTolerance, setMatchResults, setReportPreviewData,
        addIgnoreKeyword, removeIgnoreKeyword,
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile,
        handleCompare, handleAnalyze, updateReportData,
        openEditBank, closeEditBank, updateBank, addBank,
        openEditChurch, closeEditChurch, updateChurch, addChurch,
        openDeleteConfirmation, closeDeleteConfirmation, confirmDeletion,
        openManualIdentify, closeManualIdentify, confirmManualIdentification,
        openManualMatchModal, closeManualMatchModal, confirmManualAssociation,
        showToast, handleBackToSettings, saveCurrentReport, saveGroupReport, viewSavedReport, manualMatchState,
        confirmSaveReport, closeSaveReportModal, discardCurrentReport, saveFilteredReport,
        openSearchFilters, closeSearchFilters, setSearchFilters, clearSearchFilters,
    }), [
        theme, banks, churches, learnedAssociations, bankStatementFile, contributorFiles, matchResults, activeView,
        isLoading, loadingAiId, aiSuggestion, similarityLevel, dayTolerance, editingBank, editingChurch,
        manualIdentificationTx, deletingItem, toast, summary, allContributorsWithChurch, isCompareDisabled, reportPreviewData,
        savedReports, comparisonType, customIgnoreKeywords, savingReportState, allHistoricalResults, allHistoricalContributors,
        isSearchFiltersOpen, searchFilters,
        toggleTheme, setActiveView, setBanks, setChurches, setSimilarityLevel, setDayTolerance, setMatchResults, setReportPreviewData,
        addIgnoreKeyword, removeIgnoreKeyword,
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile,
        handleCompare, handleAnalyze, updateReportData,
        openEditBank, closeEditBank, updateBank, addBank,
        openEditChurch, closeEditChurch, updateChurch, addChurch,
        openDeleteConfirmation, closeDeleteConfirmation, confirmDeletion,
        openManualIdentify, closeManualIdentify, confirmManualIdentification,
        openManualMatchModal, closeManualMatchModal, confirmManualAssociation,
        showToast, handleBackToSettings,
        saveCurrentReport, saveGroupReport, viewSavedReport, manualMatchState,
        confirmSaveReport, closeSaveReportModal, discardCurrentReport, saveFilteredReport,
        setSearchFilters,
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
