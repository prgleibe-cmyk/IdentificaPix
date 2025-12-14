
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { EmptyState } from '../components/EmptyState';
import { DocumentDuplicateIcon, SearchIcon, TrashIcon, EyeIcon, CalendarIcon, CircleStackIcon, PencilIcon, FloppyDiskIcon, XCircleIcon, XMarkIcon } from '../components/Icons';
import { Language, SavedReport } from '../types';

const formatDate = (isoString: string, language: Language) => {
    return new Date(isoString).toLocaleString(language, {
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

export const SavedReportsView: React.FC = () => {
    const { savedReports, viewSavedReport, openDeleteConfirmation, updateSavedReportName } = useContext(AppContext);
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const filteredReports = useMemo(() => {
        if (!searchQuery) {
            return savedReports;
        }
        return savedReports.filter(report =>
            report.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [savedReports, searchQuery]);

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
        if (e.key === 'Enter') {
            handleSaveEdit(reportId);
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
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
                <div>
                    <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('savedReports.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1">{t('savedReports.subtitle')}</p>
                </div>

                {/* Barra de Busca Compacta */}
                <div className="relative w-full md:w-64">
                    <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder={t('savedReports.search')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-8 pr-8 py-1.5 block w-full rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-brand-graphite dark:text-slate-200 text-[11px] font-medium shadow-sm focus:border-brand-blue focus:ring-brand-blue transition-all outline-none placeholder:text-slate-400"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <XMarkIcon className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Grid de Relatórios */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-2">
                {filteredReports.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {filteredReports
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .map(report => {
                                const isEditing = editingReportId === report.id;
                                return (
                                    <div key={report.id} className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-all duration-300 relative flex flex-col justify-between hover:border-brand-blue/30 dark:hover:border-blue-500/30">
                                        
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                {/* Icon Box */}
                                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-brand-blue border border-blue-100 dark:border-blue-800 rounded-xl shadow-sm">
                                                    <DocumentDuplicateIcon className="w-4 h-4 stroke-[2]" />
                                                </div>
                                                
                                                {/* Actions */}
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {isEditing ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleSaveEdit(report.id)}
                                                                className="p-1.5 rounded-full text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/50 transition-colors shadow-sm"
                                                                title={t('common.save')}
                                                            >
                                                                <FloppyDiskIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={handleCancelEdit}
                                                                className="p-1.5 rounded-full text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors shadow-sm"
                                                                title={t('common.cancel')}
                                                            >
                                                                <XCircleIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleStartEdit(report)}
                                                                className="p-1.5 rounded-full text-brand-blue bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/50 transition-colors"
                                                                title={t('common.edit')}
                                                            >
                                                                <PencilIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => openDeleteConfirmation({ type: 'report-saved', id: report.id, name: report.name })}
                                                                className="p-1.5 rounded-full text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 transition-colors"
                                                                title={t('common.delete')}
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    value={editName} 
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onKeyDown={(e) => handleKeyDown(e, report.id)}
                                                    autoFocus
                                                    className="w-full text-sm font-bold text-brand-graphite dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 mb-2 focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                                                />
                                            ) : (
                                                <h3 className="font-bold text-brand-graphite dark:text-white text-sm leading-tight mb-2 line-clamp-1" title={report.name}>
                                                    {report.name}
                                                </h3>
                                            )}
                                            
                                            <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-3">
                                                <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-700">
                                                    <CalendarIcon className="w-3 h-3" />
                                                    {formatDate(report.createdAt, language)}
                                                </span>
                                                <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-700">
                                                    <CircleStackIcon className="w-3 h-3" />
                                                    {report.recordCount} reg.
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => viewSavedReport(report.id)}
                                            disabled={isEditing}
                                            className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-[10px] font-bold rounded-full text-white shadow-md transition-all uppercase tracking-wide ${isEditing ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] hover:-translate-y-0.5 active:scale-95'}`}
                                        >
                                            <EyeIcon className="w-3.5 h-3.5" />
                                            <span>{t('savedReports.view')}</span>
                                        </button>
                                    </div>
                                );
                            })
                        }
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-center rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-3">
                            <SearchIcon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-xs">{t('common.noResults')}</p>
                        <p className="text-slate-400 text-[10px] mt-1">Tente buscar por outro nome.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
