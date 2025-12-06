import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { EmptyState } from '../components/EmptyState';
import { DocumentDuplicateIcon, SearchIcon, TrashIcon, EyeIcon, CalendarIcon, CircleStackIcon, PencilIcon, FloppyDiskIcon, XCircleIcon } from '../components/Icons';
import { Language, SavedReport } from '../types';

const formatDate = (isoString: string, language: Language) => {
    return new Date(isoString).toLocaleString(language, {
        dateStyle: 'long',
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
            <div className="mt-8">
                <EmptyState
                    icon={<DocumentDuplicateIcon className="w-12 h-12 text-indigo-500 dark:text-indigo-400" />}
                    title={t('savedReports.empty.title')}
                    message={t('savedReports.empty.message')}
                    action={{
                        text: t('empty.dashboard.action'), // Using dashboard action key as fallback for "Start"
                        onClick: () => setActiveView('upload'),
                    }}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full lg:h-[calc(100vh-5.5rem)] animate-fade-in gap-4 pb-2">
            <div className="flex-shrink-0">
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-indigo-800 dark:from-white dark:to-indigo-200 tracking-tight">{t('savedReports.title')}</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{t('savedReports.subtitle')}</p>
            </div>

            <div className="flex-1 min-h-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-6 rounded-3xl shadow-xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-700 relative overflow-hidden flex flex-col">
                
                {/* Decorative background blob */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100/50 dark:bg-indigo-900/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>

                <div className="relative mb-6 z-10 max-w-lg flex-shrink-0">
                    <SearchIcon className="w-5 h-5 text-indigo-500 absolute top-1/2 left-4 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder={t('savedReports.search')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-12 p-3.5 block w-full rounded-2xl border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-200 shadow-inner focus:border-indigo-500 focus:ring-indigo-500 transition-all backdrop-blur-sm placeholder:text-slate-400 text-sm"
                    />
                </div>

                <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {filteredReports.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredReports
                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                .map(report => {
                                    const isEditing = editingReportId === report.id;
                                    return (
                                        <div key={report.id} className="group flex flex-col justify-between bg-white/70 dark:bg-slate-900/40 rounded-2xl border border-white/60 dark:border-slate-700 p-5 shadow-sm hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 transform hover:-translate-y-0.5 backdrop-blur-sm relative overflow-hidden h-full">
                                            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-indigo-50/30 dark:to-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                            
                                            <div className="relative z-10">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
                                                        <DocumentDuplicateIcon className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex space-x-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                        {isEditing ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleSaveEdit(report.id)}
                                                                    className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/50 transition-colors shadow-sm"
                                                                    title={t('common.save')}
                                                                >
                                                                    <FloppyDiskIcon className="w-4 h-4 stroke-[1.5]" />
                                                                </button>
                                                                <button
                                                                    onClick={handleCancelEdit}
                                                                    className="p-1.5 rounded-lg text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors shadow-sm"
                                                                    title={t('common.cancel')}
                                                                >
                                                                    <XCircleIcon className="w-4 h-4 stroke-[1.5]" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => handleStartEdit(report)}
                                                                    className="p-1.5 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/50 transition-colors shadow-sm"
                                                                    title={t('common.edit')}
                                                                >
                                                                    <PencilIcon className="w-4 h-4 stroke-[1.5]" />
                                                                </button>
                                                                <button
                                                                    onClick={() => openDeleteConfirmation({ type: 'report-saved', id: report.id, name: report.name })}
                                                                    className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-900/50 transition-colors shadow-sm"
                                                                    aria-label={`${t('savedReports.delete')} ${report.name}`}
                                                                    title={t('common.delete')}
                                                                >
                                                                    <TrashIcon className="w-4 h-4 stroke-[1.5]" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {isEditing ? (
                                                    <div className="mb-3">
                                                        <input 
                                                            type="text" 
                                                            value={editName} 
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            onKeyDown={(e) => handleKeyDown(e, report.id)}
                                                            autoFocus
                                                            className="w-full text-base font-bold text-slate-800 dark:text-white bg-white/50 dark:bg-slate-800/50 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                                        />
                                                    </div>
                                                ) : (
                                                    <h3 className="font-bold text-slate-800 dark:text-white text-base tracking-tight mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 min-h-[3rem]">
                                                        {report.name}
                                                    </h3>
                                                )}
                                                
                                                <div className="grid grid-cols-2 gap-2 mb-4">
                                                    <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                                                        <div className="p-1 rounded-md bg-slate-100 dark:bg-slate-800">
                                                            <CalendarIcon className="w-3.5 h-3.5" />
                                                        </div>
                                                        <span className="text-[10px] xl:text-xs font-medium truncate">{formatDate(report.createdAt, language)}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                                                        <div className="p-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                                                            <CircleStackIcon className="w-3.5 h-3.5" />
                                                        </div>
                                                        <span className="text-[10px] xl:text-xs font-medium truncate">{report.recordCount} {t('savedReports.records')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="relative z-10 pt-3 border-t border-slate-100 dark:border-slate-700/50 mt-auto">
                                                <button
                                                    onClick={() => viewSavedReport(report.id)}
                                                    disabled={isEditing}
                                                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl text-white shadow-md transition-all ${isEditing ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98]'}`}
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                    <span>{t('savedReports.view')}</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30">
                            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                                <SearchIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">{t('common.noResults')}</p>
                            <p className="text-slate-400 text-sm mt-1">Tente buscar por outro termo.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
