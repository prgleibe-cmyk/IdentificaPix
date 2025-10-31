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
    const [similarityLevel, setSimilarityLevel] = useState<number>(70);
    const [dayTolerance, setDayTolerance] = useState<number>(3);
    const [isCompareDisabled, setIsCompareDisabled] = useState(false);
    const [comparisonType, setComparisonType] = useState<ComparisonType>('income');

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    const showToast = (msg: string, type: string) => {
        console.log(`[Toast] ${type}: ${msg}`);
    };

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

            showToast(`Comparação concluída: ${results.length} correspondências encontradas.`, 'success');
        } catch (err) {
            console.error(err);
            showToast('Erro ao processar comparação.', 'error');
            setIsLoading(false);
            setIsCompareDisabled(false);
        }
    };

    const value = useMemo(() => ({
        theme,
        banks,
        churches,
        learnedAssociations,
        bankStatementFile,
        contributorFiles,
        matchResults,
        activeView,
        isLoading,
        similarityLevel,
        dayTolerance,
        isCompareDisabled,
        comparisonType,
        setComparisonType,
        toggleTheme,
        setBanks,
        setChurches,
        setSimilarityLevel,
        setDayTolerance,
        setMatchResults,
        handleStatementUpload,
        handleContributorsUpload,
        removeBankStatementFile,
        removeContributorFile,
        handleCompare
    }), [
        theme, banks, churches, bankStatementFile, contributorFiles, matchResults,
        isLoading, similarityLevel, dayTolerance, isCompareDisabled, comparisonType
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
