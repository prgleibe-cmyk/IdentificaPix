import React from 'react';
import { SearchIcon, XMarkIcon, CircleStackIcon } from '../Icons';

interface SavedReportsHeaderProps {
    title: string;
    searchPlaceholder: string;
    searchQuery: string;
    onSearchChange: (val: string) => void;
    usagePercent: number;
    storageColor: string;
    currentCount: number;
    maxCount: number;
}

export const SavedReportsHeader: React.FC<SavedReportsHeaderProps> = ({
    title,
    searchPlaceholder,
    searchQuery,
    onSearchChange,
    usagePercent,
    storageColor,
    currentCount,
    maxCount
}) => (
    <div className="flex-shrink-0 flex items-center justify-between gap-4 px-1 mt-1 min-h-[40px]">
        <div className="flex items-center gap-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none whitespace-nowrap">
                {title}
            </h2>
            
            <div className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <CircleStackIcon className="w-3 h-3" /> 
                    <span>Espaço:</span>
                </div>
                <div className="h-1.5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${storageColor}`}
                        style={{ width: `${usagePercent}%` }}
                    ></div>
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${usagePercent > 80 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {currentCount}/{maxCount}
                </span>
            </div>
        </div>

        <div className="relative w-48 md:w-64">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-2.5 -translate-y-1/2" />
            <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                className="pl-8 pr-6 py-1.5 block w-full rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-medium shadow-2xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
                <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <XMarkIcon className="h-3 w-3" />
                </button>
            )}
        </div>
    </div>
);