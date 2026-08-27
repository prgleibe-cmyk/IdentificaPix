
import React from 'react';

interface ChurchChipsListProps {
    list: { id: string; name: string; count: number }[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export const ChurchChipsList: React.FC<ChurchChipsListProps> = ({ list, selectedId, onSelect }) => {
    if (list.length <= 1) {
        return null;
    }

    return (
        <div className="w-full">
            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 px-1 touch-pan-x">
                {list.length > 0 ? list.map(item => (
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
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${selectedId === item.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-500'}`}>
                            {item.count}
                        </span>
                    </button>
                )) : <span className="text-xs text-slate-400 italic px-2">Nenhuma igreja identificada.</span>}
            </div>
        </div>
    );
};
