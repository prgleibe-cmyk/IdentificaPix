
import React from 'react';
import { formatDate, formatCurrency } from '../../../utils/formatters';
import { Language } from '../../../types';

interface SmartEditInfoProps {
    target: any;
    isReverseMode: boolean;
    language: Language;
}

export const SmartEditInfo: React.FC<SmartEditInfoProps> = ({ target, isReverseMode, language }) => (
    <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{isReverseMode ? 'Item Pendente' : 'Transação (Banco)'}</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight" title={isReverseMode ? target.contributor?.name : target.transaction.description}>
                    {isReverseMode ? target.contributor?.name : target.transaction.description}
                </p>
                <p className="text-[10px] text-slate-500 font-mono tabular-nums mt-0.5">{formatDate(isReverseMode ? target.contributor?.date : target.transaction.date)}</p>
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums tracking-tight whitespace-nowrap">
                {formatCurrency(isReverseMode ? (target.contributor?.amount || 0) : target.transaction.amount, language)}
            </p>
        </div>
    </div>
);
