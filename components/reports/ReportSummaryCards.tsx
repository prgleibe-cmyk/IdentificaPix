
import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import { Language } from '../../types';

interface ReportSummaryCardsProps {
    summary: any;
    language: Language;
    activeCategory: string;
}

export const ReportSummaryCards: React.FC<ReportSummaryCardsProps> = ({ summary, language, activeCategory }) => {
    return (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/50 rounded-lg">
                <div className="flex flex-col leading-none">
                    <span className="text-[9px] font-semibold uppercase tracking-wide opacity-75">Auto</span>
                    <span className="text-[11px] font-bold tabular-nums">{summary.auto}</span>
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-emerald-800 dark:text-emerald-200 border-l border-emerald-200 dark:border-emerald-800/60 pl-2">
                    {formatCurrency(summary.autoValue, language)}
                </span>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 rounded-lg">
                <div className="flex flex-col leading-none">
                    <span className="text-[9px] font-semibold uppercase tracking-wide opacity-75">Manual</span>
                    <span className="text-[11px] font-bold tabular-nums">{summary.manual}</span>
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-slate-800 dark:text-slate-100 border-l border-slate-200 dark:border-slate-700 pl-2">
                    {formatCurrency(summary.manualValue, language)}
                </span>
            </div>

            {summary.pending > 0 && (
                <div className="flex items-center gap-2 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/50 rounded-lg">
                    <div className="flex flex-col leading-none">
                        <span className="text-[9px] font-semibold uppercase tracking-wide opacity-75">Pend</span>
                        <span className="text-[11px] font-bold tabular-nums">{summary.pending}</span>
                    </div>
                    <span className="text-[11px] font-semibold tabular-nums text-amber-800 dark:text-amber-200 border-l border-amber-200 dark:border-amber-800/60 pl-2">
                        {formatCurrency(summary.pendingValue, language)}
                    </span>
                </div>
            )}
        </div>
    );
};
