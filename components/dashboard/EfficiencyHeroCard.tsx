
import React from 'react';
import { SparklesIcon, ChartPieIcon } from '../Icons';

interface EfficiencyHeroCardProps {
    rate: number;
    title: string;
}

export const EfficiencyHeroCard: React.FC<EfficiencyHeroCardProps> = ({ rate, title }) => {
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (rate / 100) * circumference;

    return (
        <div 
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-200/90 dark:border-slate-700/80 p-5 hover:shadow-soft transition-all duration-200 flex flex-col justify-between animate-fade-in-up fill-mode-backwards"
            style={{ animationDelay: '100ms' }}
        >
            <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/40 rounded-xl shrink-0">
                            <SparklesIcon className="w-4 h-4 stroke-[2]" />
                        </div>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{title}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-1">
                    <div>
                        <span className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                            {rate.toFixed(1)}%
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Conciliação automática & regras</p>
                    </div>
                    
                    <div className="relative w-14 h-14 shrink-0">
                        <svg className="w-full h-full transform -rotate-90 drop-shadow-xs" viewBox="0 0 68 68">
                            <circle 
                                className="text-slate-100 dark:text-slate-700/50" 
                                strokeWidth="5" 
                                stroke="currentColor" 
                                fill="transparent" 
                                r={radius} 
                                cx="34" 
                                cy="34" 
                            />
                            <circle 
                                className="text-orange-600 dark:text-orange-500 transition-all duration-1000 ease-out"
                                strokeWidth="5"
                                strokeDasharray={circumference}
                                strokeDashoffset={progressOffset}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r={radius}
                                cx="34"
                                cy="34"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-orange-600 dark:text-orange-400">
                            <ChartPieIcon className="w-5 h-5 stroke-[1.8]" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400 font-normal">Taxa de Eficiência</span>
                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                    {rate >= 80 ? 'Excelente' : rate > 0 ? 'Em andamento' : 'Aguardando dados'}
                </span>
            </div>
        </div>
    );
};
