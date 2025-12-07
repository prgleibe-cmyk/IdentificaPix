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
    if (total === 0) return <div className="text-center text-slate-500 py-8">Nenhum dado para o gráfico.</div>;

    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    return (
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="relative w-40 h-40">
                <svg className="w-full h-full" viewBox="0 0 120 120" role="img" aria-label="Gráfico de rosca de métodos de conciliação">
                    <g transform="rotate(-90 60 60)">
                        {data.map((item, index) => {
                            const percentage = item.value / total;
                            const strokeDashoffset = accumulatedOffset;
                            const strokeDasharray = `${percentage * circumference} ${circumference}`;
                            accumulatedOffset += percentage * circumference;

                            return (
                                <circle
                                    key={index}
                                    cx="60"
                                    cy="60"
                                    r={radius}
                                    fill="transparent"
                                    stroke={item.color}
                                    strokeWidth="20"
                                    strokeDasharray={strokeDasharray}
                                    strokeDashoffset={-strokeDashoffset}
                                    className="transition-all duration-300"
                                >
                                    <title>{`${item.name}: ${item.value} (${(percentage * 100).toFixed(1)}%)`}</title>
                                </circle>
                            );
                        })}
                    </g>
                </svg>
                 <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{total}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Total</span>
                </div>
            </div>
            <ul className="text-sm space-y-2">
                {data.map((item, index) => (
                    <li key={index} className="flex items-center">
                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                        <span className="text-slate-600 dark:text-slate-300">{item.name}:</span>
                        <span className="font-semibold ml-auto pl-4 text-slate-800 dark:text-slate-200">{item.value} ({(item.value / total * 100).toFixed(1)}%)</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const DashboardSkeleton = () => (
    <div className="animate-pulse space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 h-32">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                    </div>
                    <div className="flex justify-between items-end mt-4">
                         <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-12"></div>
                         <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                    </div>
                </div>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 h-64">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-6"></div>
                <div className="flex items-center justify-center h-40">
                     <div className="w-32 h-32 rounded-full border-8 border-slate-200 dark:border-slate-700"></div>
                </div>
            </div>
            <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 h-64">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-6"></div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i}>
                            <div className="flex justify-between mb-1">
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                            </div>
                            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

export const DashboardView: React.FC = () => {
    const { summary, matchResults, hasActiveSession } = useContext(AppContext);
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();

    const identificationRate = useMemo(() => {
        const total = summary.identifiedCount + summary.unidentifiedCount;
        return total > 0 ? (summary.identifiedCount / total) * 100 : 0;
    }, [summary]);
    
    const pieChartData = useMemo(() => {
        const methodCounts: Record<MatchMethod, number> = { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 };
        
        matchResults.filter(r => !r.isDeleted).forEach(result => {
            if (result.status === 'IDENTIFICADO') {
                const method = result.matchMethod || 'AUTOMATIC';
                if(method in methodCounts) {
                    methodCounts[method]++;
                }
            }
        });

        return [
            { name: t('dashboard.matchMethod.automatic'), value: methodCounts.AUTOMATIC, color: '#3b82f6' }, // blue-500
            { name: t('dashboard.matchMethod.manual'), value: methodCounts.MANUAL, color: '#14b8a6' }, // teal-500
            { name: t('dashboard.matchMethod.learned'), value: methodCounts.LEARNED, color: '#a855f7' }, // purple-500
            { name: t('dashboard.matchMethod.ai'), value: methodCounts.AI, color: '#0ea5e9' }, // sky-500
        ].filter(d => d.value > 0);

    }, [matchResults, t]);

    const maxValuePerChurch = useMemo(() => {
        if (!summary.valuePerChurch || summary.valuePerChurch.length === 0) return 0;
        return Math.max(...summary.valuePerChurch.map(([, value]) => value));
    }, [summary.valuePerChurch]);

    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (identificationRate / 100) * circumference;

    if (matchResults.length === 0) {
        // New Logic: If we have a flagged active session, but no results yet, it means
        // the heavy results are hydrating asynchronously. Show skeleton.
        if (hasActiveSession) {
            return <DashboardSkeleton />;
        }

        return (
            <EmptyState
                icon={<UploadIcon className="w-8 h-8 text-blue-700 dark:text-blue-400" />}
                title={t('empty.dashboard.title')}
                message={t('empty.dashboard.message')}
                action={{
                    text: t('empty.dashboard.action'),
                    onClick: () => setActiveView('upload'),
                }}
            />
        );
    }

    return (
        <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard
                    title={t('dashboard.identifiedContributions')}
                    count={summary.identifiedCount}
                    value={summary.autoConfirmed.value + summary.manualConfirmed.value}
                    icon={<CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-500" />}
                    language={language}
                    accentColor="border-green-500"
                />
                 <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 border-l-4 border-blue-500">
                    <div className="p-6">
                        <div className="flex items-center space-x-3 mb-4">
                            <ChartPieIcon className="w-8 h-8 text-blue-700 dark:text-blue-500" />
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('dashboard.identificationRatio')}</p>
                        </div>
                        <div className="flex items-center justify-center -mt-2">
                            <div className="relative w-36 h-36">
                                <svg className="w-full h-full" viewBox="0 0 120 120">
                                    <circle className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="12" fill="transparent" r={radius} cx="60" cy="60" />
                                    <circle 
                                        className="stroke-blue-500 transition-all duration-500 ease-out"
                                        strokeWidth="12"
                                        strokeLinecap="round"
                                        fill="transparent"
                                        r={radius}
                                        cx="60"
                                        cy="60"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={progressOffset}
                                        transform="rotate(-90 60 60)"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{identificationRate.toFixed(1)}</span>
                                    <span className="text-lg font-medium text-slate-500 dark:text-slate-400">%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <SummaryCard
                    title={t('dashboard.pending')}
                    count={summary.unidentifiedCount}
                    value={summary.pending.value}
                    icon={<XCircleIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />}
                    language={language}
                    accentColor="border-yellow-500"
                />
            </div>

            {/* Charts */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                     <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{t('dashboard.matchMethodBreakdown')}</h3>
                     <DonutChart data={pieChartData} />
                </div>
                <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                     <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{t('dashboard.identifiedValuesByChurch')}</h3>
                     {summary.valuePerChurch.length > 0 ? (
                        <div className="space-y-4">
                            {summary.valuePerChurch.map(([name, value], index) => {
                                const widthPercentage = maxValuePerChurch > 0 ? (value / maxValuePerChurch) * 100 : 0;
                                return (
                                    <div key={name} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                                        <div className="flex justify-between items-center mb-1 text-sm">
                                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{name}</span>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(value, language)}</span>
                                        </div>
                                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full">
                                            <div 
                                                className="h-2 bg-blue-500 rounded-full transition-all duration-500 ease-out" 
                                                style={{ width: `${widthPercentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                     ) : (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">{t('dashboard.noValues')}</div>
                     )}
                </div>
            </div>
        </>
    );
};