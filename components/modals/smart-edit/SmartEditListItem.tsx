
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
    <button onClick={() => onSelect(item)} className={`w-full text-left p-2 rounded-lg border transition-all duration-200 group flex items-center justify-between mb-1.5 ${item.isAiSuggestion ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 border-purple-200 dark:border-purple-700 shadow-sm ring-1 ring-purple-100' : isSuggestion ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-slate-50'}`}>
        <div className="flex items-center gap-2 overflow-hidden">
            <div className={`p-1.5 rounded-full flex-shrink-0 ${item.isAiSuggestion ? 'bg-purple-100 text-purple-600' : isSuggestion ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                {item.isAiSuggestion ? <SparklesIcon className="w-3 h-3 animate-pulse" /> : (item.type === 'contributor' ? <UserIcon className="w-3 h-3" /> : <BanknotesIcon className="w-3 h-3" />)}
            </div>
            <div className="min-w-0">
                <p className={`text-[11px] font-bold truncate leading-tight ${item.isAiSuggestion ? 'text-purple-800 dark:text-purple-200' : isSuggestion ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}>{item.primaryText}</p>
                <p className={`text-[9px] truncate ${item.isAiSuggestion ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}>{item.secondaryText}</p>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-1">
            {isSuggestion && index === 0 && item.churchId === manualChurchId && (
                <span className="text-[7px] font-black bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 uppercase">Enter</span>
            )}
            <span className={`text-[10px] font-bold font-mono ${item.isAiSuggestion ? 'text-purple-700 dark:text-purple-300' : isSuggestion ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-white'}`}>{formatCurrency(item.amount, language)}</span>
        </div>
    </button>
);
