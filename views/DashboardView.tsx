import React, { useContext, useMemo, useState, useRef } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { formatCurrency } from '../utils/formatters';
import { EmptyState } from '../components/EmptyState';
import { SummaryCard } from '../components/SummaryCard';
import { MatchMethod, MatchResult } from '../types';
import {
  XCircleIcon,
  UploadIcon,
  SparklesIcon,
  UserPlusIcon,
  BrainIcon,
  BoltIcon,
} from '../components/Icons';

// =============== Helpers e subcomponentes omitidos para foco =================
// (LineChart, DonutChart, BarChart, MatchMethodBreakdown — iguais aos seus, sem alterações de lógica)
// ============================================================================

// 🔹 Componente Principal
export const DashboardView: React.FC = () => {
  const context = useContext(AppContext);
  const { t, language } = useTranslation();

  // --- Proteções contra valores indefinidos do contexto ---
  const summary = context?.summary || {
    identifiedCount: 0,
    unidentifiedCount: 0,
    autoConfirmed: { count: 0, value: 0 },
    manualConfirmed: { count: 0, value: 0 },
    pending: { count: 0, value: 0 },
    valuePerChurch: [],
  };
  const setActiveView = context?.setActiveView || (() => {});
  const churches = context?.churches || [];
  const savedReports = context?.savedReports || [];

  // --- Estado inicial vazio ---
  if (!Array.isArray(savedReports) || savedReports.length === 0) {
    return (
      <EmptyState
        icon={<UploadIcon className="w-8 h-8 text-blue-700 dark:text-blue-400" />}
        title={t('empty.dashboard.saved.title')}
        message={t('empty.dashboard.saved.message')}
        action={{
          text: t('empty.dashboard.saved.action'),
          onClick: () => setActiveView('upload'),
        }}
      />
    );
  }

  // --- Cálculos principais ---
  const total = summary.identifiedCount + summary.unidentifiedCount;
  const identifiedPercent = total > 0 ? (summary.identifiedCount / total) * 100 : 0;

  const allSavedResults = useMemo(
    () => savedReports.flatMap((r) => Object.values(r.incomeData || {}).flat()),
    [savedReports]
  );

  const matchMethodCounts = useMemo(() => {
    const counts: Record<MatchMethod, number> = {
      AUTOMATIC: 0,
      MANUAL: 0,
      AI: 0,
      LEARNED: 0,
    };
    allSavedResults.forEach((r: any) => {
      if (r.status === 'IDENTIFICADO' && r.matchMethod) counts[r.matchMethod]++;
      else if (r.status === 'IDENTIFICADO') counts.AUTOMATIC++;
    });
    return counts;
  }, [allSavedResults]);

  const identificationChartData = [
    { value: summary.identifiedCount, color: 'text-green-500' },
    { value: summary.unidentifiedCount, color: 'text-yellow-300 dark:text-yellow-700/80' },
  ];

  const lineChartData = useMemo(() => {
    if (!Array.isArray(savedReports) || savedReports.length === 0) return [];

    return savedReports
      .map((report) => {
        const dateObj = new Date(report.createdAt);
        const date = `${String(dateObj.getDate()).padStart(2, '0')}/${String(
          dateObj.getMonth() + 1
        ).padStart(2, '0')}`;
        const totalValue = Object.values(report.incomeData || {})
          .flat()
          .filter((r: MatchResult) => r.status === 'IDENTIFICADO')
          .reduce((sum: number, r: MatchResult) => sum + (r.transaction?.amount || 0), 0);

        return { date, value: totalValue, timestamp: dateObj.getTime() };
      })
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(({ date, value }) => ({ date, value }));
  }, [savedReports]);

  const methodBreakdownData = [
    { value: matchMethodCounts.AUTOMATIC, color: 'text-teal-500', label: t('dashboard.matchMethod.automatic'), Icon: BoltIcon },
    { value: matchMethodCounts.AI, color: 'text-blue-500', label: t('dashboard.matchMethod.ai'), Icon: SparklesIcon },
    { value: matchMethodCounts.LEARNED, color: 'text-purple-500', label: t('dashboard.matchMethod.learned'), Icon: BrainIcon },
    { value: matchMethodCounts.MANUAL, color: 'text-slate-500', label: t('dashboard.matchMethod.manual'), Icon: UserPlusIcon },
  ];

  const churchValueMap = useMemo(() => new Map(summary.valuePerChurch || []), [summary.valuePerChurch]);
  const churchBarChartData = useMemo(
    () =>
      churches
        .map((church) => ({
          label: church.name,
          value: churchValueMap.get(church.name) || 0,
        }))
        .sort((a, b) => b.value - a.value),
    [churches, churchValueMap]
  );

  // --- Renderização principal ---
  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SummaryCard
          title={t('dashboard.autoConfirmed')}
          count={summary.autoConfirmed.count}
          value={summary.autoConfirmed.value}
          icon={<BoltIcon className="w-8 h-8 text-green-600 dark:text-green-500" />}
          language={language}
        />
        <SummaryCard
          title={t('dashboard.manualConfirmed')}
          count={summary.manualConfirmed.count}
          value={summary.manualConfirmed.value}
          icon={<UserPlusIcon className="w-8 h-8 text-blue-700 dark:text-blue-500" />}
          language={language}
        />
        <SummaryCard
          title={t('dashboard.pending')}
          count={summary.pending.count}
          value={summary.pending.value}
          icon={<XCircleIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />}
          language={language}
        />
      </div>

      {/* Visual Analysis Section */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {t('dashboard.visualAnalysis')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Identified value by report */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
              {t('dashboard.identifiedValueByReport')}
            </h4>
            <LineChart data={lineChartData} formatValue={(v) => formatCurrency(v, language)} />
          </div>

          {/* Donut chart */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
            <h4 className="text-sm font-semibold text-center text-slate-800 dark:text-slate-200 mb-2">
              {t('dashboard.identificationRatio')}
            </h4>
            <div className="flex-grow flex items-center justify-center">
              <DonutChart
                data={identificationChartData}
                centerText={`${identifiedPercent.toFixed(0)}%`}
                centerLabel={t('table.status.identified')}
              />
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
              {t('dashboard.identifiedValuesByChurch')}
            </h4>
            {churchBarChartData.length > 0 ? (
              <BarChart data={churchBarChartData} formatValue={(v) => formatCurrency(v, language)} />
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                {t('dashboard.noValues')}
              </div>
            )}
          </div>

          {/* Match method breakdown */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
              {t('dashboard.matchMethodBreakdown')}
            </h4>
            <MatchMethodBreakdown data={methodBreakdownData} total={summary.identifiedCount} />
          </div>
        </div>
      </div>
    </>
  );
};
