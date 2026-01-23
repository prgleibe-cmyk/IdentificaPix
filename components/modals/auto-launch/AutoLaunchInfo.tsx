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
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Transação (Banco)</p>
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate leading-tight uppercase" title={item.contributor?.name || item.transaction.description}>
                        {item.contributor?.name || item.transaction.description}
                    </p>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">{formatDate(item.transaction.date)}</p>
                </div>
                <p className="text-sm font-black text-slate-900 dark:text-white font-mono tracking-tight whitespace-nowrap">
                    {formatCurrency(item.transaction.amount, language)}
                </p>
            </div>
        </div>
    );
};