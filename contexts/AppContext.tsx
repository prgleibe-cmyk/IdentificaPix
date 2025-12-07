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
    SourceFile,
} from '../types';
import { parseBankStatement, parseContributors, matchTransactions, normalizeString, processExpenses, cleanTransactionDescriptionForDisplay, parseDate, calculateNameSimilarity, PLACEHOLDER_CHURCH } from '../services/processingService';
import { getAISuggestion } from '../services/geminiService';
import { Logger, Metrics } from '../services/monitoringService';
import { supabase } from '../services/supabaseClient';
import { useTranslation } from './I18nContext';
import { Json, TablesInsert } from '../types/supabase';

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

    // Derived State
    summary: {
        autoConfirmed: { count: number; value: number; };
        manualConfirmed: { count: number; value: number; };
        pending: { count: number; value: number; };
        identifiedCount: number;
        unidentifiedCount: number;
        totalValue: number;
        valuePerChurch: [string, number][];
        methodCounts?: Record<string, number>;
    };
    allContributorsWithChurch: (Contributor & { church: Church; uniqueId: string })[];
    isCompareDisabled: boolean;
    hasActiveSession: boolean;

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

    discardCurrentReport: () => void;
    
    openSearchFilters: () => void;
    closeSearchFilters: () => void;
    setSearchFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
    clearSearchFilters: () => void;

    viewSavedReport: (reportId: string) => void;
    saveFilteredReport: (results: MatchResult[]) => void;
    
    openSaveReportModal: (state: SavingReportState) => void;
    closeSaveReportModal: () => void;
    confirmSaveReport: (name: string) => void;

    openDivergenceModal: (match: MatchResult) => void;
    closeDivergenceModal: () => void;
    confirmDivergence: (divergentMatch: MatchResult) => void;
    rejectDivergence: (divergentMatch: MatchResult) => void;
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
};

const INITIAL_SUMMARY = {
    autoConfirmed: { count: 0, value: 0 },
    manualConfirmed: { count: 0, value: 0 },
    pending: { count: 0, value: 0 },
    identifiedCount: 0,
    unidentifiedCount: 0,
    totalValue: 0,
    valuePerChurch: [],
    methodCounts: { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 },
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { t } = useTranslation();
    // Consume UI Context
    const { showToast, setIsLoading, setActiveView, activeView } = useUI();
    
    // Reverted to generic key prefix to fix loading issues
    const userKeyPrefix = 'identificapix';

    // --- Data State (Persisted for Stale-While-Revalidate) ---
    // Light data: Loaded synchronously
    const [banks, setBanks] = usePersistentState<Bank[]>(`${userKeyPrefix}-banks`, []);
    const [churches, setChurches] = usePersistentState<Church[]>(`${userKeyPrefix}-churches`, []);
    const [similarityLevel, setSimilarityLevel] = usePersistentState<number>(`${userKeyPrefix}-similarity`, 80);
    const [dayTolerance, setDayTolerance] = usePersistentState<number>(`${userKeyPrefix}-daytolerance`, 2);
    const [customIgnoreKeywords, setCustomIgnoreKeywords] = usePersistentState<string[]>(`${userKeyPrefix}-ignore-keywords`, DEFAULT_IGNORE_KEYWORDS);
    const [searchFilters, setSearchFilters] = usePersistentState<SearchFilters>(`${userKeyPrefix}-search-filters`, DEFAULT_SEARCH_FILTERS);
    
    // NEW: Lightweight flag to indicate if a session exists, loaded synchronously.
    const [hasActiveSession, setHasActiveSession] = usePersistentState<boolean>(`${userKeyPrefix}-has-session`, false, false);

    // Heavy data: Loaded Asynchronously (isHeavy = true)
    const [savedReports, setSavedReports] = usePersistentState<SavedReport[]>(`${userKeyPrefix}-reports-meta-v2`, [], true); 
    const [learnedAssociations, setLearnedAssociations] = usePersistentState<LearnedAssociation[]>(`${userKeyPrefix}-associations`, [], true); 
    
    const [bankStatementFile, setBankStatementFile] = usePersistentState<{ bankId: string, content: string, fileName: string } | null>(`${userKeyPrefix}-statement`, null, true);
    const [contributorFiles, setContributorFiles] = usePersistentState<{ churchId: string; content: string; fileName: string }[]>(`${userKeyPrefix}-contributors`, [], true);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>(`${userKeyPrefix}-results`, [], true);
    const [reportPreviewData, setReportPreviewData] = usePersistentState<{ income: GroupedReportData; expenses: GroupedReportData } | null>(`${userKeyPrefix}-report-preview`, null, true);
    
    const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<{ id: string, name: string } | null>(null);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [manualMatchState, setManualMatchState] = useState<{ record: MatchResult, suggestions: Transaction[] } | null>(null);

    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [editingChurch, setEditingChurch] = useState<Church | null>(null);
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);
    const [divergenceConfirmation, setDivergenceConfirmation] = useState<MatchResult | null>(null);

    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
    const [savingReportState, setSavingReportState] = useState<SavingReportState | null>(null);
    
    // Flag to track when initial fetch is actually complete
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);


    // --- Async State for heavy derived data ---
    // Persist summary state for instant dashboard loading
    const [summary, setSummary] = usePersistentState<AppContextType['summary']>(`${userKeyPrefix}-summary-v2`, INITIAL_SUMMARY);

    const [allContributorsWithChurch, setAllContributorsWithChurch] = useState<(Contributor & { church: Church; uniqueId: string })[]>([]);

    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            // Check for light data existence (sync) to decide on loading screen.
            const hasCachedData = banks.length > 0 || churches.length > 0 || hasActiveSession;
            
            if (!hasCachedData) {
                setIsLoading(true);
            }
            
            // PHASE 1: Fast Fetch - Metadata Only
            // Reverted privacy filtering to fix loading error
            const [churchesResult, banksResult, savedReportsMetaResult, learnedAssociationsResult] = await Promise.all([
                supabase.from('churches').select('*').order('name'),
                supabase.from('banks').select('*').order('name'),
                supabase.from('saved_reports').select('id, name, created_at, record_count, user_id').order('created_at', { ascending: false }),
                supabase.from('learned_associations').select('*'),
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

            if (savedReportsMetaResult.error) {
                Logger.error('Error fetching saved reports', savedReportsMetaResult.error);
                if (!hasCachedData) showToast('Falha ao carregar os relatórios salvos.', 'error');
            } else {
                // SMART MERGE: Preserve existing 'data' from local storage if available
                setSavedReports(prev => {
                    const existingDataMap = new Map(prev.map(r => [r.id, r.data]));
                    
                    return (savedReportsMetaResult.data || []).map(report => ({
                        id: report.id,
                        name: report.name,
                        createdAt: report.created_at,
                        recordCount: report.record_count,
                        user_id: report.user_id,
                        // Use cached data if available, otherwise undefined until Phase 2
                        data: existingDataMap.get(report.id) as any,
                    }));
                });
            }

            if (learnedAssociationsResult.error) {
                Logger.error('Error fetching learned associations', learnedAssociationsResult.error);
            } else {
                const associations = (learnedAssociationsResult.data || []).map(a => ({
                    id: a.id,
                    normalizedDescription: a.normalized_description,
                    contributorNormalizedName: a.contributor_normalized_name,
                    churchId: a.church_id,
                    user_id: a.user_id,
                }));
                setLearnedAssociations(associations);
            }
    
            if (!hasCachedData) {
                setIsLoading(false);
            }
            
            // Mark initial load as largely complete so we can trust empty states
            setInitialLoadComplete(true);

            // PHASE 2: Background Fetch - Heavy Data
            // Fetch the heavy 'data' column silently to populate dashboard charts
            if (savedReportsMetaResult.data && savedReportsMetaResult.data.length > 0) {
                const { data: heavyData, error: heavyError } = await supabase
                    .from('saved_reports')
                    .select('id, data');
                
                if (!heavyError && heavyData) {
                    setSavedReports(prev => prev.map(report => {
                        const freshData = heavyData.find(d => d.id === report.id);
                        // Only update if we actually got data, otherwise keep existing
                        return freshData ? { ...report, data: freshData.data as any } : report;
                    }));
                } else if (heavyError) {
                    Logger.error('Background fetch of report data failed', heavyError);
                }
            }
        };
    
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]); 

    // --- Async Calculation Effects ---
    const allHistoricalResults = useMemo(() => {
        return savedReports
            .filter(r => r.data && r.data.results)
            .flatMap(report => report.data!.results);
    }, [savedReports]);

    useEffect(() => {
        // DETERMINE SOURCE OF DASHBOARD DATA
        // Priority 1: Active Session (matchResults)
        // Priority 2: Aggregated History (allHistoricalResults)
        let resultsToProcess: MatchResult[] = [];

        if (matchResults.length > 0) {
            resultsToProcess = matchResults;
        } else if (allHistoricalResults.length > 0) {
            resultsToProcess = allHistoricalResults;
        } else {
            // CRITICAL FIX: Do not wipe the summary if we are still loading data.
            // We only reset to zero if we are SURE the initial fetch is done and there is genuinely no data.
            if (initialLoadComplete && savedReports.length === 0 && !hasActiveSession) {
                 setSummary(INITIAL_SUMMARY);
            }
            // If loading is not complete, do NOTHING (keep the persisted summary from localStorage)
            return;
        }

        const timer = setTimeout(() => {
            // Ignore deleted results for dashboard summary
            const results = resultsToProcess.filter(r => !r.isDeleted);
            
            const autoConfirmed = results.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod));
            const manualConfirmed = results.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));
            const pending = results.filter(r => r.status === 'NÃO IDENTIFICADO');
    
            const valuePerChurch = new Map<string, number>();
            results.forEach(r => {
                if (r.status === 'IDENTIFICADO' && r.church.name !== '---' && r.transaction.amount > 0) {
                    const current = valuePerChurch.get(r.church.name) || 0;
                    valuePerChurch.set(r.church.name, current + r.transaction.amount);
                }
            });

            // Calculate method counts
            const methodCounts: Record<string, number> = { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 };
            results.forEach(result => {
                if (result.status === 'IDENTIFICADO') {
                    const method = result.matchMethod || 'AUTOMATIC';
                    if (method in methodCounts) methodCounts[method]++;
                    else methodCounts['AUTOMATIC']++;
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
                totalValue: results.reduce((sum, r) => sum + r.transaction.amount, 0),
                valuePerChurch: Array.from(valuePerChurch.entries()).sort((a, b) => b[1] - a[1]),
                methodCounts,
            });
        }, 10); 
        return () => clearTimeout(timer);
    }, [matchResults, allHistoricalResults, savedReports.length, hasActiveSession, initialLoadComplete]);

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

    const isCompareDisabled = useMemo(() => !bankStatementFile || contributorFiles.length === 0, [bankStatementFile, contributorFiles]);

    
    const learnAssociation = useCallback(async (matchResult: MatchResult) => {
        if (!user || !matchResult.contributor?.normalizedName || !matchResult.church?.id || matchResult.church.id === 'unidentified') {
            return;
        }
    
        const association: TablesInsert<'learned_associations'> = {
            user_id: user.id,
            contributor_normalized_name: matchResult.contributor.normalizedName,
            normalized_description: normalizeString(matchResult.transaction.description, customIgnoreKeywords),
            church_id: matchResult.church.id,
        };
    
        const { error } = await supabase
            .from('learned_associations')
            .upsert(association, { onConflict: 'contributor_normalized_name' });
        
        if (error) {
            Logger.error('Error saving learned association', error);
        } else {
            setLearnedAssociations(prev => {
                const existingIndex = prev.findIndex(la => la.contributorNormalizedName === association.contributor_normalized_name);
                const newAssociation: LearnedAssociation = { ...association, contributorNormalizedName: association.contributor_normalized_name, churchId: association.church_id, normalizedDescription: association.normalized_description };
                if (existingIndex > -1) {
                    const updated = [...prev];
                    updated[existingIndex] = newAssociation;
                    return updated;
                }
                return [...prev, newAssociation];
            });
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
        // Removed explicit setSummary(INITIAL_SUMMARY) to allow useEffect to recalculate from history if available
        showToast("Resultados da conciliação foram limpos.", 'success');
    }, [setMatchResults, setReportPreviewData, setHasActiveSession, showToast]);

    const resetApplicationData = useCallback(async () => {
        if (!user) return;
        const [banksError, churchesError, reportsError, associationsError] = await Promise.all([
            supabase.from('banks').delete().neq('id', '0'), // Reverted filter
            supabase.from('churches').delete().neq('id', '0'), // Reverted filter
            supabase.from('saved_reports').delete().neq('id', '0'), // Reverted filter
            supabase.from('learned_associations').delete().neq('id', '0'), // Reverted filter
        ]);

        if(banksError.error || churchesError.error || reportsError.error || associationsError.error) {
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
        setSummary(INITIAL_SUMMARY); // Explicitly reset summary here because SavedReports are also gone
        setSimilarityLevel(80);
        setDayTolerance(2);
        setCustomIgnoreKeywords(DEFAULT_IGNORE_KEYWORDS);
        showToast("Todos os dados da aplicação foram redefinidos.", 'success');
    }, [user, setBankStatementFile, setContributorFiles, setMatchResults, setReportPreviewData, setHasActiveSession, setSimilarityLevel, setDayTolerance, setCustomIgnoreKeywords, setSavedReports, showToast, setChurches, setBanks, setLearnedAssociations, setSummary]);

    const handleStatementUpload = useCallback((content: string, fileName: string, bankId: string) => {
        setBankStatementFile({ bankId, content, fileName });
    }, [setBankStatementFile]);

    const handleContributorsUpload = useCallback((content: string, fileName: string, churchId: string) => {
        setContributorFiles(prev => {
            const existing = prev.filter(f => f.churchId !== churchId);
            return [...existing, { churchId, content, fileName }];
        });
    }, [setContributorFiles]);

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
            const newResults = comparisonType === 'expenses' ? [] : incomeResultsForDashboard;
            setMatchResults(newResults);
            
            // IMPORTANT: Set flag to true immediately to indicate active data
            setHasActiveSession(true);
            
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
        dayTolerance, comparisonType, customIgnoreKeywords, showToast, learnedAssociations,
        setAllTransactions, setReportPreviewData, setMatchResults, setHasActiveSession, setActiveView, setIsLoading
    ]);
    
    const handleBackToSettings = useCallback(() => {
        setActiveView('upload');
        setReportPreviewData(null);
    }, [setActiveView, setReportPreviewData]);

    const discardCurrentReport = useCallback(() => {
        setReportPreviewData(null);
        setBankStatementFile(null);
        setContributorFiles([]);
        setMatchResults([]); 
        setHasActiveSession(false); 
        // Removed explicit setSummary(INITIAL_SUMMARY) to allow history aggregation fallback
        showToast("Sessão descartada. Você pode iniciar uma nova conciliação.", 'success');
        setActiveView('upload');
    }, [setReportPreviewData, setBankStatementFile, setContributorFiles, setMatchResults, setHasActiveSession, showToast, setActiveView]);

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
                learnAssociation(updatedRow);
            }
        } catch (error) {
            Logger.error("AI Analysis failed", error, { transactionId });
            Metrics.increment('apiErrors');
            setAiSuggestion({ id: transactionId, name: "Erro na análise." });
        } finally {
            setLoadingAiId(null);
        }
    }, [matchResults, reportPreviewData, allContributorsWithChurch, setMatchResults, updateReportData, activeView, showToast, learnAssociation]);

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
            setBanks(prev => [...prev, insertedData as any]);
            showToast('Banco adicionado com sucesso!', 'success');
        }
    }, [user, showToast, setBanks]);

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
            setBanks(prev => prev.map(b => (b.id === bankId ? (updatedData as any) : b)));
            showToast('Banco atualizado com sucesso!', 'success');
            closeEditBank();
        }
    }, [showToast, closeEditBank, setBanks]);
    
    const addChurch = useCallback(async (data: ChurchFormData) => {
        if (!data.name.trim() || !user) return;

        const newChurchData = {
            name: data.name.trim(),
            address: data.address.trim(),
            pastor: data.pastor.trim(),
            logoUrl: data.logoUrl || `https://placehold.co/100x100/1e293b/ffffff?text=${data.name.trim().charAt(0)}`,
            user_id: user.id,
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
            setChurches(prev => [...prev, insertedData as any]);
            showToast('Igreja adicionada com sucesso!', 'success');
        }
    }, [user, showToast, setChurches]);

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
            setChurches(prev => prev.map(c => (c.id === churchId ? (updatedData as any) : c)));
            showToast('Igreja atualizada com sucesso!', 'success');
            closeEditChurch();
        }
    }, [showToast, closeEditChurch, setChurches]);
    
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
        learnAssociation(updatedRow);
    
        showToast('Identificação salva e relatório da igreja atualizado com sucesso!', 'success');
        closeManualIdentify();
    }, [reportPreviewData, churches, updateReportData, showToast, closeManualIdentify, learnAssociation]);


    const openManualMatchModal = useCallback((recordToMatch: MatchResult) => {
        if (!recordToMatch.contributor) return;

        const matchedTxIds = new Set(
            Object.values(reportPreviewData?.income || {})
                .flat()
                .filter(r => r.status === 'IDENTIFICADO' && !r.transaction.id.startsWith('pending-') && !r.isDeleted)
                .map(r => r.transaction.id)
        );
        
        const availableTransactions = allTransactions.filter(tx => !matchedTxIds.has(tx.id) && tx.amount > 0);
        
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
            
            learnAssociation(mergedResult);

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
    }, [manualMatchState, closeManualMatchModal, showToast, setMatchResults, setReportPreviewData, learnAssociation]);


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
                // Soft delete logic: mark as deleted instead of removing
                setReportPreviewData(prev => {
                    if (!prev) return null;
                    const newPreview = { income: { ...prev.income }, expenses: { ...prev.expenses } };

                    // Search and mark as deleted in income
                    for (const churchId in newPreview.income) {
                        newPreview.income[churchId] = newPreview.income[churchId].map(
                            r => r.transaction.id === deletingItem.id ? { ...r, isDeleted: true } : r
                        );
                    }

                    // Search and mark as deleted in expenses
                    for (const groupId in newPreview.expenses) {
                        newPreview.expenses[groupId] = newPreview.expenses[groupId].map(
                            r => r.transaction.id === deletingItem.id ? { ...r, isDeleted: true } : r
                        );
                    }
                    return newPreview;
                });
                // Also update matchResults for consistency
                setMatchResults(prev => prev.map(r => r.transaction.id === deletingItem.id ? { ...r, isDeleted: true } : r));
                showToast('Linha excluída do relatório.', 'success');
                break;
            case 'uploaded-files':
                clearUploadedFiles();
                break;
            case 'match-results':
                clearMatchResults();
                break;
            case 'all-data':
                await resetApplicationData();
                break;
            case 'report-saved':
                const { error: deleteError } = await supabase.from('saved_reports').delete().eq('id', deletingItem.id);
                if (deleteError) {
                    Logger.error('Error deleting saved report', deleteError);
                    showToast('Falha ao excluir o relatório salvo.', 'error');
                } else {
                    setSavedReports(prev => prev.filter(r => r.id !== deletingItem.id));
                    showToast('Relatório salvo excluído com sucesso!', 'success');
                }
                break;
        }
        closeDeleteConfirmation();
    }, [deletingItem, bankStatementFile, setBankStatementFile, setContributorFiles, setReportPreviewData, setMatchResults, closeDeleteConfirmation, resetApplicationData, clearUploadedFiles, clearMatchResults, showToast, setSavedReports, setBanks, setChurches]);

    const openSearchFilters = useCallback(() => setIsSearchFiltersOpen(true), []);
    const closeSearchFilters = useCallback(() => setIsSearchFiltersOpen(false), []);
    const clearSearchFilters = useCallback(() => setSearchFilters(DEFAULT_SEARCH_FILTERS), [setSearchFilters]);

    const openSaveReportModal = useCallback((state: SavingReportState) => setSavingReportState(state), []);
    const closeSaveReportModal = useCallback(() => setSavingReportState(null), []);

    const confirmSaveReport = useCallback(async (name: string) => {
        if (!savingReportState || !user) return;

        // If saving from a search, don't include source files as they are not in context.
        const sourceFilesToSave = savingReportState.type === 'search' ? [] : contributorFiles;
        const bankStatementToSave = savingReportState.type === 'search' ? null : bankStatementFile;

        const reportToSave = {
            name,
            user_id: user.id,
            record_count: savingReportState.results.length,
            data: {
                results: savingReportState.results,
                sourceFiles: sourceFilesToSave,
                bankStatementFile: bankStatementToSave,
            } as unknown as Json,
        };

        const { data: insertedReport, error } = await supabase
            .from('saved_reports')
            .insert(reportToSave)
            .select()
            .single();

        if (error) {
            Logger.error('Error saving report', error);
            showToast('Falha ao salvar o relatório.', 'error');
        } else if (insertedReport) {
            const newSavedReport: SavedReport = {
                id: insertedReport.id,
                name: insertedReport.name,
                createdAt: insertedReport.created_at,
                recordCount: insertedReport.record_count,
                data: insertedReport.data as unknown as { results: MatchResult[], sourceFiles: SourceFile[], bankStatementFile?: { bankId: string, content: string, fileName: string } | null },
                user_id: insertedReport.user_id,
            };
            setSavedReports(prev => [newSavedReport, ...prev]);
            showToast(t('reports.saveReportSuccess'), 'success');
        }
        
        closeSaveReportModal();
    }, [savingReportState, user, showToast, closeSaveReportModal, t, contributorFiles, bankStatementFile, setSavedReports]);

    const viewSavedReport = useCallback(async (reportId: string) => {
        let report = savedReports.find(r => r.id === reportId);
        if (!report) return;

        // LAZY LOADING: If data is missing, fetch it on demand.
        if (!report.data) {
             setIsLoading(true);
             const { data, error } = await supabase.from('saved_reports').select('data').eq('id', reportId).single();
             
             if (error || !data) {
                 Logger.error('Error loading report data', error);
                 showToast('Falha ao carregar o conteúdo do relatório.', 'error');
                 setIsLoading(false);
                 return;
             }

             report = { ...report, data: data.data as any };
             setIsLoading(false);
        }

        if (!report.data) return; 

        const { results, sourceFiles, bankStatementFile } = report.data;

        // Restore files state for this session
        setContributorFiles(sourceFiles || []);
        setBankStatementFile(bankStatementFile || null);

        const incomeResults = results.filter(r => r.transaction.amount >= 0);
        const expenseResults = results.filter(r => r.transaction.amount < 0);
        
        const incomeGrouped = groupResultsByChurch(incomeResults);
        const expenseGrouped: GroupedReportData = expenseResults.length > 0 ? { 'all_expenses_group': expenseResults } : {};

        setReportPreviewData({ income: incomeGrouped, expenses: expenseGrouped });
        setMatchResults(incomeResults);
        
        // IMPORTANT: Set flag to true to indicate we are in an active session
        setHasActiveSession(true);
        
        setActiveView('reports');
    }, [savedReports, setReportPreviewData, setMatchResults, setHasActiveSession, setActiveView, setContributorFiles, setBankStatementFile, setIsLoading, showToast]);

    const saveFilteredReport = useCallback((results: MatchResult[]) => {
        openSaveReportModal({
            type: 'search',
            results: results,
        });
    }, [openSaveReportModal]);

    const openDivergenceModal = useCallback((match: MatchResult) => {
        setDivergenceConfirmation(match);
    }, []);

    const closeDivergenceModal = useCallback(() => setDivergenceConfirmation(null), []);

    const confirmDivergence = useCallback((divergentMatch: MatchResult) => {
        learnAssociation(divergentMatch);
        closeDivergenceModal();
    }, [learnAssociation, closeDivergenceModal]);

    const rejectDivergence = useCallback((divergentMatch: MatchResult) => {
        // User rejected the match. Revert it to unidentified.
        const revertedMatch: MatchResult = {
            ...divergentMatch,
            status: 'NÃO IDENTIFICADO',
            contributor: null,
            church: PLACEHOLDER_CHURCH,
            matchMethod: undefined,
            similarity: 0,
            contributorAmount: undefined,
            divergence: undefined,
        };

        // Find which report type it's in (income/expenses)
        let reportType: 'income' | 'expenses' | undefined;
        if (reportPreviewData) {
            for (const type of ['income', 'expenses'] as const) {
                for (const cId in reportPreviewData[type]) {
                    if (reportPreviewData[type][cId].some(r => r.transaction.id === revertedMatch.transaction.id)) {
                        reportType = type;
                        break;
                    }
                }
                if (reportType) break;
            }
        }

        if (reportType) {
            updateReportData(revertedMatch, reportType);
        } else {
            setMatchResults(prev => prev.map(r => r.transaction.id === revertedMatch.transaction.id ? revertedMatch : r));
        }
        
        closeDivergenceModal();
    }, [reportPreviewData, updateReportData, setMatchResults, closeDivergenceModal]);
    
    const value = useMemo(() => ({
        banks, churches, bankStatementFile, contributorFiles, matchResults,
        loadingAiId, aiSuggestion, similarityLevel, dayTolerance, editingBank, editingChurch,
        manualIdentificationTx, deletingItem, summary, allContributorsWithChurch, isCompareDisabled, reportPreviewData,
        comparisonType, setComparisonType, customIgnoreKeywords,
        savedReports, allHistoricalResults, isSearchFiltersOpen, searchFilters, savingReportState,
        divergenceConfirmation, learnedAssociations, hasActiveSession, // Expose flag
        setBanks, setChurches, setSimilarityLevel, setDayTolerance, setMatchResults, setReportPreviewData,
        addIgnoreKeyword, removeIgnoreKeyword,
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile,
        handleCompare, handleAnalyze, updateReportData,
        openEditBank, closeEditBank, updateBank, addBank,
        openEditChurch, closeEditChurch, updateChurch, addChurch,
        openDeleteConfirmation, closeDeleteConfirmation, confirmDeletion,
        openManualIdentify, closeManualIdentify, confirmManualIdentification,
        openManualMatchModal, closeManualMatchModal, confirmManualAssociation,
        handleBackToSettings, manualMatchState,
        discardCurrentReport,
        openSearchFilters, closeSearchFilters, setSearchFilters, clearSearchFilters,
        viewSavedReport, saveFilteredReport, openSaveReportModal, closeSaveReportModal, confirmSaveReport,
        openDivergenceModal, closeDivergenceModal, confirmDivergence, rejectDivergence,
    }), [
        banks, churches, bankStatementFile, contributorFiles, matchResults,
        loadingAiId, aiSuggestion, similarityLevel, dayTolerance, editingBank, editingChurch,
        manualIdentificationTx, deletingItem, summary, allContributorsWithChurch, isCompareDisabled, reportPreviewData,
        comparisonType, customIgnoreKeywords, savedReports, allHistoricalResults, isSearchFiltersOpen, searchFilters, savingReportState,
        divergenceConfirmation, learnedAssociations, hasActiveSession,
        setBanks, setChurches, setSimilarityLevel, setDayTolerance, setMatchResults, setReportPreviewData,
        addIgnoreKeyword, removeIgnoreKeyword,
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile,
        handleCompare, handleAnalyze, updateReportData,
        openEditBank, closeEditBank, updateBank, addBank,
        openEditChurch, closeEditChurch, updateChurch, addChurch,
        openDeleteConfirmation, closeDeleteConfirmation, confirmDeletion,
        openManualIdentify, closeManualIdentify, confirmManualIdentification,
        openManualMatchModal, closeManualMatchModal, confirmManualAssociation,
        handleBackToSettings, manualMatchState,
        discardCurrentReport,
        openSearchFilters, closeSearchFilters, setSearchFilters, clearSearchFilters,
        viewSavedReport, saveFilteredReport, openSaveReportModal, closeSaveReportModal, confirmSaveReport,
        openDivergenceModal, closeDivergenceModal, confirmDivergence, rejectDivergence,
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};