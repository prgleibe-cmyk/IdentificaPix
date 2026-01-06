import React, { useContext, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { SummaryCard } from '../components/SummaryCard';
import {
    XCircleIcon,
    UploadIcon,
    CheckCircleIcon,
    ChartPieIcon,
    TrophyIcon,
    SparklesIcon
} from '../components/Icons';
import { formatCurrency } from '../utils/formatters';

interface DonutChartProps {
    data: { name: string; value: number; color: string }[];
}

const DonutChart: React.FC<DonutChartProps> = ({ data }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    if (total === 0) return <div className="text-center text-slate-400 py-12 font-medium text-xs">Aguardando dados...</div>;

    const radius = 60; 
    const strokeWidth = 10;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    return (
        <div className="flex flex-col items-center h-full justify-between py-2">
            {/* Chart Circle - Reduced Size for better fit */}
            <div className="relative w-32 h-32 flex-shrink-0 group mt-2">
                {/* Glow Effect behind chart */}
                <div className="absolute inset-0 bg-brand-blue/5 rounded-full blur-2xl transform scale-90"></div>
                
                <svg className="w-full h-full transform -rotate-90 relative z-10" viewBox="0 0 160 160">
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
                        accumulatedOffset += dashArray; 
                        
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
                                className="transition-all duration-500 hover:stroke-[12] hover:opacity-90 cursor-pointer drop-shadow-sm origin-center hover:scale-[1.02]"
                            />
                        );
                    })}
                </svg>
                 <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none z-20">
                    <span className="text-2xl font-black text-brand-graphite dark:text-white tracking-tighter tabular-nums transition-transform duration-500 group-hover:scale-110">{total}</span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Registros</span>
                </div>
            </div>
            
            {/* Legend Pills - Optimized Spacing */}
            <div className="w-full px-4 mb-2 overflow-y-auto custom-scrollbar max-h-[140px]">
                <div className="grid grid-cols-1 gap-1.5">
                    {data.map((item, index) => (
                        <div key={index} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 transition-all group/item">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase truncate tracking-wide group-hover/item:text-slate-800 dark:group-hover/item:text-slate-200 transition-colors">
                                    {item.name}
                                </span>
                            </div>
                            <span className="text-[10px] font-black text-slate-700 dark:text-white tabular-nums bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                                {((item.value / total) * 100).toFixed(1)}%
                            </span>
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
                <div key={i} className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 h-48 border border-slate-100 dark:border-slate-700"></div>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700"></div>
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700"></div>
        </div>
    </div>
);

export const DashboardView: React.FC = () => {
    const { summary, matchResults, hasActiveSession, savedReports } = useContext(AppContext);
    const { user } = useAuth();
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();

    const identificationRate = useMemo(() => {
        const total = summary.identifiedCount + summary.unidentifiedCount;
        return total > 0 ? (summary.identifiedCount / total) * 100 : 0;
    }, [summary]);
    
    const pieChartData = useMemo(() => {
        const breakdown = summary.methodBreakdown || { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 };
        return [
            { name: t('dashboard.matchMethod.automatic'), value: breakdown.AUTOMATIC, color: '#3B82F6' }, // Blue 500
            { name: t('dashboard.matchMethod.manual'), value: breakdown.MANUAL, color: '#6366F1' },    // Indigo 500
            { name: t('dashboard.matchMethod.learned'), value: breakdown.LEARNED, color: '#8B5CF6' },   // Violet 500
            { name: t('dashboard.matchMethod.ai'), value: breakdown.AI, color: '#14B8A6' },           // Teal 500
        ].filter(d => d.value > 0);
    }, [summary.methodBreakdown, t]);

    const maxValuePerChurch = useMemo(() => {
        if (!summary.valuePerChurch || summary.valuePerChurch.length === 0) return 0;
        return Math.max(...summary.valuePerChurch.map(([, value]) => value));
    }, [summary.valuePerChurch]);

    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (identificationRate / 100) * circumference;

    const hasData = matchResults.length > 0 || savedReports.length > 0 || summary.totalValue > 0 || summary.identifiedCount > 0;

    const getGreeting = () => {
        const hours = new Date().getHours();
        if (hours < 12) return 'Bom dia';
        if (hours < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    if (hasActiveSession && !hasData) {
        return <DashboardSkeleton />;
    }

    if (!hasData) {
        return (
            <div className="flex-1 flex flex-col h-full animate-fade-in-up pb-6">
                <div className="flex-shrink-0 mb-8 px-1">
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight leading-none">
                        {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-violet-500">{user?.user_metadata?.full_name?.split(' ')[0] || 'Visitante'}</span>.
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium">Seu painel de controle financeiro inteligente.</p>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <EmptyState
                        icon={<UploadIcon />}
                        title={t('empty.dashboard.title')}
                        message={t('empty.dashboard.message')}
                        action={{
                            text: t('empty.dashboard.action'),
                            onClick: () => setActiveView('upload'),
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-4 animate-fade-in pb-4 overflow-y-auto custom-scrollbar">
            
            {/* Header Section Compacto */}
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-1 mt-1 min-h-[40px]">
                <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                        Dashboard
                    </h2>
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

            {/* KPI Cards Section */}
            <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-3 xl:gap-4">
                {/* 1. Identified (Left) */}
                <SummaryCard
                    title={t('dashboard.identifiedContributions')}
                    count={summary.identifiedCount}
                    value={summary.autoConfirmed.value + summary.manualConfirmed.value}
                    icon={<CheckCircleIcon />}
                    language={language}
                    accentColor="emerald"
                    delay={0}
                />
                
                {/* 2. Efficiency (Center - Hero Card) */}
                <div 
                    className="relative overflow-hidden bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-800 dark:to-slate-900 rounded-[2rem] shadow-card border border-blue-100/50 dark:border-slate-700 p-6 xl:p-8 hover:shadow-premium hover:-translate-y-1 transition-all duration-500 group animate-fade-in-up fill-mode-backwards"
                    style={{ animationDelay: '100ms' }}
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-[50px] pointer-events-none"></div>
                    
                    <div className="flex justify-between items-start h-full relative z-10">
                        <div className="flex flex-col justify-between h-full">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-brand-blue rounded-lg">
                                        <SparklesIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('dashboard.identificationRatio')}</p>
                                </div>
                                <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-graphite to-slate-600 dark:from-white dark:to-slate-300 tabular-nums tracking-tighter">
                                    {identificationRate.toFixed(1)}%
                                </span>
                            </div>
                            <div className="mt-4">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-white dark:bg-slate-700 text-brand-blue border border-blue-100 dark:border-slate-600 shadow-sm uppercase tracking-wide">
                                    Taxa de Eficiência
                                </span>
                            </div>
                        </div>
                        
                        {/* Circular Progress */}
                        <div className="relative w-24 h-24 transform group-hover:scale-105 group-hover:rotate-6 transition-all duration-700 ease-out">
                            <svg className="w-full h-full transform -rotate-90 drop-shadow-sm" viewBox="0 0 80 80">
                                <circle className="text-slate-100 dark:text-slate-700/50" strokeWidth="6" stroke="currentColor" fill="transparent" r={radius} cx="40" cy="40" />
                                <circle 
                                    className="text-brand-blue transition-all duration-1000 ease-out"
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
                            <div className="absolute inset-0 flex items-center justify-center text-brand-blue dark:text-blue-400">
                                <ChartPieIcon className="w-8 h-8 stroke-[1.5]" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Pending (Right) */}
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

            {/* Charts & Lists Section */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 xl:gap-4">
                
                {/* Donut Chart - Analysis */}
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

                {/* Church Leaderboard - Enhanced Premium Look */}
                <div 
                    className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[2rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden animate-fade-in-up fill-mode-backwards"
                    style={{ animationDelay: '400ms' }}
                >
                     <div className="px-5 py-3 border-b border-slate-50 dark:border-slate-700/50 flex justify-between items-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm z-10 shrink-0">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            {t('dashboard.identifiedValuesByChurch')}
                        </h3>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-full shadow-md shadow-violet-500/20">
                            <TrophyIcon className="w-3 h-3" />
                            <span className="text-[9px] font-bold uppercase tracking-wide">Top Entidades</span>
                        </div>
                     </div>
                     
                     {summary.valuePerChurch.length > 0 ? (
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                            {summary.valuePerChurch.map(([name, value], index) => {
                                const widthPercentage = maxValuePerChurch > 0 ? (value / maxValuePerChurch) * 100 : 0;
                                
                                // Medal Styles
                                let rankStyle = "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600";
                                if (index === 0) rankStyle = "bg-gradient-to-br from-yellow-300 to-amber-400 text-amber-900 border-amber-300 shadow-amber-200/50";
                                if (index === 1) rankStyle = "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 border-slate-300 shadow-slate-200/50";
                                if (index === 2) rankStyle = "bg-gradient-to-br from-orange-200 to-orange-300 text-orange-800 border-orange-300 shadow-orange-200/50";

                                return (
                                    <div key={name} className="relative group px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-all duration-300 border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50 hover:shadow-sm">
                                        <div className="flex justify-between items-center mb-1.5 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className={`flex items-center justify-center w-5 h-5 rounded-md text-[9px] font-bold border shadow-sm shrink-0 ${rankStyle}`}>
                                                    {index + 1}
                                                </div>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[180px] sm:max-w-xs">{name}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-brand-graphite dark:text-white font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-700">
                                                {formatCurrency(value, language)}
                                            </span>
                                        </div>
                                        
                                        <div className="h-1 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full rounded-full transition-all duration-1000 ease-out relative group-hover:brightness-110"
                                                style={{ 
                                                    width: `${widthPercentage}%`,
                                                    background: index < 3 
                                                        ? 'linear-gradient(90deg, #6366F1 0%, #A855F7 100%)' // Violet Gradient for top 3
                                                        : 'linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)' // Slate for others
                                                }} 
                                            >
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                     ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-slate-400 italic bg-slate-50/30 dark:bg-slate-900/30 m-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-medium">{t('dashboard.noValues')}</p>
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};