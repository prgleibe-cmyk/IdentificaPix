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
        flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 group
        ${disabled ? 'opacity-50 pointer-events-none grayscale' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-blue/50 dark:hover:border-brand-blue/50 hover:shadow-lg hover:shadow-brand-blue/5'}
    `}>
        <div className="flex items-center gap-4">
            <div className={`
                p-3 rounded-xl transition-colors
                ${disabled ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 group-hover:text-brand-blue dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20'}
            `}>
                <Icon className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide">{label}</span>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{subLabel}</span>
            </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/80 rounded-xl p-1 border border-slate-200 dark:border-slate-700/50">
            <button 
                onClick={() => setValue(Math.max(stepVal === 1 ? 1 : 0, value - 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all shadow-sm active:scale-95 hover:text-red-500"
            >
                -
            </button>
            <span className="w-8 text-center font-bold text-slate-900 dark:text-white text-sm tabular-nums">{value}</span>
            <button 
                onClick={() => setValue(value + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold transition-all shadow-md active:scale-95 hover:text-brand-blue"
            >
                +
            </button>
        </div>
    </div>
);