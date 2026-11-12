import React, { useState, memo } from 'react';
import { useDashboardController } from '../hooks/useDashboardController';
import { EmptyState } from '../components/EmptyState';
import { SummaryCard } from '../components/SummaryCard';
import { BankChipsList } from '../components/reports/BankChipsList';
import { LayoutDashboard } from 'lucide-react';
import {
    XCircleIcon,
    UploadIcon,
    CheckCircleIcon,
    ChartPieIcon
} from '../components/Icons';

// Sub-componentes Modulares
import { DonutChart } from '../components/dashboard/DonutChart';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { EfficiencyHeroCard } from '../components/dashboard/EfficiencyHeroCard';
import { ChurchLeaderboard } from '../components/dashboard/ChurchLeaderboard';

export const DashboardView: React.FC = memo(() => {
    const { 
        summary, user, setActiveView, t, language, identificationRate, 
        pieChartData, maxValuePerChurch, hasData, getGreeting, hasActiveSession,
        selectedBankId, setSelectedBankId, bankList, isLoading
    } = useDashboardController();

    if (hasActiveSession && !hasData && isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="flex flex-col min-h-full gap-3 animate-fade-in pb-8 md:pb-4">
            {/* Header Card */}
            <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                            <LayoutDashboard className="w-4 h-4 stroke-[2]" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                Dashboard
                            </h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Visão geral e indicadores das conciliações e finanças.
                            </p>
                        </div>
                    </div>
                    {summary.isHistorical && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/70 dark:border-amber-900/50 rounded-md text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Modo Histórico Ativo
                        </div>
                    )}
                </div>
            </div>

            {bankList.length > 0 && (
                <div className="flex flex-col gap-1.5 px-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">Filtrar por banco</label>
                    <BankChipsList list={bankList} selectedId={selectedBankId} onSelect={setSelectedBankId} />
                </div>
            )}

            {!hasData ? (
                <div className="flex-1 flex flex-col h-full animate-fade-in-up gap-4 pb-4">
                    {/* Welcome Banner Card */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-card flex-shrink-0">
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                {getGreeting()}, <span className="text-orange-600 dark:text-orange-400">{user?.user_metadata?.full_name?.split(' ')[0] || user?.name?.split(' ')[0] || user?.email?.split('@')[0]?.split('.')[0] || 'Usuário'}</span>!
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-normal">
                                Seu painel de controle financeiro inteligente da igreja.
                            </p>
                        </div>
                    </div>

                    {/* Integrated Empty State Card */}
                    <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 md:p-12 rounded-2xl shadow-card">
                        <EmptyState
                            icon={<UploadIcon />}
                            title={t('empty.dashboard.title')}
                            message={t('empty.dashboard.message')}
                            action={{
                                text: t('empty.dashboard.action'),
                                onClick: () => setActiveView('upload'),
                            }}
                            flat={true}
                        />
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
                <SummaryCard
                    title={t('dashboard.identifiedContributions')}
                    count={summary.identifiedCount}
                    value={summary.autoConfirmed.value + summary.manualConfirmed.value}
                    icon={<CheckCircleIcon />}
                    language={language}
                    accentColor="emerald"
                    delay={0}
                />
                
                <EfficiencyHeroCard 
                    rate={identificationRate} 
                    title={t('dashboard.identificationRatio')} 
                />

                <SummaryCard
                    title={t('dashboard.pending')}
                    count={summary.unidentifiedCount}
                    value={summary.pending.value}
                    icon={<XCircleIcon />}
                    language={language}
                    accentColor="amber"
                    delay={200}
                />
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-2.5 sm:gap-3 items-start">
                <div 
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-200/90 dark:border-slate-700/80 flex flex-col justify-between overflow-hidden animate-fade-in-up fill-mode-backwards"
                    style={{ animationDelay: '300ms' }}
                >
                     <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/60 flex justify-between items-center shrink-0">
                        <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('dashboard.matchMethodBreakdown')}</h3>
                        <div className="p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-slate-400 border border-slate-100 dark:border-slate-700">
                            <ChartPieIcon className="w-3.5 h-3.5" />
                        </div>
                     </div>
                     <div className="flex-1 min-h-0 relative flex flex-col justify-center">
                        <DonutChart data={pieChartData} />
                     </div>
                     <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
                        <span>Métodos de conciliação</span>
                        <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">{pieChartData.filter(d => d.value > 0).length || 1} ativos</span>
                     </div>
                </div>

                <ChurchLeaderboard 
                    data={summary.valuePerChurch}
                    maxValue={maxValuePerChurch}
                    language={language}
                    title={t('dashboard.identifiedValuesByChurch')}
                />
            </div>
            </>
        )}
    </div>
);
});