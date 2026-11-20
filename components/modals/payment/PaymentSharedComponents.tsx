import React from 'react';

export const ProgressBar = ({ percent, colorClass, glowColor }: { percent: number, colorClass: string, glowColor: string }) => (
    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2 relative">
        <div 
            className={`h-full rounded-full transition-all duration-1000 ease-out ${colorClass} relative z-10`} 
            style={{ width: `${percent}%` }}
        ></div>
        <div 
            className={`absolute top-0 left-0 h-full blur-[4px] opacity-60 transition-all duration-1000 ${glowColor}`}
            style={{ width: `${percent}%` }}
        ></div>
    </div>
);

export const Counter = ({ value, setValue, label, icon: Icon, subLabel, stepVal = 1, disabled }: any) => (
    <div className={`
        flex items-center justify-between p-4 rounded-xl border transition-colors group
        ${disabled ? 'opacity-50 pointer-events-none grayscale' : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-orange-500/50 dark:hover:border-orange-500/50 shadow-xs'}
    `}>
        <div className="flex items-center gap-3.5">
            <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center transition-colors shrink-0
                ${disabled ? 'bg-slate-100 text-slate-400' : 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40'}
            `}>
                <Icon className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div>
                <span className="block text-xs font-bold text-slate-900 dark:text-white tracking-tight">{label}</span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{subLabel}</span>
            </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 rounded-lg p-1 border border-slate-200 dark:border-slate-800">
            <button 
                onClick={() => setValue(Math.max(stepVal === 1 ? 1 : 0, value - 1))}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors hover:text-rose-600 cursor-pointer"
            >
                -
            </button>
            <span className="w-8 text-center font-bold text-slate-900 dark:text-white text-sm tabular-nums">{value}</span>
            <button 
                onClick={() => setValue(value + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-orange-600 hover:bg-orange-700 text-white font-bold transition-colors shadow-2xs cursor-pointer"
            >
                +
            </button>
        </div>
    </div>
);