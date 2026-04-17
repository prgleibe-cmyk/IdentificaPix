import React from 'react';
import { 
    DocumentDuplicateIcon, 
    PencilIcon, 
    TrashIcon, 
    EyeIcon, 
    FloppyDiskIcon, 
    XCircleIcon, 
    CalendarIcon, 
    ChartBarIcon 
} from '../Icons';
import { SavedReport, Language } from '../../types';

interface ReportRowProps {
    report: SavedReport;
    isEditing: boolean;
    editName: string;
    setEditName: (val: string) => void;
    onSaveEdit: (id: string) => void;
    onCancelEdit: () => void;
    onStartEdit: (report: SavedReport) => void;
    onView: (id: string) => void;
    onDelete: (id: string, name: string) => void;
    formatDate: (iso: string, lang: Language) => string;
    language: Language;
}

export const ReportRow: React.FC<ReportRowProps> = ({
    report,
    isEditing,
    editName,
    setEditName,
    onSaveEdit,
    onCancelEdit,
    onStartEdit,
    onView,
    onDelete,
    formatDate,
    language
}) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') onSaveEdit(report.id);
        else if (e.key === 'Escape') onCancelEdit();
    };

    return (
        <tr className="group hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-all duration-300">
            <td className="px-6 py-2.5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-brand-blue border border-blue-100 dark:border-blue-800 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">
                        <DocumentDuplicateIcon className="w-4 h-4 stroke-[1.5]" />
                    </div>
                    
                    {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                            <input 
                                type="text" 
                                value={editName} 
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                className="w-full text-xs font-bold text-brand-graphite dark:text-white bg-white dark:bg-slate-900 border border-brand-blue rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-brand-blue/20 outline-none shadow-sm"
                            />
                            <button onClick={() => onSaveEdit(report.id)} className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors" title="Salvar">
                                <FloppyDiskIcon className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={onCancelEdit} className="p-1.5 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors" title="Cancelar">
                                <XCircleIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col min-w-0 group/edit relative pr-6">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate cursor-default group-hover:text-brand-blue transition-colors">
                                    {report.name}
                                </span>
                                <button 
                                    onClick={() => onStartEdit(report)}
                                    className="opacity-0 group-hover/edit:opacity-100 p-1 text-slate-400 hover:text-brand-blue transition-all"
                                    title="Renomear"
                                >
                                    <PencilIcon className="w-3 h-3" />
                                </button>
                            </div>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium truncate">
                                ID: {report.id.substring(0, 12)}...
                            </span>
                        </div>
                    )}
                </div>
            </td>
            
            <td className="px-6 py-2.5">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <CalendarIcon className="w-3 h-3" />
                    <span className="text-[10px] font-bold font-mono">
                        {formatDate(report.createdAt, language)}
                    </span>
                </div>
            </td>
            
            <td className="px-6 py-2.5 text-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    <ChartBarIcon className="w-3 h-3 text-slate-400" />
                    {report.recordCount}
                </span>
            </td>
            
            <td className="px-6 py-2.5">
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => onView(report.id)}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-[9px] font-bold text-white bg-gradient-to-r from-sky-700 to-cyan-500 hover:from-sky-600 hover:to-cyan-400 rounded-full shadow-lg shadow-sky-500/30 hover:-translate-y-0.5 transition-all active:scale-95 uppercase tracking-wide border border-white/10"
                    >
                        <EyeIcon className="w-3.5 h-3.5" />
                        Visualizar
                    </button>
                    <button
                        onClick={() => onDelete(report.id, report.name)}
                        className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all hover:scale-110"
                        title="Excluir"
                    >
                        <TrashIcon className="w-3.5 h-3.5 stroke-[2]" />
                    </button>
                </div>
            </td>
        </tr>
    );
};