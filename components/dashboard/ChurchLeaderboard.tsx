
import React from 'react';
import { TrophyIcon } from '../Icons';
import { formatCurrency } from '../../utils/formatters';
import { Language } from '../../types';

interface ChurchLeaderboardProps {
    data: [string, number][];
    maxValue: number;
    language: Language;
    title: string;
}

export const ChurchLeaderboard: React.FC<ChurchLeaderboardProps> = ({ data, maxValue, language, title }) => {
    return (
        <div 
            className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-200/90 dark:border-slate-700/80 flex flex-col overflow-hidden animate-fade-in-up fill-mode-backwards"
            style={{ animationDelay: '400ms' }}
        >
             <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/60 flex justify-between items-center bg-white dark:bg-slate-800 z-10 shrink-0">
                <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    {title}
                </h3>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200/60 dark:border-slate-700 text-xs font-medium">
                    <TrophyIcon className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                    <span>Top Entidades</span>
                </div>
             </div>
             
             {data.length > 0 ? (
                <>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2 max-h-[360px]">
                    {data.map(([name, value], index) => {
                        const widthPercentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
                        
                        let rankStyle = "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600";
                        if (index === 0) rankStyle = "bg-amber-100 text-amber-800 border-amber-200";
                        if (index === 1) rankStyle = "bg-slate-200 text-slate-700 border-slate-300";
                        if (index === 2) rankStyle = "bg-orange-100 text-orange-800 border-orange-200";

                        return (
                            <div key={name} className="relative group px-3.5 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-all duration-200 border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50">
                                <div className="flex justify-between items-center mb-1.5 relative z-10">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold border shadow-xs shrink-0 ${rankStyle}`}>
                                            {index + 1}
                                        </div>
                                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px] sm:max-w-xs">{name}</span>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700 shadow-xs">
                                        {formatCurrency(value, language)}
                                    </span>
                                </div>
                                
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full rounded-full transition-all duration-1000 ease-out relative group-hover:brightness-105"
                                        style={{ 
                                            width: `${widthPercentage}%`,
                                            background: index < 3 
                                                ? 'linear-gradient(90deg, #EA580C 0%, #F97316 100%)' 
                                                : 'linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)' 
                                        }} 
                                    >
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-auto shrink-0">
                    <span>Total de congregações</span>
                    <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">{data.length} registradas</span>
                </div>
                </>
             ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-slate-400 italic bg-slate-50/30 dark:bg-slate-900/30 m-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-medium">Nenhum valor identificado para exibir.</p>
                </div>
             )}
        </div>
    );
};
