
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
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{title}</p>
                        </div>
                        <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-graphite to-slate-600 dark:from-white dark:to-slate-300 tabular-nums tracking-tighter">
                            {rate.toFixed(1)}%
                        </span>
                    </div>
                    <div className="mt-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-white dark:bg-slate-700 text-brand-blue border border-blue-100 dark:border-slate-600 shadow-sm uppercase tracking-wide">
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
                    <div className="absolute inset-0 flex items-center justify-center text-brand-blue dark:text-blue-400">
                        <ChartPieIcon className="w-8 h-8 stroke-[1.5]" />
                    </div>
                </div>
            </div>
        </div>
    );
};
