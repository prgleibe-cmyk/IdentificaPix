
import React from 'react';
import { XMarkIcon, ArrowsRightLeftIcon } from '../../Icons';

interface SmartEditHeaderProps {
    isReverseMode: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onClose: () => void;
}

export const SmartEditHeader: React.FC<SmartEditHeaderProps> = ({ isReverseMode, onMouseDown, onClose }) => (
    <div onMouseDown={onMouseDown} className={`px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center cursor-move select-none group transition-colors ${isReverseMode ? 'bg-amber-50/60 dark:bg-amber-950/30' : 'bg-slate-50/80 dark:bg-slate-950/60'}`}>
        <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ArrowsRightLeftIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-600 rotate-45 transition-colors" />
            {isReverseMode ? 'Vincular Extrato' : 'Identificar'}
        </h3>
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md">Esc</span>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer" onMouseDown={(e) => e.stopPropagation()}><XMarkIcon className="w-4 h-4" /></button>
        </div>
    </div>
);
