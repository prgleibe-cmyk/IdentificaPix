
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
            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg">
                <div className="flex flex-col leading-none">
                    <span className="text-[8px] font-black uppercase tracking-wide opacity-70">Auto</span>
                    <span className="text-[10px] font-bold">{summary.auto}</span>
                </div>
                <span className="text-[10px] font-bold font-mono text-emerald-800 border-l border-emerald-200 pl-2">
                    {formatCurrency(summary.autoValue, language)}
                </span>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg">
                <div className="flex flex-col leading-none">
                    <span className="text-[8px] font-black uppercase tracking-wide opacity-70">Manual</span>
                    <span className="text-[10px] font-bold">{summary.manual}</span>
                </div>
                <span className="text-[10px] font-bold font-mono text-blue-800 border-l border-blue-200 pl-2">
                    {formatCurrency(summary.manualValue, language)}
                </span>
            </div>

            {summary.pending > 0 && (
                <div className="flex items-center gap-2 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg">
                    <div className="flex flex-col leading-none">
                        <span className="text-[8px] font-black uppercase tracking-wide opacity-70">Pend</span>
                        <span className="text-[10px] font-bold">{summary.pending}</span>
                    </div>
                    <span className="text-[10px] font-bold font-mono text-amber-800 border-l border-amber-200 pl-2">
                        {formatCurrency(summary.pendingValue, language)}
                    </span>
                </div>
            )}
        </div>
    );
};
