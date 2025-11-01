import React, { createContext, useState, useCallback, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import {
    GroupedReportData,
    MatchResult,
    Transaction,
    Contributor,
    SavedReport,
    Bank,
    Church,
    DeletingItem,
    SearchFilters,
    ComparisonType
} from '../types';

const defaultContextValue: any = {};

export const AppContext = createContext<any>(defaultContextValue);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- Estados principais ---
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
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
    const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
    const [customIgnoreKeywords, setCustomIgnoreKeywords] = useState<string[]>([]);
    const [savingReportState, setSavingReportState] = useState<any>(null);
    const [allHistoricalResults, setAllHistoricalResults] = useState<any[]>([]);
    const [allHistoricalContributors, setAllHistoricalContributors] = useState<any[]>([]);
    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
    const [searchFilters, setSearchFiltersState] = useState<SearchFilters>({} as SearchFilters);

    // --- Tema ---
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    // --- Toast ---
    const showToast = (msg: string, type: string) => {
        setToast({ message: msg, type });
        console.log(`[Toast] ${type}: ${msg}`);
    };

    // --- Upload de arquivos ---
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

    const removeBankStatementFile = () => setBankStatementFile(null);
    const removeContributorFile = (churchId?: string) => {
        if (!churchId) return setContributorFiles([]);
        setContributorFiles(prev => prev.filter(f => f.churchId !== churchId));
    };

    // --- Comparação ---
    const handleCompare = async () => {
        if (!bankStatementFile || contributorFiles.length === 0) {
            showToast('Carregue o extrato bancário e os arquivos das igrejas antes de comparar.', 'error');
            return;
        }

        setIsCompareDisabled(true);
        setIsLoading(true);
        showToast('Iniciando comparação...', 'info');

        try {
            const parseCSV = (content: string) =>
                Papa.parse(content, { header: true, skipEmptyLines: true }).data;

            const bankData = parseCSV(bankStatementFile.content);
            const contributorsData = contributorFiles.map(f => ({
                churchId: f.churchId,
                churchName: churches.find(c => c.id === f.churchId)?.name || f.fileName,
                data: parseCSV(f.content)
            }));

            const results: MatchResult[] = [];
            for (const contributor of contributorsData) {
                for (const cRow of contributor.data) {
                    const cAmount = parseFloat(cRow.amount || cRow.valor || '0');
                    const cDate = new Date(cRow.date || cRow.data);

                    for (const bRow of bankData) {
                        const bAmount = parseFloat(bRow.amount || bRow.valor || '0');
                        const bDate = new Date(bRow.date || bRow.data);

                        const diffDays = Math.abs((bDate.getTime() - cDate.getTime()) / (1000 * 3600 * 24));
                        const diffPercent = Math.abs(((bAmount - cAmount) / cAmount) * 100);
                        const isSimilar = diffPercent <= (100 - similarityLevel);

                        if (diffDays <= dayTolerance && isSimilar) {
                            results.push({
                                transaction: { id: crypto.randomUUID(), amount: bAmount, date: bDate.toISOString() },
                                contributor: { id: contributor.churchId, name: contributor.churchName } as Contributor,
                                status: 'IDENTIFICADO',
                                matchMethod: 'AUTOMATIC',
                                similarity: similarityLevel,
                                church: churches.find(c => c.id === contributor.churchId)!
                            } as MatchResult);
                        }
                    }
                }
            }

            setMatchResults(results);
            setIsLoading(false);
            setIsCompareDisabled(false);

            if (results.length === 0) showToast('Nenhuma correspondência encontrada.', 'warning');
            else showToast(`Comparação concluída: ${results.length} correspondências encontradas.`, 'success');

        } catch (err) {
            console.error(err);
            showToast('Erro ao processar comparação.', 'error');
            setIsLoading(false);
            setIsCompareDisabled(false);
        }
    };

    // --- Funções auxiliares ---
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

    const handleAnalyze = useCallback(async (transactionId: string) => {}, []);

    // --- Valor do contexto ---
    const value = useMemo(() => ({
        theme, banks, churches, learnedAssociations, bankStatementFile, contributorFiles, matchResults, activeView,
        isLoading, loadingAiId, aiSuggestion, similarityLevel, dayTolerance, editingBank, editingChurch,
        manualIdentificationTx, deletingItem, toast, summary, allContributorsWithChurch, isCompareDisabled, reportPreviewData,
        savedReports, comparisonType, setComparisonType, customIgnoreKeywords, savingReportState, allHistoricalResults, allHistoricalContributors,
        isSearchFiltersOpen, searchFilters, toggleTheme, setActiveView, setBanks, setChurches, setSimilarityLevel, setDayTolerance,
        setMatchResults, setReportPreviewData, addIgnoreKeyword:()=>{}, removeIgnoreKeyword:()=>{},
        handleStatementUpload, handleContributorsUpload, removeBankStatementFile, removeContributorFile,
        handleCompare, handleAnalyze, openEditBank, closeEditBank, updateBank, openEditChurch, closeEditChurch,
        updateChurch, openDeleteConfirmation, closeDeleteConfirmation, confirmDeletion, showToast
    }), [
        theme, banks, churches, bankStatementFile, contributorFiles, matchResults, isLoading,
        similarityLevel, dayTolerance, isCompareDisabled, comparisonType
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};