import React, { createContext, useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    GroupedReportData,
    MatchResult,
    Transaction,
    Contributor,
    SavedReport,
    Bank,
    Church,
    DeletingItem,
    SearchFilters
} from '../types';

// --- Valor default seguro para o contexto (evita undefined) ---
const defaultContextValue: any = {
    theme: 'light',
    banks: [] as Bank[],
    churches: [] as Church[],
    learnedAssociations: [] as any[],
    bankStatementFile: null,
    contributorFiles: [] as any[],
    matchResults: [] as MatchResult[],
    activeView: 'reports',
    isLoading: false,
    loadingAiId: null,
    aiSuggestion: null,
    similarityLevel: 70,
    dayTolerance: 3,
    editingBank: null,
    editingChurch: null,
    manualIdentificationTx: null,
    deletingItem: null,
    toast: null,
    summary: null,
    allContributorsWithChurch: [] as Contributor[],
    isCompareDisabled: false,
    reportPreviewData: null,
    savedReports: [] as SavedReport[],
    comparisonType: 'default',
    customIgnoreKeywords: [] as string[],
    savingReportState: null,
    allHistoricalResults: [] as any[],
    allHistoricalContributors: [] as any[],
    isSearchFiltersOpen: false,
    searchFilters: {} as SearchFilters,

    // funções (no-op padrões)
    toggleTheme: () => {},
    setActiveView: (_v: any) => {},
    setBanks: (_b: any) => {},
    setChurches: (_c: any) => {},
    setSimilarityLevel: (_n: any) => {},
    setDayTolerance: (_n: any) => {},
    setMatchResults: (_m: any) => {},
    setReportPreviewData: (_r: any) => {},
    addIgnoreKeyword: (_k: any) => {},
    removeIgnoreKeyword: (_k: any) => {},
    handleStatementUpload: () => {},
    handleContributorsUpload: () => {},
    removeBankStatementFile: () => {},
    removeContributorFile: () => {},
    handleCompare: () => {},
    handleAnalyze: async () => {},
    updateReportData: (_u: any, _t: any) => {},
    openEditBank: (_b?: any) => {},
    closeEditBank: () => {},
    updateBank: (_id?: any, _name?: any) => {},
    addBank: async (_: any) => {},
    openEditChurch: (_c?: any) => {},
    closeEditChurch: () => {},
    updateChurch: (_id?: any, _data?: any) => {},
    addChurch: async (_: any) => {},
    openDeleteConfirmation: (_: any) => {},
    closeDeleteConfirmation: () => {},
    confirmDeletion: () => {},
    openManualIdentify: (_?: any) => {},
    closeManualIdentify: () => {},
    confirmManualIdentification: () => {},
    openManualMatchModal: (_?: any) => {},
    closeManualMatchModal: () => {},
    confirmManualAssociation: (_?: any) => {},
    showToast: (_m: any, _t: any) => {},
    handleBackToSettings: () => {},
    saveCurrentReport: () => {},
    saveGroupReport: () => {},
    viewSavedReport: (_id?: any) => {},
    manualMatchState: null,
    confirmSaveReport: () => {},
    closeSaveReportModal: () => {},
    discardCurrentReport: () => {},
    saveFilteredReport: () => {},
    openSearchFilters: () => {},
    closeSearchFilters: () => {},
    setSearchFilters: (_f: any) => {},
    clearSearchFilters: () => {},
};

export const AppContext = createContext<any>(defaultContextValue);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- Estados ---
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
        }
        return 'light';
    });
    const [banks, setBanks] = useState<Bank[]>([]);
    const [churches, setChurches] = useState<Church[]>([]);
    const [learnedAssociations, setLearnedAssociations] = useState<any[]>([]);
    const [bankStatementFile, setBankStatementFile] = useState<any>(null);
    const [contributorFiles, setContributorFiles] = useState<any[]>([]);
    const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
    const [activeView, setActiveView] = useState<'reports' | 'settings'>('reports');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<any>(null);
    const [similarityLevel, setSimilarityLevel] = useState<number>(70);
    const [dayTolerance, setDayTolerance] = useState<number>(3);
    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [editingChurch, setEditingChurch] = useState<Church | null>(null);
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);
    const [toast, setToast] = useState<any>(null);
    const [summary, setSummary] = useState<any>(null);
    const [allContributorsWithChurch, setAllContributorsWithChurch] = useState<Contributor[]>([]);
    const [isCompareDisabled, setIsCompareDisabled] = useState(false);
    const [reportPreviewData, setReportPreviewData] = useState<{ income: GroupedReportData; expenses: GroupedReportData } | null>(null);
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [comparisonType, setComparisonType] = useState<'default' | 'custom'>('default');
    const [customIgnoreKeywords, setCustomIgnoreKeywords] = useState<string[]>([]);
    const [savingReportState, setSavingReportState] = useState<any>(null);
    const [allHistoricalResults, setAllHistoricalResults] = useState<any[]>([]);
    const [allHistoricalContributors, setAllHistoricalContributors] = useState<any[]>([]);
    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
    const [searchFilters, setSearchFiltersState] = useState<SearchFilters>({});

    // --- Efeito dark mode ---
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    // --- Toast ---
    const showToast = (msg: string, type: string) => {
        setToast({ message: msg, type });
        console.log(`[Toast] ${type}: ${msg}`);
    };

    // --- Funções temporárias / helpers ---
    const getAISuggestion = async (tx: Transaction, contributors: Contributor[]) => "Teste";
    const addLearnedAssociation = (tx: Transaction, contributor: Contributor, church: Church) => {};
    const groupResultsByChurch = (results: MatchResult[]) => ({});
    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    // --- UPLOAD HANDLERS CORRIGIDOS ---
    const handleStatementUpload = (content: string, fileName: string, bankId: string) => {
        setBankStatementFile({ bankId, content, fileName });
    };

    const handleContributorsUpload = (content: string, fileName: string, churchId: string) => {
        setContributorFiles(prev => {
            const existingIndex = prev.findIndex(f => f.churchId === churchId);
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = { churchId, content, fileName };
                return updated;
            }
            return [...prev, { churchId, content, fileName }];
        });
    };

    // --- REMOÇÃO DE ARQUIVOS ---
    const removeBankStatementFile = () => setBankStatementFile(null);
    const removeContributorFile = (churchId?: string) => {
        if (!churchId) return setContributorFiles([]);
        setContributorFiles(prev => prev.filter(f => f.churchId !== churchId));
    };

    // --- Outras funções já existentes ---
    const handleCompare = () => {};
    const openEditBank = (b?: Bank | null) => setEditingBank(b ?? null);
    const closeEditBank = () => setEditingBank(null);
    const updateBank = (id?: string, name?: string) => {
        if (!id) return;
        setBanks(prev => prev.map(b => b.id === id ? { ...b, name: name ?? b.name } : b));
    };
    const openEditChurch = (c?: Church | null) => setEditingChurch(c ?? null);
    const closeEditChurch = () => setEditingChurch(null);
    const updateChurch = (id?: string, data?: Partial<Church>) => {
        if (!id || !data) return;
        setChurches(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    };
    const openDeleteConfirmation = (item?: DeletingItem | null) => setDeletingItem(item ?? null);
    const closeDeleteConfirmation = () => setDeletingItem(null);
    const confirmDeletion = () => {
        if (!deletingItem) return;
        if (deletingItem.type === 'bank') setBanks(prev => prev.filter(b => b.id !== deletingItem.id));
        if (deletingItem.type === 'church') setChurches(prev => prev.filter(c => c.id !== deletingItem.id));
        setDeletingItem(null);
    };
    const openManualIdentify = () => {};
    const closeManualIdentify = () => {};
    const confirmManualIdentification = () => {};
    const openManualMatchModal = () => {};
    const closeManualMatchModal = () => {};
    const confirmManualAssociation = () => {};
    const handleBackToSettings = () => setActiveView('settings');
    const saveCurrentReport = () => {};
    const saveGroupReport = () => {};
    const viewSavedReport = (id?: string) => {};
    const manualMatchState = null;
    const confirmSaveReport = () => {};
    const closeSaveReportModal = () => {};
    const discardCurrentReport = () => {};
    const saveFilteredReport = () => {};
    const openSearchFilters = () => setIsSearchFiltersOpen(true);
    const closeSearchFilters = () => setIsSearchFiltersOpen(false);
    const setSearchFilters = (f?: SearchFilters) => setSearchFiltersState(f ?? {});
    const clearSearchFilters = () => setSearchFiltersState({});
    const addIgnoreKeyword = (kw?: string) => {
        if (!kw) return;
        setCustomIgnoreKeywords(prev => Array.from(new Set([...prev, kw])));
    };
    const removeIgnoreKeyword = (kw?: string) => {
        if (!kw) return;
        setCustomIgnoreKeywords(prev => prev.filter(k => k !== kw));
    };

    // --- Cadastro Banco ---
    const addBank = async (bankData: any) => {
        if (!supabase) {
            showToast('Erro: Supabase não inicializado.', 'error');
            return null;
        }
        let name: string | undefined;
        if (typeof bankData === 'string') name = bankData;
        else if (bankData && typeof bankData.name === 'string') name = bankData.name;
        else if (bankData && bankData.name) name = String(bankData.name);
        if (!name || !name.trim()) {
            showToast('Nome do banco inválido.', 'error');
            return null;
        }
        try {
            const payload = { name: name.trim() };
            const { data, error } = await supabase.from('banks').insert([payload]).select().single();
            if (error) {
                console.error('Erro ao cadastrar banco (supabase):', error);
                showToast(`Erro ao cadastrar banco: ${error.message ?? error}`, 'error');
                return null;
            }
            setBanks(prev => [...prev, data]);
            showToast('Banco cadastrado com sucesso!', 'success');
            return data;
        } catch (err: any) {
            console.error('Erro ao cadastrar banco:', err);
            showToast(`Erro ao cadastrar banco: ${err?.message ?? err}`, 'error');
            return null;
        }
    };

    // --- Cadastro Igreja ---
    const addChurch = async (churchData: any) => {
        if (!supabase) {
            showToast('Erro: Supabase não inicializado.', 'error');
            return null;
        }
        const name = churchData?.name?.toString()?.trim() ?? '';
        const address = churchData?.address?.toString()?.trim() ?? '';
        const pastor = churchData?.pastor?.toString()?.trim() ?? '';
        const logoUrl = churchData?.logoUrl ?? '';
        if (!name) {
            showToast('Nome da igreja inválido.', 'error');
            return null;
        }
        try {
            const payload = { name, address, pastor, logoUrl };
            const { data, error } = await supabase.from('churches').insert([payload]).select().single();
            if (error) {
                console.error('Erro ao cadastrar igreja (supabase):', error);
                showToast(`Erro ao cadastrar igreja: ${error.message ?? error}`, 'error');
                return null;
            }
            setChurches(prev => [...prev, data]);
            showToast('Igreja cadastrada com sucesso!', 'success');
            return data;
        } catch (err: any) {
            console.error('Erro ao cadastrar igreja:', err);
            showToast(`Erro ao cadastrar igreja: ${err?.message ?? err}`, 'error');
            return null;
        }
    };

    // --- Relatórios ---
    const updateReportData = useCallback((updatedRow: MatchResult, reportType: 'income' | 'expenses') => {
        if (reportType === 'income') {
            setMatchResults(prev => prev.map(row => row.transaction.id === updatedRow.transaction.id ? updatedRow : row));
        }
    }, [setMatchResults]);

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
            if (result) reportType = 'income';
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
        } catch (error) {
            console.error("AI Analysis failed", error);
            setAiSuggestion({ id: transactionId, name: "Erro na análise." });
        } finally {
            setLoadingAiId(null);
        }
    }, [matchResults, reportPreviewData, allContributorsWithChurch]);

    // --- Context Value ---
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
        isSearchFiltersOpen, searchFilters
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
