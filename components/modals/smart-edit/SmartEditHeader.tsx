
import React from 'react';
import { XMarkIcon, ArrowsRightLeftIcon } from '../../Icons';

interface SmartEditHeaderProps {
    isReverseMode: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onClose: () => void;
}

export const SmartEditHeader: React.FC<SmartEditHeaderProps> = ({ isReverseMode, onMouseDown, onClose }) => (
    <div onMouseDown={onMouseDown} className={`px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center cursor-move select-none group transition-colors ${isReverseMode ? 'bg-amber-50/50 dark:bg-amber-900/20' : 'bg-slate-50/50 dark:bg-slate-800/50'}`}>
        <h3 className="text-xs font-black text-slate-700 dark:text-white tracking-tight flex items-center gap-2 uppercase">
            <ArrowsRightLeftIcon className="w-3 h-3 text-slate-400 group-hover:text-brand-blue rotate-45 transition-colors" />
            {isReverseMode ? 'Vincular Extrato' : 'Identificar'}
        </h3>
        <div className="flex items-center gap-2">
            <span className="text-[7px] font-black text-slate-400 uppercase border border-slate-200 dark:border-slate-700 px-1 rounded">Esc</span>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors" onMouseDown={(e) => e.stopPropagation()}><XMarkIcon className="w-4 h-4" /></button>
        </div>
    </div>
);
