
import React from 'react';
import { CheckCircleIcon, XCircleIcon } from '../Icons';
import { formatCurrency } from '../../utils/formatters';

interface SearchSummaryProps {
    summary: {
        totalCount: number;
        income: number;
        expenses: number;
        identified: number;
        unidentified: number;
    };
    language: string;
    labels: {
        total: string;
        income: string;
        expenses: string;
    };
}

export const SearchSummary: React.FC<SearchSummaryProps> = ({ summary, language, labels }) => (
    <div className="flex-shrink-0 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 animate-fade-in-up">
        <div className="grid grid-cols-4 gap-2">
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">{labels.total}</p>
                <p className="font-black text-sm text-slate-900 dark:text-slate-100">{summary.totalCount}</p>
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center">
                <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">{labels.income}</p>
                <p className="font-black text-sm text-emerald-700 dark:text-emerald-300">{formatCurrency(summary.income, language as any)}</p>
            </div>
            <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/30 flex justify-between items-center">
                <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase">{labels.expenses}</p>
                <p className="font-black text-sm text-red-700 dark:text-red-300">{formatCurrency(summary.expenses, language as any)}</p>
            </div>
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                 <div className="flex items-center gap-1">
                    <CheckCircleIcon className="w-3 h-3 text-emerald-500"/>
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase">{summary.identified}</span>
                </div>
                 <div className="flex items-center gap-1">
                    <XCircleIcon className="w-3 h-3 text-amber-500"/>
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase">{summary.unidentified}</span>
                </div>
            </div>
        </div>
    </div>
);
