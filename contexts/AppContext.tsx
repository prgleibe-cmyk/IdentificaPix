import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
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
  // 🔹 Tema
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    return 'light';
  });
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  // 🔹 Bancos e Igrejas persistentes
  const [banks, setBanks] = useState<Bank[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('banks') || '[]');
    } catch {
      return [];
    }
  });
  const [churches, setChurches] = useState<Church[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('churches') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('banks', JSON.stringify(banks));
  }, [banks]);
  useEffect(() => {
    localStorage.setItem('churches', JSON.stringify(churches));
  }, [churches]);

  // 🔹 Estados principais
  const [bankStatementFile, setBankStatementFile] = useState<any>(null);
  const [contributorFiles, setContributorFiles] = useState<any[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [similarityLevel, setSimilarityLevel] = useState<number>(70);
  const [dayTolerance, setDayTolerance] = useState<number>(3);
  const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
  const [isCompareDisabled, setIsCompareDisabled] = useState(false);
  const [toast, setToast] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 🔹 Toast simplificado
  const showToast = (msg: string, type: string) => {
    console.log(`[Toast] ${type}: ${msg}`);
    setToast({ message: msg, type });
  };

  // 🔹 Upload de arquivos
  const handleStatementUpload = (content: string, fileName: string, bankId: string) => {
    setBankStatementFile({ bankId, content, fileName });
    showToast('Extrato carregado com sucesso!', 'success');
  };

  const handleContributorsUpload = (content: string, fileName: string, churchId: string) => {
    setContributorFiles(prev => {
      const exists = prev.find(f => f.churchId === churchId);
      if (exists) {
        return prev.map(f => (f.churchId === churchId ? { ...f, content, fileName } : f));
      }
      return [...prev, { churchId, content, fileName }];
    });
    showToast('Arquivo da igreja carregado com sucesso!', 'success');
  };

  const removeBankStatementFile = () => setBankStatementFile(null);
  const removeContributorFile = (churchId?: string) => {
    if (!churchId) return setContributorFiles([]);
    setContributorFiles(prev => prev.filter(f => f.churchId !== churchId));
  };

  // 🔹 Comparação (corrigida)
  const handleCompare = async () => {
    if (!bankStatementFile || contributorFiles.length === 0) {
      showToast('Carregue o extrato bancário e pelo menos um arquivo de igreja.', 'error');
      return;
    }

    console.clear();
    console.log('🔍 Iniciando comparação...');
    showToast('Iniciando comparação...', 'info');
    setIsLoading(true);
    setIsCompareDisabled(true);

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
            const diffPercent = Math.abs(((bAmount - cAmount) / (cAmount || 1)) * 100);
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
      console.log(`✅ Comparação concluída — ${results.length} correspondências encontradas.`);
      showToast(
        results.length === 0
          ? 'Nenhuma correspondência encontrada.'
          : `${results.length} correspondências encontradas.`,
        results.length === 0 ? 'warning' : 'success'
      );
    } catch (err) {
      console.error('❌ Erro ao processar comparação:', err);
      showToast('Erro ao processar comparação.', 'error');
    } finally {
      setIsLoading(false);
      setIsCompareDisabled(false);
    }
  };

  // 🔹 Valor do contexto
  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      banks,
      setBanks,
      churches,
      setChurches,
      bankStatementFile,
      contributorFiles,
      similarityLevel,
      setSimilarityLevel,
      dayTolerance,
      setDayTolerance,
      comparisonType,
      setComparisonType,
      handleStatementUpload,
      handleContributorsUpload,
      removeBankStatementFile,
      removeContributorFile,
      handleCompare,
      isCompareDisabled,
      isLoading,
      matchResults,
      showToast
    }),
    [
      theme,
      banks,
      churches,
      bankStatementFile,
      contributorFiles,
      similarityLevel,
      dayTolerance,
      comparisonType,
      isCompareDisabled,
      isLoading,
      matchResults
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
