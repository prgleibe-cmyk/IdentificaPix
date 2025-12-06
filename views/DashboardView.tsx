
import React, { useContext, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { EmptyState } from '../components/EmptyState';
import { SummaryCard } from '../components/SummaryCard';
import {
    XCircleIcon,
    UploadIcon,
    CheckCircleIcon,
    ChartPieIcon,
} from '../components/Icons';
import { formatCurrency } from '../utils/formatters';
import { MatchMethod } from '../types';

interface DonutChartProps {
    data: { name: string; value: number; color: string }[];
}

const DonutChart: React.FC<DonutChartProps> = ({ data }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    if (total === 0) return <div className="text-center text-slate-400 py-12">Nenhum dado para o gráfico.</div>;

    const radius = 60; // Slightly larger
    const strokeWidth = 8; // Thinner stroke for elegance
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    return (
        <div className="flex flex-col items-center h-full justify-center py-4">
            <div className="relative w-48 h-48 drop-shadow-md flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                     <circle
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-slate-100 dark:text-slate-700/30"
                    />
                    {data.map((item, index) => {
                        const percentage = item.value / total;
                        const dashArray = percentage * circumference;
                        const offset = accumulatedOffset;
                        accumulatedOffset += dashArray; // No gap calculation in offset to stack correctly
                        
                        return (
                            <circle
                                key={`seg-${index}`}
                                cx="80"
                                cy="80"
                                r={radius}
                                fill="transparent"
                                stroke={item.color}
                                strokeWidth={strokeWidth}
                                strokeDasharray={`${dashArray} ${circumference - dashArray}`} 
                                strokeDashoffset={-offset}
                                strokeLinecap="round"
                                className="transition-all duration-500 hover:stroke-[10] hover:opacity-80 cursor-pointer"
                            />
                        );
                    })}
                </svg>
                 <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter font-mono">{total}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Registros</span>
                </div>
            </div>
            
            <div className="mt-8 w-full px-4">
                <div className="grid grid-cols-2 gap-3">
                    {data.map((item, index) => (
                        <div key={index} className="flex items-center p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700/50">
                            <span className="w-2.5 h-2.5 rounded-full mr-2.5 flex-shrink-0 shadow-sm" style={{ backgroundColor: item.color }}></span>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase truncate">{item.name}</span>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                                    {((item.value / total) * 100).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const DashboardSkeleton = () => (
    <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 h-40 shadow-sm"></div>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
            <div className="bg-white/50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm"></div>
            <div className="lg:col-span-2 bg-white/50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm"></div>
        </div>
    </div>
);

export const DashboardView: React.FC = () => {
    const { summary, matchResults, hasActiveSession, savedReports } = useContext(AppContext);
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();

    const identificationRate = useMemo(() => {
        const total = summary.identifiedCount + summary.unidentifiedCount;
        return total > 0 ? (summary.identifiedCount / total) * 100 : 0;
    }, [summary]);
    
    // Use the persistent summary breakdown for instant rendering
    const pieChartData = useMemo(() => {
        const breakdown = summary.methodBreakdown || { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 };
        return [
            { name: t('dashboard.matchMethod.automatic'), value: breakdown.AUTOMATIC, color: '#6366f1' }, // Indigo 500
            { name: t('dashboard.matchMethod.manual'), value: breakdown.MANUAL, color: '#3b82f6' }, // Blue 500
            { name: t('dashboard.matchMethod.learned'), value: breakdown.LEARNED, color: '#a855f7' }, // Purple 500
            { name: t('dashboard.matchMethod.ai'), value: breakdown.AI, color: '#10b981' }, // Emerald 500
        ].filter(d => d.value > 0);
    }, [summary.methodBreakdown, t]);

    const maxValuePerChurch = useMemo(() => {
        if (!summary.valuePerChurch || summary.valuePerChurch.length === 0) return 0;
        return Math.max(...summary.valuePerChurch.map(([, value]) => value));
    }, [summary.valuePerChurch]);

    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (identificationRate / 100) * circumference;

    // Data check now includes the persisted summary values to allow instant render
    const hasData = matchResults.length > 0 || savedReports.length > 0 || summary.totalValue > 0 || summary.identifiedCount > 0;

    // Use skeleton ONLY if we have an active session BUT no data (initial hydration/fetch failed or in progress with cleared cache)
    if (hasActiveSession && !hasData) {
        return <DashboardSkeleton />;
    }

    if (!hasData) {
        return (
            <div className="mt-8">
                <EmptyState
                    icon={<UploadIcon className="w-12 h-12 text-indigo-500 dark:text-indigo-400" />}
                    title={t('empty.dashboard.title')}
                    message={t('empty.dashboard.message')}
                    action={{
                        text: t('empty.dashboard.action'),
                        onClick: () => setActiveView('upload'),
                    }}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full lg:h-[calc(100vh-6rem)] gap-6 animate-fade-in pb-4">
            
            {/* Header Info if Historical */}
            {summary.isHistorical && (
                <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-indigo-900 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                        </span>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            Modo Histórico: <span className="font-normal text-slate-500 dark:text-slate-400">Exibindo dados agregados.</span>
                        </p>
                    </div>
                    <span className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">{new Date().toLocaleDateString()}</span>
                </div>
            )}

            {/* KPI Cards */}
            <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard
                    title={t('dashboard.identifiedContributions')}
                    count={summary.identifiedCount}
                    value={summary.autoConfirmed.value + summary.manualConfirmed.value}
                    icon={<CheckCircleIcon className="w-5 h-5 text-white" />}
                    language={language}
                    accentColor="from-emerald-500 to-teal-500" 
                />
                
                {/* Center KPI - Efficiency */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-80"></div>
                    <div className="flex justify-between items-start h-full relative z-10">
                        <div className="flex flex-col justify-between h-full">
                            <div>
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{t('dashboard.identificationRatio')}</p>
                                <span className="text-4xl font-black text-slate-800 dark:text-white font-mono tracking-tight">{identificationRate.toFixed(1)}%</span>
                            </div>
                            <div className="mt-4">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                    Taxa de Eficiência
                                </span>
                            </div>
                        </div>
                        
                        {/* Circular Progress */}
                        <div className="relative w-20 h-20 transform group-hover:scale-105 transition-transform duration-300">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                                <circle className="text-slate-100 dark:text-slate-700/50" strokeWidth="6" stroke="currentColor" fill="transparent" r={radius} cx="40" cy="40" />
                                <circle 
                                    className="text-blue-600 dark:text-blue-500 transition-all duration-1000 ease-out"
                                    strokeWidth="6"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={progressOffset}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r={radius}
                                    cx="40"
                                    cy="40"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <ChartPieIcon className="w-7 h-7" />
                            </div>
                        </div>
                    </div>
                </div>

                <SummaryCard
                    title={t('dashboard.pending')}
                    count={summary.unidentifiedCount}
                    value={summary.pending.value}
                    icon={<XCircleIcon className="w-5 h-5 text-white" />}
                    language={language}
                    accentColor="from-amber-500 to-orange-500"
                />
            </div>

            {/* Charts & Lists Section */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Donut Chart - Analysis */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                     <div className="px-6 py-5 border-b border-slate-50 dark:border-slate-700/50 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">{t('dashboard.matchMethodBreakdown')}</h3>
                        <div className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg text-slate-400">
                            <ChartPieIcon className="w-4 h-4" />
                        </div>
                     </div>
                     <div className="flex-1 min-h-0 relative">
                        <DonutChart data={pieChartData} />
                     </div>
                </div>

                {/* Church Leaderboard - Enhanced */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                     <div className="px-6 py-5 border-b border-slate-50 dark:border-slate-700/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide flex items-center gap-2">
                            {t('dashboard.identifiedValuesByChurch')}
                        </h3>
                        <span className="text-[10px] font-bold tracking-wide text-slate-500 bg-white dark:bg-slate-700 px-3 py-1 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600">TOP ENTIDADES</span>
                     </div>
                     
                     {summary.valuePerChurch.length > 0 ? (
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                            {summary.valuePerChurch.map(([name, value], index) => {
                                const widthPercentage = maxValuePerChurch > 0 ? (value / maxValuePerChurch) * 100 : 0;
                                return (
                                    <div key={name} className="relative group">
                                        <div className="flex justify-between items-end mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-bold border shadow-sm ${index < 3 ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white border-transparent' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}>
                                                    {index + 1}
                                                </div>
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px] sm:max-w-xs">{name}</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 dark:text-white font-mono bg-slate-50 dark:bg-slate-700/50 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-600">{formatCurrency(value, language)}</span>
                                        </div>
                                        
                                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full rounded-full transition-all duration-1000 ease-out relative group-hover:brightness-110"
                                                style={{ 
                                                    width: `${widthPercentage}%`,
                                                    background: index === 0 ? 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)' : // Indigo to Purple
                                                                index === 1 ? 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)' : // Blue to Indigo
                                                                'linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)' // Slate
                                                }} 
                                            >
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                     ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-slate-400 italic">
                            <p>{t('dashboard.noValues')}</p>
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};
