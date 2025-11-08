import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import {
  MatchResult,
  Contributor,
  Bank,
  Church,
  ComparisonType
} from '../types';

console.log('🔥 AppContext foi carregado com sucesso!');

export const AppContext = createContext<any>({});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- Tema ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined')
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  // --- Estados principais ---
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

  const [bankStatementFile, setBankStatementFile] = useState<any>(null);
  const [contributorFiles, setContributorFiles] = useState<any[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [similarityLevel, setSimilarityLevel] = useState<number>(70);
  const [dayTolerance, setDayTolerance] = useState<number>(3);
  const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
  const [isCompareDisabled, setIsCompareDisabled] = useState(false);
  const [toast, setToast] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // --- Toast ---
  const showToast = (msg: string, type: string) => {
    setToast({ message: msg, type });
    console.log(`[Toast] ${type}: ${msg}`);
  };

  // --- Persistência ---
  useEffect(() => localStorage.setItem('banks', JSON.stringify(banks)), [banks]);
  useEffect(() => localStorage.setItem('churches', JSON.stringify(churches)), [churches]);

  // --- Funções de cadastro ---
  const addBank = (bank: Bank) => {
    setBanks(prev => {
      const updated = [...prev, bank];
      localStorage.setItem('banks', JSON.stringify(updated));
      return updated;
    });
    showToast('Banco cadastrado com sucesso!', 'success');
  };

  const addChurch = (church: Church) => {
    setChurches(prev => {
      const updated = [...prev, church];
      localStorage.setItem('churches', JSON.stringify(updated));
      return updated;
    });
    showToast('Igreja cadastrada com sucesso!', 'success');
  };

  // --- Upload ---
  const handleStatementUpload = (content: string, fileName: string, bankId: string) => {
    setBankStatementFile({ bankId, content, fileName });
    showToast('Extrato bancário carregado com sucesso!', 'success');
  };

  const handleContributorsUpload = (content: string, fileName: string, churchId: string) => {
    setContributorFiles(prev => {
      const exists = prev.find(f => f.churchId === churchId);
      if (exists) {
        return prev.map(f => f.churchId === churchId ? { churchId, content, fileName } : f);
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

  // --- Comparação ---
  const handleCompare = useCallback(async () => {
    console.log('▶️ handleCompare chamado');

    if (!bankStatementFile || contributorFiles.length === 0) {
      showToast('Carregue o extrato bancário e os arquivos das igrejas antes de comparar.', 'error');
      return;
    }

    showToast('Iniciando comparação...', 'info');
    setIsCompareDisabled(true);
    setIsLoading(true);

    try {
      const parseCSV = (content: string) => Papa.parse(content, { header: true, skipEmptyLines: true }).data;
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
              });
            }
          }
        }
      }

      console.log('✅ Comparação finalizada', results);
      setMatchResults(results);
      showToast(
        results.length
          ? `Comparação concluída: ${results.length} correspondências encontradas.`
          : 'Nenhuma correspondência encontrada.',
        results.length ? 'success' : 'warning'
      );
    } catch (error) {
      console.error('❌ Erro ao comparar:', error);
      showToast('Erro ao processar comparação.', 'error');
    } finally {
      setIsLoading(false);
      setIsCompareDisabled(false);
    }
  }, [bankStatementFile, contributorFiles, churches, similarityLevel, dayTolerance]);

  // --- Contexto final ---
  const value = useMemo(
    () => ({
      theme, toggleTheme,
      banks, churches, addBank, addChurch,
      bankStatementFile, contributorFiles,
      handleStatementUpload, handleContributorsUpload,
      removeBankStatementFile, removeContributorFile,
      matchResults, handleCompare,
      isCompareDisabled, isLoading,
      similarityLevel, setSimilarityLevel,
      dayTolerance, setDayTolerance,
      comparisonType, setComparisonType,
      toast, showToast
    }),
    [
      theme, banks, churches, bankStatementFile, contributorFiles,
      matchResults, similarityLevel, dayTolerance,
      comparisonType, isCompareDisabled, isLoading
    ]
  );

useEffect(() => {
  try {
    localStorage.setItem('teste', 'ok');
    const valor = localStorage.getItem('teste');
    console.log('🔍 Teste localStorage:', valor);
  } catch (err) {
    console.error('❌ Erro ao acessar localStorage:', err);
  }
}, []);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
