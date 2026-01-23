
import React from 'react';

interface ChurchChipsListProps {
    list: { id: string; name: string; count: number }[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export const ChurchChipsList: React.FC<ChurchChipsListProps> = ({ list, selectedId, onSelect }) => (
    <div className="w-full">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto custom-scrollbar pb-2 px-1 touch-pan-x">
            {list.length > 0 ? list.map(item => (
                <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-200 text-xs ${
                        selectedId === item.id 
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 shadow-sm ring-1 ring-blue-100 dark:from-blue-900/40 dark:to-indigo-900/40' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'
                    }`}
                >
                    {selectedId === item.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_5px_rgba(37,99,235,0.6)]"></div>}
                    <span className="font-bold truncate max-w-[150px]">{item.name}</span>
                    <span className={`px-1.5 rounded text-[10px] font-bold ${selectedId === item.id ? 'bg-white/50 dark:bg-black/20' : 'bg-slate-100 text-slate-500'}`}>
                        {item.count}
                    </span>
                </button>
            )) : <span className="text-xs text-slate-400 italic px-2">Nenhuma igreja identificada.</span>}
        </div>
    </div>
);
