
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
    <header className="px-6 py-4 bg-slate-100 dark:bg-[#020610] border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-3 z-20">
        <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-inner">
                <WrenchScrewdriverIcon className="w-5 h-5" />
            </div>
            <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white leading-none">Laboratório de IA</h3>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest truncate max-w-[200px]">{fileName}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {canApprove && (
                <button 
                    onClick={onApprove} 
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-[10px] font-bold uppercase flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                >
                    <ShieldCheckIcon className="w-3.5 h-3.5" /> 
                    <span>Aprovar Modelo</span>
                </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                <XMarkIcon className="w-6 h-6" />
            </button>
        </div>
    </header>
);
