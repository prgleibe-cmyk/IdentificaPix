import React from 'react';
import { SparklesIcon, ChartPieIcon } from '../Icons';

interface EfficiencyHeroCardProps {
    rate: number;
    title: string;
}

export const EfficiencyHeroCard: React.FC<EfficiencyHeroCardProps> = ({ rate, title }) => {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (rate / 100) * circumference;

    return (
        <div 
            className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-xs hover:shadow-soft transition-all duration-200 border border-slate-200/90 dark:border-slate-700/80 flex flex-col justify-between animate-fade-in-up fill-mode-backwards"
            style={{ animationDelay: '100ms' }}
        >
            <div className="flex justify-between items-start mb-1.5">
                <div className="p-1.5 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/40 rounded-lg">
                    <SparklesIcon className="w-3.5 h-3.5 stroke-[2]" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-right">
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{title}</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">{rate.toFixed(1)}%</p>
                    </div>
                    <div className="relative w-9 h-9 shrink-0">
                        <svg className="w-full h-full transform -rotate-90 drop-shadow-xs" viewBox="0 0 50 50">
                            <circle 
                                className="text-slate-100 dark:text-slate-700/50" 
                                strokeWidth="4" 
                                stroke="currentColor" 
                                fill="transparent" 
                                r={radius} 
                                cx="25" 
                                cy="25" 
                            />
                            <circle 
                                className="text-orange-600 dark:text-orange-500 transition-all duration-1000 ease-out"
                                strokeWidth="4"
                                strokeDasharray={circumference}
                                strokeDashoffset={progressOffset}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent" 
                                r={radius} 
                                cx="25" 
                                cy="25" 
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-orange-600 dark:text-orange-400">
                            <ChartPieIcon className="w-3.5 h-3.5 stroke-[1.8]" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-normal">Taxa de Eficiência</span>
                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                    {rate >= 80 ? 'Excelente' : rate > 0 ? 'Em andamento' : 'Aguardando dados'}
                </span>
            </div>
        </div>
    );
};
