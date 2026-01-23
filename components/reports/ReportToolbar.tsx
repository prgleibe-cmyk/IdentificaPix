
import React from 'react';
import { SparklesIcon, ArrowPathIcon, DocumentArrowDownIcon, PrinterIcon, FloppyDiskIcon, DocumentDuplicateIcon } from '../Icons';

interface ReportToolbarProps {
    onAiClick: () => void;
    onUpdateSource: () => void;
    onDownload: () => void;
    onPrint: () => void;
    onSaveReport: () => void;
    onSaveChanges?: () => void;
    hasActiveReport: boolean;
}

export const ReportToolbar: React.FC<ReportToolbarProps> = ({ onAiClick, onUpdateSource, onDownload, onPrint, onSaveReport, onSaveChanges, hasActiveReport }) => (
    <div className="flex items-center gap-2 w-full md:w-auto ml-auto">
        <button onClick={onAiClick} className="relative flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-[10px] uppercase font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md transition-all active:scale-95 group border border-white/10" title="Conciliação Inteligente IA">
            <SparklesIcon className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
            <span>Conciliação Inteligente</span>
        </button>
        <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full p-0.5 border border-slate-200 dark:border-slate-700 shadow-sm">
            <button onClick={onUpdateSource} className="p-1.5 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-all" title="Atualizar Fonte"><ArrowPathIcon className="w-3.5 h-3.5" /></button>
            <button onClick={onDownload} className="p-1.5 rounded-full text-slate-400 hover:text-brand-blue hover:bg-white dark:hover:bg-slate-700 transition-all" title="Baixar CSV"><DocumentArrowDownIcon className="w-3.5 h-3.5" /></button>
            <button onClick={onPrint} className="p-1.5 rounded-full text-slate-400 hover:text-brand-blue hover:bg-white dark:hover:bg-slate-700 transition-all" title="Imprimir"><PrinterIcon className="w-3.5 h-3.5" /></button>
        </div>
        {hasActiveReport && onSaveChanges && (
            <button onClick={onSaveChanges} className="relative flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-[10px] uppercase font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 shadow-md transition-all border border-white/10">
                <FloppyDiskIcon className="w-3.5 h-3.5" /><span>Salvar Alt.</span>
            </button>
        )}
        <button onClick={onSaveReport} className="relative flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-[10px] uppercase font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md transition-all border border-white/10">
            <DocumentDuplicateIcon className="w-3.5 h-3.5" /><span>Salvar Relatório</span>
        </button>
    </div>
);
