import React from 'react';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { Language } from '../../../types';

interface AutoLaunchInfoProps {
    item: any;
    language: Language;
}

export const AutoLaunchInfo: React.FC<AutoLaunchInfoProps> = ({ item, language }) => {
    if (!item) return null;
    
    return (
        <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
            <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Transação (Banco)</p>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight" title={item.contributor?.name || item.transaction.description}>
                        {item.contributor?.name || item.transaction.description}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono tabular-nums mt-0.5">{formatDate(item.transaction.date)}</p>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums tracking-tight whitespace-nowrap">
                    {formatCurrency(item.transaction.amount, language)}
                </p>
            </div>
        </div>
    );
};