import React from 'react';
import { ChevronUpIcon, ChevronDownIcon, SearchIcon } from '../Icons';
import { SortKey, SortDirection } from '../../hooks/useSavedReportsController';
import { ReportRow } from './ReportRow';
import { SavedReport, Language } from '../../types';

interface ReportsTableProps {
    reports: SavedReport[];
    sortConfig: { key: SortKey; direction: SortDirection };
    onSort: (key: SortKey) => void;
    editingReportId: string | null;
    editName: string;
    setEditName: (val: string) => void;
    onSaveEdit: (id: string) => void;
    onCancelEdit: () => void;
    onStartEdit: (report: SavedReport) => void;
    onView: (id: string) => void;
    onDelete: (id: string, name: string) => void;
    formatDate: (iso: string, lang: Language) => string;
    language: Language;
    noResultsText: string;
}

const SortHeader: React.FC<{ 
    label: string, 
    sortKey: SortKey, 
    currentSort: { key: SortKey, direction: SortDirection }, 
    onSort: (key: SortKey) => void,
    className?: string
}> = ({ label, sortKey, currentSort, onSort, className = "" }) => {
    const isActive = currentSort.key === sortKey;
    return (
        <th className={`px-6 py-3 ${className}`}>
            <button onClick={() => onSort(sortKey)} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group focus:outline-none w-full justify-start">
                {label}
                {isActive ? (
                    currentSort.direction === 'asc' 
                        ? <ChevronUpIcon className="w-3 h-3 text-brand-blue" />
                        : <ChevronDownIcon className="w-3 h-3 text-brand-blue" />
                ) : (
                    <ChevronDownIcon className="w-3 h-3 opacity-30 group-hover:opacity-60" />
                )}
            </button>
        </th>
    );
};

export const ReportsTable: React.FC<ReportsTableProps> = ({
    reports,
    sortConfig,
    onSort,
    editingReportId,
    editName,
    setEditName,
    onSaveEdit,
    onCancelEdit,
    onStartEdit,
    onView,
    onDelete,
    formatDate,
    language,
    noResultsText
}) => (
    <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-100 dark:border-slate-700">
                    <tr>
                        <SortHeader label="Nome do Relatório" sortKey="name" currentSort={sortConfig} onSort={onSort} className="w-[45%]" />
                        <SortHeader label="Criado em" sortKey="createdAt" currentSort={sortConfig} onSort={onSort} className="w-[20%]" />
                        <SortHeader label="Registros" sortKey="recordCount" currentSort={sortConfig} onSort={onSort} className="w-[15%]" />
                        <th className="px-6 py-3 w-[20%] text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            Ações
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {reports.length > 0 ? (
                        reports.map((report) => (
                            <ReportRow 
                                key={report.id}
                                report={report}
                                isEditing={editingReportId === report.id}
                                editName={editName}
                                setEditName={setEditName}
                                onSaveEdit={onSaveEdit}
                                onCancelEdit={onCancelEdit}
                                onStartEdit={onStartEdit}
                                onView={onView}
                                onDelete={onDelete}
                                formatDate={formatDate}
                                language={language}
                            />
                        ))
                    ) : (
                        <tr>
                            <td colSpan={4} className="py-20 text-center">
                                <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                    <SearchIcon className="w-10 h-10 mb-2 opacity-20" />
                                    <p className="text-xs font-bold">{noResultsText}</p>
                                    <p className="text-[10px] mt-0.5 opacity-70">Tente ajustar sua busca.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);