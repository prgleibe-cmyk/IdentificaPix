
import React from 'react';
import { DocumentDuplicateIcon, XMarkIcon } from '../Icons';

interface ReportSelectorModalProps {
    savedReports: any[];
    onSelect: (report: any) => void;
    onClose: () => void;
}

export const ReportSelectorModal: React.FC<ReportSelectorModalProps> = ({ savedReports, onSelect, onClose }) => (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh] overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <div><h3 className="text-lg font-black text-slate-800 dark:text-white">Selecionar Relatório</h3><p className="text-xs text-slate-500 font-medium">Escolha a base para o ranking.</p></div>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-400"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/20">
                {savedReports.length === 0 ? <div className="text-center py-8 text-slate-400">Nenhum relatório salvo.</div> : 
                <div className="space-y-2">{savedReports.map(report => (
                    <button key={report.id} onClick={() => onSelect(report)} className="w-full text-left p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-blue dark:hover:border-brand-blue hover:shadow-md transition-all group flex items-center justify-between">
                        <div><h4 className="font-bold text-sm text-slate-700 dark:text-white group-hover:text-brand-blue">{report.name}</h4><p className="text-xs text-slate-500 mt-1">{new Date(report.createdAt).toLocaleDateString()} • {report.recordCount} registros</p></div>
                        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-400 group-hover:bg-blue-50 group-hover:text-brand-blue"><DocumentDuplicateIcon className="w-5 h-5" /></div>
                    </button>
                ))}</div>}
            </div>
        </div>
    </div>
);
