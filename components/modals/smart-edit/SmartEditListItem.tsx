
import React from 'react';
import { UserIcon, BanknotesIcon, SparklesIcon } from '../../Icons';
import { formatCurrency } from '../../../utils/formatters';
import { SuggestionItem } from './useSmartEditController';

interface SmartEditListItemProps {
    item: SuggestionItem;
    isSuggestion: boolean;
    index: number;
    language: any;
    onSelect: (item: SuggestionItem) => void;
    manualChurchId: string;
}

export const SmartEditListItem: React.FC<SmartEditListItemProps> = ({
    item, isSuggestion, index, language, onSelect, manualChurchId
}) => (
    <button onClick={() => onSelect(item)} className={`w-full text-left p-2.5 rounded-lg border transition-colors group flex items-center justify-between mb-1.5 cursor-pointer ${item.isAiSuggestion ? 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50' : isSuggestion ? 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
        <div className="flex items-center gap-2.5 overflow-hidden">
            <div className={`p-1.5 rounded-md flex-shrink-0 ${item.isAiSuggestion ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400' : isSuggestion ? 'bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                {item.isAiSuggestion ? <SparklesIcon className="w-3.5 h-3.5" /> : (item.type === 'contributor' ? <UserIcon className="w-3.5 h-3.5" /> : <BanknotesIcon className="w-3.5 h-3.5" />)}
            </div>
            <div className="min-w-0">
                <p className={`text-xs font-semibold truncate leading-tight ${item.isAiSuggestion ? 'text-orange-800 dark:text-orange-200' : isSuggestion ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>{item.primaryText}</p>
                <p className={`text-[10px] truncate ${item.isAiSuggestion ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>{item.secondaryText}</p>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-1.5">
            {isSuggestion && index === 0 && item.churchId === manualChurchId && (
                <span className="text-[9px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 uppercase">Enter</span>
            )}
            <span className={`text-[11px] font-semibold font-mono tabular-nums ${item.isAiSuggestion ? 'text-orange-700 dark:text-orange-300' : 'text-slate-900 dark:text-white'}`}>{formatCurrency(item.amount, language)}</span>
        </div>
    </button>
);
