
import React from 'react';

interface BankChipsListProps {
    list: { id: string; name: string }[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
}

export const BankChipsList: React.FC<BankChipsListProps> = ({ list, selectedId, onSelect }) => (
    <div className="max-w-full">
        <div className="inline-flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] p-0.5 touch-pan-x bg-slate-100/80 dark:bg-slate-800/80 rounded-lg border border-slate-200/80 dark:border-slate-700">
            <button
                type="button"
                onClick={() => onSelect(null)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all duration-150 text-xs cursor-pointer whitespace-nowrap ${
                    !selectedId || selectedId === 'all'
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold' 
                    : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
            >
                {(!selectedId || selectedId === 'all') && <div className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0"></div>}
                <span>Todos os bancos</span>
            </button>

            {list.map(item => (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all duration-150 text-xs cursor-pointer whitespace-nowrap ${
                        selectedId === item.id 
                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold' 
                        : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                    }`}
                >
                    {selectedId === item.id && <div className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0"></div>}
                    <span className="truncate max-w-[140px]">{item.name}</span>
                </button>
            ))}
        </div>
    </div>
);
