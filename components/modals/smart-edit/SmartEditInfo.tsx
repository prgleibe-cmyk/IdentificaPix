
import React from 'react';
import { formatDate, formatCurrency } from '../../../utils/formatters';
import { Language } from '../../../types';

interface SmartEditInfoProps {
    target: any;
    isReverseMode: boolean;
    language: Language;
}

export const SmartEditInfo: React.FC<SmartEditInfoProps> = ({ target, isReverseMode, language }) => (
    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700 shrink-0">
        <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">{isReverseMode ? 'Item Pendente' : 'Transação (Banco)'}</p>
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate leading-tight" title={isReverseMode ? target.contributor?.name : target.transaction.description}>
                    {isReverseMode ? target.contributor?.name : target.transaction.description}
                </p>
                <p className="text-[9px] text-slate-500 font-mono mt-0.5">{formatDate(isReverseMode ? target.contributor?.date : target.transaction.date)}</p>
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white font-mono tracking-tight whitespace-nowrap">
                {formatCurrency(isReverseMode ? (target.contributor?.amount || 0) : target.transaction.amount, language)}
            </p>
        </div>
    </div>
);
