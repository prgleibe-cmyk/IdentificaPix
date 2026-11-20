
import React from 'react';
import { DocumentDuplicateIcon, XMarkIcon } from '../Icons';

interface ReportSelectorModalProps {
    savedReports: any[];
    onSelect: (report: any) => void;
    onClose: () => void;
}

export const ReportSelectorModal: React.FC<ReportSelectorModalProps> = ({ savedReports, onSelect, onClose }) => (
    <div
        className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-elevated w-full max-w-lg max-h-[calc(100dvh-5rem)] md:max-h-[min(85vh,calc(100dvh-3rem))] flex flex-col overflow-hidden animate-scale-in">
            <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-900 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                        <DocumentDuplicateIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">Selecionar Planilha</h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Escolha a base para o ranking.</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"><XMarkIcon className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/20" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                {savedReports.length === 0 ? <div className="text-center py-8 text-xs text-slate-400">Nenhuma planilha salva.</div> : 
                <div className="space-y-2">{savedReports.map(report => (
                    <button key={report.id} onClick={() => onSelect(report)} className="w-full text-left p-3.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl hover:border-orange-500 dark:hover:border-orange-500 hover:shadow-xs transition-colors group flex items-center justify-between cursor-pointer">
                        <div><h4 className="font-semibold text-sm text-slate-800 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400">{report.name}</h4><p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">{new Date(report.createdAt).toLocaleDateString()} • {report.recordCount} registros</p></div>
                        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-400 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/40 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors"><DocumentDuplicateIcon className="w-4 h-4" /></div>
                    </button>
                ))}</div>}
            </div>
        </div>
    </div>
);
