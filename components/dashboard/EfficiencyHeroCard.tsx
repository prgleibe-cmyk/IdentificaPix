
import React from 'react';
import { SparklesIcon, ChartPieIcon } from '../Icons';

interface EfficiencyHeroCardProps {
    rate: number;
    title: string;
}

export const EfficiencyHeroCard: React.FC<EfficiencyHeroCardProps> = ({ rate, title }) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (rate / 100) * circumference;

    return (
        <div 
            className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200/90 dark:border-slate-700 p-5 hover:shadow-soft transition-all duration-200 group animate-fade-in-up fill-mode-backwards"
            style={{ animationDelay: '100ms' }}
        >
            <div className="flex justify-between items-start h-full relative z-10">
                <div className="flex flex-col justify-between h-full">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="p-1.5 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-md">
                                <SparklesIcon className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                        </div>
                        <span className="text-4xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                            {rate.toFixed(1)}%
                        </span>
                    </div>
                    <div className="mt-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200/60 dark:border-orange-900/40 uppercase tracking-wider">
                            Taxa de Eficiência
                        </span>
                    </div>
                </div>
                
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
                    <div className="absolute inset-0 flex items-center justify-center text-brand-blue">
                        <ChartPieIcon className="w-8 h-8 stroke-[1.5]" />
                    </div>
                </div>
            </div>
        </div>
    );
};
