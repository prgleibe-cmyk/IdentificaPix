
import React from 'react';
import { XMarkIcon, WrenchScrewdriverIcon, ShieldCheckIcon } from '../../Icons';

interface PreprocessorHeaderProps {
    fileName: string;
    canApprove: boolean;
    onApprove: () => void;
    onClose: () => void;
}

export const PreprocessorHeader: React.FC<PreprocessorHeaderProps> = ({ 
    fileName, 
    canApprove, 
    onApprove, 
    onClose 
}) => (
    <header className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-3 z-20">
        <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-200/80 dark:border-orange-900/50 flex items-center justify-center shrink-0">
                <WrenchScrewdriverIcon className="w-5 h-5" />
            </div>
            <div>
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight">Laboratório de IA</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[240px]">{fileName}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {canApprove && (
                <button 
                    onClick={onApprove} 
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-[0.98]"
                >
                    <ShieldCheckIcon className="w-4 h-4" /> 
                    <span>Aprovar Modelo</span>
                </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <XMarkIcon className="w-5 h-5" />
            </button>
        </div>
    </header>
);
