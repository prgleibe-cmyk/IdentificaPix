
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
            className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[2rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden animate-fade-in-up fill-mode-backwards"
            style={{ animationDelay: '400ms' }}
        >
             <div className="px-5 py-3 border-b border-slate-50 dark:border-slate-700/50 flex justify-between items-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm z-10 shrink-0">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    {title}
                </h3>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-full shadow-md shadow-violet-500/20">
                    <TrophyIcon className="w-3 h-3" />
                    <span className="text-[9px] font-bold uppercase tracking-wide">Top Entidades</span>
                </div>
             </div>
             
             {data.length > 0 ? (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                    {data.map(([name, value], index) => {
                        const widthPercentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
                        
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
                                                ? 'linear-gradient(90deg, #6366F1 0%, #A855F7 100%)' 
                                                : 'linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)' 
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
                    <p className="text-xs font-medium">Nenhum valor identificado para exibir.</p>
                </div>
             )}
        </div>
    );
};
