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
    onDuplicate: (report: SavedReport) => void;
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
    onDuplicate,
    onDelete,
    formatDate,
    language
}) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') onSaveEdit(report.id);
        else if (e.key === 'Escape') onCancelEdit();
    };

    return (
        <tr className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
            <td className="px-6 py-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-center shrink-0">
                        <DocumentDuplicateIcon className="w-4 h-4 stroke-[1.75]" />
                    </div>
                    
                    {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                            <input 
                                type="text" 
                                value={editName} 
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                className="w-full text-xs font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-orange-500 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-orange-500/20 outline-none shadow-2xs"
                            />
                            <button onClick={() => onSaveEdit(report.id)} className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 transition-colors cursor-pointer" title="Salvar">
                                <FloppyDiskIcon className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={onCancelEdit} className="p-1.5 rounded-lg text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 transition-colors cursor-pointer" title="Cancelar">
                                <XCircleIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col min-w-0 group/edit relative pr-6">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate cursor-default group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                    {report.name}
                                </span>
                                <button 
                                    onClick={() => onStartEdit(report)}
                                    className="opacity-0 group-hover/edit:opacity-100 p-1 text-slate-400 hover:text-orange-600 transition-all cursor-pointer"
                                    title="Renomear"
                                >
                                    <PencilIcon className="w-3 h-3" />
                                </button>
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate tabular-nums">
                                ID: {report.id.substring(0, 12)}...
                            </span>
                        </div>
                    )}
                </div>
            </td>
            
            <td className="px-6 py-3">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium tabular-nums">
                        {formatDate(report.createdAt, language)}
                    </span>
                </div>
            </td>
            
            <td className="px-6 py-3 text-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 tabular-nums">
                    <ChartBarIcon className="w-3 h-3 text-slate-400" />
                    {report.recordCount}
                </span>
            </td>
            
            <td className="px-6 py-3">
                <div className="flex items-center justify-center gap-1.5">
                    <button
                        onClick={() => onView(report.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                        <EyeIcon className="w-3.5 h-3.5" />
                        Visualizar
                    </button>
                    <button
                        onClick={() => onDuplicate(report)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer"
                        title="Duplicar"
                    >
                        <DocumentDuplicateIcon className="w-3.5 h-3.5 text-slate-400" />
                        Duplicar
                    </button>
                    <button
                        onClick={() => onDelete(report.id, report.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200/70 dark:hover:border-rose-900/40 transition-all cursor-pointer"
                        title="Excluir"
                    >
                        <TrashIcon className="w-3.5 h-3.5 stroke-[2]" />
                    </button>
                </div>
            </td>
        </tr>
    );
};