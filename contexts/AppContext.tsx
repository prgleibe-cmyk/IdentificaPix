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
    ChurchFormData,
    DeletingItem,
    SearchFilters
} from '../types';

export const AppContext = createContext<any>(null);

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

    // --- Efeito para aplicar dark mode no <html> ---
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // --- Funções temporárias para compilação ---
    const showToast = (msg: string, type: string) => console.log(`[Toast] ${type}: ${msg}`);
    const getAISuggestion = async (tx: Transaction, contributors: Contributor[]) => "Teste";
    const addLearnedAssociation = (tx: Transaction, contributor: Contributor, church: Church) => {};
    const groupResultsByChurch = (results: MatchResult[]) => ({});
    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
    const handleStatementUpload = () => {};
    const handleContributorsUpload = () => {};
    const removeBankStatementFile = () => {};
    const removeContributorFile = () => {};
    const handleCompare = () => {};
    const openEditBank = () => {};
    const closeEditBank = () => {};
    const updateBank = () => {};
    const openEditChurch = () => {};
    const closeEditChurch = () => {};
    const updateChurch = () => {};
    const openDeleteConfirmation = () => {};
    const closeDeleteConfirmation = () => {};
    const confirmDeletion = () => {};
    const openManualIdentify = () => {};
    const closeManualIdentify = () => {};
    const confirmManualIdentification = () => {};
    const openManualMatchModal = () => {};
    const closeManualMatchModal = () => {};
    const confirmManualAssociation = () => {};
    const handleBackToSettings = () => {};
    const saveCurrentReport = () => {};
    const saveGroupReport = () => {};
    const viewSavedReport = () => {};
    const manualMatchState = null;
    const confirmSaveReport = () => {};
    const closeSaveReportModal = () => {};
    const discardCurrentReport = () => {};
    const saveFilteredReport = () => {};
    const openSearchFilters = () => {};
    const closeSearchFilters = () => {};
    const setSearchFilters = () => {};
    const clearSearchFilters = () => {};
    const addIgnoreKeyword = () => {};
    const removeIgnoreKeyword = () => {};

    // --- Funções de cadastro conectadas ao Supabase ---
const addBank = async (bankData: Omit<Bank, 'id'>) => {
    if (!supabase) return showToast('Erro: Supabase não inicializado.', 'error');

    try {
        console.log('🟦 Enviando dados para Supabase:', bankData);

        const { data, error } = await supabase
            .from('banks')
            .insert([{ name: bankData.name }]) // garante que só o campo name é enviado
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Banco salvo no Supabase:', data);

        setBanks(prev => [...prev, data]);
        showToast('Banco cadastrado com sucesso!', 'success');
    } catch (err: any) {
        console.error('❌ Erro ao cadastrar banco:', err);
        showToast(`Erro ao cadastrar banco: ${err.message}`, 'error');
    }
};

    const addChurch = async (churchData: Omit<Church, 'id'>) => {
        if (!supabase) return showToast('Erro: Supabase não inicializado.', 'error');

        try {
            const { data, error } = await supabase.from('churches').insert([churchData]).select().single();
            if (error) throw error;

            setChurches(prev => [...prev, data]);
            showToast('Igreja cadastrada com sucesso!', 'success');
        } catch (err: any) {
            console.error('Erro ao cadastrar igreja:', err);
            showToast(`Erro ao cadastrar igreja: ${err.message}`, 'error');
        }
    };

    // --- Funções principais ---
    const updateReportData = useCallback((updatedRow: MatchResult, reportType: 'income' | 'expenses') => {
        if (reportType === 'income') {
            setMatchResults(prev => prev.map(row =>
                row.transaction.id === updatedRow.transaction.id ? updatedRow : row
            ));
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
            console.error("AI Analysis failed", error, { transactionId });
            console.count("apiErrors"); // substitui Metrics.increment
            setAiSuggestion({ id: transactionId, name: "Erro na análise." });
        } finally {
            setLoadingAiId(null);
        }
    }, [matchResults, reportPreviewData, allContributorsWithChurch, updateReportData, activeView]);

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
