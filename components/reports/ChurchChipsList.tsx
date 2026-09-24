
import React from 'react';
import { BuildingOfficeIcon } from '../Icons';

interface ChurchChipsListProps {
    list: { id: string; name: string; count: number }[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export const ChurchChipsList: React.FC<ChurchChipsListProps> = ({ list, selectedId, onSelect }) => {
    if (!list || list.length === 0) {
        return null;
    }

    const currentSelectedId = (selectedId && list.some(i => i.id === selectedId)) 
        ? selectedId 
        : (list[0]?.id || '');

    return (
        <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs shadow-xs w-fit max-w-full">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl font-bold shadow-xs border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-200 shrink-0">
                <BuildingOfficeIcon className="w-3.5 h-3.5 text-blue-600" />
                <span className="uppercase tracking-wider">Igreja</span>
            </div>
            <select
                value={currentSelectedId}
                onChange={(e) => onSelect(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white px-2.5 py-1 rounded-xl text-xs focus:outline-none focus:border-blue-500 cursor-pointer min-w-[200px] max-w-[340px] truncate"
            >
                {list.map(item => (
                    <option key={item.id} value={item.id}>
                        {item.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

