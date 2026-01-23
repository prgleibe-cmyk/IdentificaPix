
import React from 'react';
import { ExclamationTriangleIcon, BanknotesIcon, BuildingOfficeIcon, MagnifyingGlassIcon } from '../Icons';
import { formatCurrency } from '../../utils/formatters';
import { Language } from '../../types';

interface StatsStripProps {
    category: string;
    reportName: string;
    summary: any;
    searchTerm: string;
    onSearchChange: (val: string) => void;
    language: Language;
}

export const StatsStrip: React.FC<StatsStripProps> = ({ category, reportName, summary, searchTerm, onSearchChange, language }) => (
    <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0 backdrop-blur-sm">
        <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${category === 'unidentified' ? 'bg-amber-100 text-amber-600' : category === 'expenses' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {category === 'unidentified' ? <ExclamationTriangleIcon className="w-4 h-4"/> : category === 'expenses' ? <BanknotesIcon className="w-4 h-4"/> : <BuildingOfficeIcon className="w-4 h-4"/>}
            </div>
            <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wide">{reportName}</h3>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mt-0.5">
                    <span>Total: {summary.count}</span>
                    <span className="w-px h-2 bg-slate-300"></span>
                    <span className={`${category === 'expenses' ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(summary.total, language)}</span>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <div className="flex gap-2">
                <StatPill label="Auto" count={summary.auto} value={summary.autoValue} theme="emerald" language={language} />
                <StatPill label="Manual" count={summary.manual} value={summary.manualValue} theme="blue" language={language} />
                {summary.pending > 0 && <StatPill label="Pend" count={summary.pending} value={summary.pendingValue} theme="amber" language={language} />}
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>
            <div className="relative group">
                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="pl-7 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-medium focus:ring-1 focus:ring-brand-blue outline-none w-24 focus:w-40 transition-all" />
            </div>
        </div>
    </div>
);

const StatPill = ({ label, count, value, theme, language }: any) => (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border ${theme === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : theme === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
        <div className="flex flex-col leading-none">
            <span className="text-[8px] font-black uppercase tracking-wide opacity-70">{label}</span>
            <span className="text-[10px] font-bold">{count}</span>
        </div>
        <span className="text-[10px] font-bold font-mono border-l border-current/20 pl-2">{formatCurrency(value, language)}</span>
    </div>
);
