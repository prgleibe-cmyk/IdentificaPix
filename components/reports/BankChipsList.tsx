
import React from 'react';

interface BankChipsListProps {
    list: { id: string; name: string }[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
}

export const BankChipsList: React.FC<BankChipsListProps> = ({ list, selectedId, onSelect }) => (
    <div className="w-full">
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 px-1 touch-pan-x">
            <button
                type="button"
                onClick={() => onSelect(null)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-200 text-[11px] cursor-pointer ${
                    !selectedId || selectedId === 'all'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 border-emerald-600 text-white shadow-xs font-black' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400 font-bold'
                }`}
            >
                {(!selectedId || selectedId === 'all') && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-xs"></div>}
                <span className="uppercase tracking-wider">Todos os Bancos</span>
            </button>

            {list.map(item => (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-200 text-[11px] cursor-pointer ${
                        selectedId === item.id 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-600 text-white shadow-xs font-black' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 font-bold'
                    }`}
                >
                    {selectedId === item.id && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-xs"></div>}
                    <span className="truncate max-w-[150px] uppercase tracking-wider">{item.name}</span>
                </button>
            ))}
        </div>
    </div>
);
