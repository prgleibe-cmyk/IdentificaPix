
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { EmptyState } from '../components/EmptyState';
import { 
    DocumentDuplicateIcon, 
    SearchIcon, 
    TrashIcon, 
    EyeIcon, 
    PencilIcon, 
    FloppyDiskIcon, 
    XCircleIcon, 
    XMarkIcon, 
    ChevronUpIcon, 
    ChevronDownIcon,
    TableCellsIcon
} from '../components/Icons';
import { Language, SavedReport } from '../types';

const formatDate = (isoString: string, language: Language) => {
    return new Date(isoString).toLocaleString(language, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

type SortKey = 'name' | 'createdAt' | 'recordCount';
type SortDirection = 'asc' | 'desc';

export const SavedReportsView: React.FC = () => {
    const { savedReports, viewSavedReport, openDeleteConfirmation, updateSavedReportName } = useContext(AppContext);
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();
    
    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
        key: 'createdAt', 
        direction: 'desc' 
    });

    // Filter & Sort Logic
    const processedReports = useMemo(() => {
        let result = [...savedReports];

        // 1. Filter
        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            result = result.filter(report =>
                report.name.toLowerCase().includes(lowerQ)
            );
        }

        // 2. Sort
        result.sort((a, b) => {
            let valA: any = a[sortConfig.key];
            let valB: any = b[sortConfig.key];

            // Special handling for dates
            if (sortConfig.key === 'createdAt') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            }
            
            // String comparison for names
            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [savedReports, searchQuery, sortConfig]);

    // Handlers
    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleStartEdit = (report: SavedReport) => {
        setEditingReportId(report.id);
        setEditName(report.name);
    };

    const handleCancelEdit = () => {
        setEditingReportId(null);
        setEditName('');
    };

    const handleSaveEdit = (reportId: string) => {
        if (editName.trim()) {
            updateSavedReportName(reportId, editName);
            handleCancelEdit();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, reportId: string) => {
        if (e.key === 'Enter') handleSaveEdit(reportId);
        else if (e.key === 'Escape') handleCancelEdit();
    };

    // Sort Icon Helper
    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortConfig.key !== columnKey) return <ChevronDownIcon className="w-3 h-3 opacity-30 group-hover:opacity-60" />;
        return sortConfig.direction === 'asc' 
            ? <ChevronUpIcon className="w-3 h-3 text-brand-blue" />
            : <ChevronDownIcon className="w-3 h-3 text-brand-blue" />;
    };

    if (savedReports.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState
                    icon={<DocumentDuplicateIcon className="w-12 h-12 text-brand-blue dark:text-blue-400" />}
                    title={t('savedReports.empty.title')}
                    message={t('savedReports.empty.message')}
                    action={{
                        text: t('empty.dashboard.action'), 
                        onClick: () => setActiveView('upload'),
                    }}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in gap-4 pb-2">
            {/* Header Compacto */}
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-3 px-1">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400">
                        <TableCellsIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('savedReports.title')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1 font-medium">
                            {savedReports.length} {savedReports.length === 1 ? 'relatório salvo' : 'relatórios salvos'}
                        </p>
                    </div>
                </div>

                {/* Barra de Busca */}
                <div className="relative w-full md:w-64">
                    <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder={t('savedReports.search')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 pr-8 py-2 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-brand-graphite dark:text-slate-200 text-xs font-bold shadow-sm focus:border-brand-blue focus:ring-brand-blue transition-all outline-none placeholder:text-slate-400 placeholder:font-medium"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <XMarkIcon className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Tabela estilo Planilha */}
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-3 w-[45%]">
                                    <button onClick={() => handleSort('name')} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group focus:outline-none">
                                        Nome do Relatório
                                        <SortIcon columnKey="name" />
                                    </button>
                                </th>
                                <th className="px-6 py-3 w-[20%]">
                                    <button onClick={() => handleSort('createdAt')} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group focus:outline-none">
                                        Criado em
                                        <SortIcon columnKey="createdAt" />
                                    </button>
                                </th>
                                <th className="px-6 py-3 w-[15%] text-center">
                                    <button onClick={() => handleSort('recordCount')} className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group focus:outline-none w-full">
                                        Registros
                                        <SortIcon columnKey="recordCount" />
                                    </button>
                                </th>
                                <th className="px-6 py-3 w-[20%] text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {processedReports.length > 0 ? (
                                processedReports.map((report) => {
                                    const isEditing = editingReportId === report.id;
                                    return (
                                        <tr 
                                            key={report.id} 
                                            className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                                        >
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-brand-blue rounded-lg">
                                                        <DocumentDuplicateIcon className="w-4 h-4" />
                                                    </div>
                                                    
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <input 
                                                                type="text" 
                                                                value={editName} 
                                                                onChange={(e) => setEditName(e.target.value)}
                                                                onKeyDown={(e) => handleKeyDown(e, report.id)}
                                                                autoFocus
                                                                className="w-full text-sm font-bold text-brand-graphite dark:text-white bg-white dark:bg-slate-900 border border-brand-blue rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-brand-blue/20 outline-none shadow-sm"
                                                            />
                                                            <button
                                                                onClick={() => handleSaveEdit(report.id)}
                                                                className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                                                                title="Salvar"
                                                            >
                                                                <FloppyDiskIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={handleCancelEdit}
                                                                className="p-1.5 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                                                                title="Cancelar"
                                                            >
                                                                <XCircleIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 group/edit relative max-w-full">
                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate cursor-default">
                                                                {report.name}
                                                            </span>
                                                            <button 
                                                                onClick={() => handleStartEdit(report)}
                                                                className="opacity-0 group-hover/edit:opacity-100 p-1 text-slate-400 hover:text-brand-blue transition-opacity"
                                                                title="Renomear"
                                                            >
                                                                <PencilIcon className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            
                                            <td className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 font-mono">
                                                {formatDate(report.createdAt, language)}
                                            </td>
                                            
                                            <td className="px-6 py-3 text-center">
                                                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                    {report.recordCount}
                                                </span>
                                            </td>
                                            
                                            <td className="px-6 py-3">
                                                <div className="flex items-center justify-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => viewSavedReport(report.id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white bg-gradient-to-r from-brand-blue to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-full shadow-md shadow-blue-500/20 hover:-translate-y-0.5 transition-all active:scale-95"
                                                    >
                                                        <EyeIcon className="w-3 h-3" />
                                                        Abrir
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteConfirmation({ type: 'report-saved', id: report.id, name: report.name })}
                                                        className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                            <SearchIcon className="w-10 h-10 mb-2 opacity-50" />
                                            <p className="text-xs font-bold">{t('common.noResults')}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
