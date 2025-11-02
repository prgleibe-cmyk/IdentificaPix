import React, { createContext, useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import {
  Bank, Church, Contributor, MatchResult,
  GroupedReportData, Transaction, DeletingItem,
  SearchFilters, ComparisonType, SavedReport
} from '../types';

export const AppContext = createContext<any>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('🟢 AppProvider MONTADO');

  const [banks, setBanks] = useState<Bank[]>(() => {
    try {
      const data = JSON.parse(localStorage.getItem('banks') || '[]');
      console.log('📦 Bancos carregados:', data);
      return data;
    } catch {
      return [];
    }
  });

  const [churches, setChurches] = useState<Church[]>(() => {
    try {
      const data = JSON.parse(localStorage.getItem('churches') || '[]');
      console.log('📦 Igrejas carregadas:', data);
      return data;
    } catch {
      return [];
    }
  });

  const [bankStatementFile, setBankStatementFile] = useState<any>(null);
  const [contributorFiles, setContributorFiles] = useState<any[]>([]);
  const [similarityLevel, setSimilarityLevel] = useState(70);
  const [dayTolerance, setDayTolerance] = useState(3);
  const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
  const [isCompareDisabled, setIsCompareDisabled] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);

  // 🔹 Persistência no localStorage
  useEffect(() => {
    localStorage.setItem('banks', JSON.stringify(banks));
  }, [banks]);

  useEffect(() => {
    localStorage.setItem('churches', JSON.stringify(churches));
  }, [churches]);

  const showToast = (msg: string, type: string) => {
    console.log(`[Toast] ${type}: ${msg}`);
  };

  const handleCompare = async () => {
    console.log('🚀 handleCompare foi chamado');
    if (!bankStatementFile || contributorFiles.length === 0) {
      showToast('Carregue o extrato bancário e os arquivos das igrejas antes de comparar.', 'error');
      return;
    }

    setIsCompareDisabled(true);
    showToast('Iniciando comparação...', 'info');

    try {
      const parseCSV = (content: string) => Papa.parse(content, { header: true, skipEmptyLines: true }).data;
      const bankData = parseCSV(bankStatementFile.content);
      const contributorsData = contributorFiles.map(f => ({
        churchId: f.churchId,
        data: parseCSV(f.content)
      }));

      const results: MatchResult[] = [];
      for (const c of contributorsData) {
        for (const cRow of c.data) {
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
                transaction: { id: uuidv4(), amount: bAmount, date: bDate.toISOString() },
                contributor: { id: c.churchId, name: 'Igreja' } as Contributor,
                status: 'IDENTIFICADO',
                matchMethod: 'AUTOMATIC',
                similarity: similarityLevel,
              });
            }
          }
        }
      }

      setMatchResults(results);
      showToast(`Comparação concluída com ${results.length} correspondências`, 'success');
    } catch (err) {
      console.error('❌ Erro na comparação:', err);
      showToast('Erro ao processar comparação.', 'error');
    } finally {
      setIsCompareDisabled(false);
    }
  };

  const value = useMemo(() => ({
    banks,
    churches,
    setBanks,
    setChurches,
    showToast,
    handleCompare,
    similarityLevel,
    setSimilarityLevel,
    dayTolerance,
    setDayTolerance,
    comparisonType,
    setComparisonType,
    isCompareDisabled,
    bankStatementFile,
    setBankStatementFile,
    contributorFiles,
    setContributorFiles
  }), [
    banks, churches, similarityLevel, dayTolerance,
    comparisonType, isCompareDisabled, bankStatementFile, contributorFiles
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
