import React, { useState } from 'react';
import { useDashboardController } from '../hooks/useDashboardController';
import { EmptyState } from '../components/EmptyState';
import { SummaryCard } from '../components/SummaryCard';
import { BankChipsList } from '../components/reports/BankChipsList';
const logoImg = '/logo.png?v=15';
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

export const DashboardView: React.FC = () => {
    const { 
        summary, user, setActiveView, t, language, identificationRate, 
        pieChartData, maxValuePerChurch, hasData, getGreeting, hasActiveSession,
        selectedBankId, setSelectedBankId, bankList, isLoading
    } = useDashboardController();

    if (hasActiveSession && !hasData && isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="flex flex-col h-full gap-4 animate-fade-in pb-4 overflow-y-auto custom-scrollbar">
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-1 mt-1 min-h-[40px]">
                <div className="flex items-center gap-3">
                    <img 
                        src={logoImg} 
                        className="h-8 w-auto object-contain" 
                        alt="Logo" 
                    />
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Dashboard</h2>
                </div>
                {summary.isHistorical && (
                    <span className="flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm animate-fade-in-down">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        Modo Histórico
                    </span>
                )}
            </div>

            {bankList.length > 0 && (
                <div className="flex flex-col gap-1 px-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Filtrar por Banco</label>
                    <BankChipsList list={bankList} selectedId={selectedBankId} onSelect={setSelectedBankId} />
                </div>
            )}

            {!hasData ? (
                <div className="flex-1 flex flex-col h-full animate-fade-in-up gap-4 pb-4">
                    {/* Welcome Banner Card */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex-shrink-0">
                        <div>
                            <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">
                                {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">{user?.user_metadata?.full_name?.split(' ')[0] || 'Visitante'}</span>!
                            </h1>
                            <p className="text-xs text-slate-400 mt-1.5 font-medium">
                                Seu painel de controle financeiro inteligente da igreja.
                            </p>
                        </div>
                    </div>

                    {/* Integrated Empty State Card */}
                    <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-6 md:p-12 rounded-2xl shadow-sm">
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
                    <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-3 xl:gap-4">
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

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 xl:gap-4">
                <div 
                    className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden animate-fade-in-up fill-mode-backwards"
                    style={{ animationDelay: '300ms' }}
                >
                     <div className="px-5 py-3 border-b border-slate-50 dark:border-slate-700/50 flex justify-between items-center shrink-0">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('dashboard.matchMethodBreakdown')}</h3>
                        <div className="p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-slate-400 border border-slate-100 dark:border-slate-700">
                            <ChartPieIcon className="w-3.5 h-3.5" />
                        </div>
                     </div>
                     <div className="flex-1 min-h-0 relative">
                        <DonutChart data={pieChartData} />
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
};