
import React, { useContext, useState, useRef, useEffect } from 'react';
import { SparklesIcon, ArrowPathIcon, DocumentArrowDownIcon, PrinterIcon, CheckCircleIcon } from '../Icons';
import { AppContext } from '../../contexts/AppContext';

interface ReportToolbarProps {
    onAiClick: () => void;
    onUpdateSource: () => void;
    onDownload: () => void;
    onDownloadExcel?: () => void;
    onDownloadPdf?: () => void;
    onPrint: () => void;
    onSaveReport: () => void;
    hasActiveReport: boolean;
    role?: string;
}

export const ReportToolbar: React.FC<ReportToolbarProps> = ({ 
    onAiClick, 
    onUpdateSource, 
    onDownload, 
    onDownloadExcel,
    onDownloadPdf,
    onPrint, 
    onSaveReport, 
    hasActiveReport,
    role
}) => {
    const { isSyncing } = useContext(AppContext);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const isOwner = role === 'owner';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowDownloadMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex items-center gap-2 w-full md:w-auto ml-auto">
            {/* Indicador de Sincronia Automática */}
            {hasActiveReport && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-500 ${isSyncing ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                    {isSyncing ? (
                        <div className="animate-spin h-2.5 w-2.5 border-2 border-current border-t-transparent rounded-full"></div>
                    ) : (
                        <CheckCircleIcon className="w-3 h-3" />
                    )}
                    <span className="text-[9px] font-black uppercase tracking-widest">
                        {isSyncing ? 'Sincronizando' : 'Sincronizado'}
                    </span>
                </div>
            )}

            <button onClick={onAiClick} className="relative flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-[10px] uppercase font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md transition-all active:scale-95 group border border-white/10" title="Conciliação Automática de Vínculos">
                <SparklesIcon className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                <span>Conciliação Inteligente</span>
            </button>
            
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
            
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full p-0.5 border border-slate-200 dark:border-slate-700 shadow-sm relative">
                <button onClick={onUpdateSource} className="p-1.5 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-all" title="Atualizar Fonte"><ArrowPathIcon className="w-3.5 h-3.5" /></button>
                
                <div className="relative" ref={menuRef}>
                    <button 
                        onClick={() => setShowDownloadMenu(!showDownloadMenu)} 
                        className="p-1.5 rounded-full text-slate-400 hover:text-brand-blue hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer" 
                        title="Baixar Relatório"
                    >
                        <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                    </button>
                    {showDownloadMenu && (
                        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-50 animate-fade-in text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            <button 
                                onClick={() => { onDownload(); setShowDownloadMenu(false); }} 
                                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 hover:text-brand-blue transition-colors cursor-pointer font-semibold"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Baixar como CSV
                            </button>
                            {onDownloadExcel && (
                                <button 
                                    onClick={() => { onDownloadExcel(); setShowDownloadMenu(false); }} 
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 hover:text-brand-blue transition-colors cursor-pointer font-semibold"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    Baixar como Excel (XLSX)
                                </button>
                            )}
                            {onDownloadPdf && (
                                <button 
                                    onClick={() => { onDownloadPdf(); setShowDownloadMenu(false); }} 
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 hover:text-brand-blue transition-colors cursor-pointer font-semibold"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    Baixar como PDF
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <button onClick={onPrint} className="p-1.5 rounded-full text-slate-400 hover:text-brand-blue hover:bg-white dark:hover:bg-slate-700 transition-all" title="Imprimir"><PrinterIcon className="w-3.5 h-3.5" /></button>
            </div>
        </div>
    );
};
