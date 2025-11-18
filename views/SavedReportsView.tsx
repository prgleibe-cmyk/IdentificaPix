import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { EmptyState } from '../components/EmptyState';
import { DocumentDuplicateIcon, SearchIcon, TrashIcon } from '../components/Icons';
import { Language } from '../types';

const formatDate = (isoString: string, language: Language) => {
    return new Date(isoString).toLocaleString(language, {
        dateStyle: 'long',
        timeStyle: 'short',
    });
};

export const SavedReportsView: React.FC = () => {
    const { savedReports, viewSavedReport, openDeleteConfirmation } = useContext(AppContext);
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredReports = useMemo(() => {
        if (!searchQuery) {
            return savedReports;
        }
        return savedReports.filter(report =>
            report.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [savedReports, searchQuery]);

    if (savedReports.length === 0) {
        return (
            <EmptyState
                icon={<DocumentDuplicateIcon className="w-8 h-8 text-blue-700 dark:text-blue-400" />}
                title={t('savedReports.empty.title')}
                message={t('savedReports.empty.message')}
                action={{
                    text: t('empty.dashboard.action'),
                    onClick: () => setActiveView('upload'),
                }}
            />
        );
    }

    return (
        <>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{t('savedReports.title')}</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{t('savedReports.subtitle')}</p>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="relative mb-4">
                    <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder={t('savedReports.search')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10 p-2 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400"
                    />
                </div>

                <div className="space-y-3">
                    {filteredReports.length > 0 ? (
                        filteredReports
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(report => (
                        <div key={report.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                            <div>
                                <p className="font-semibold text-blue-800 dark:text-blue-300">{report.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('savedReports.generatedAt')} {formatDate(report.createdAt, language)} • {report.recordCount} {t('savedReports.records')}
                                </p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => viewSavedReport(report.id)}
                                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white transition-colors"
                                >
                                    {t('savedReports.view')}
                                </button>
                                <button
                                    onClick={() => openDeleteConfirmation({ type: 'report-saved', id: report.id, name: report.name })}
                                    className="p-2 rounded-full text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                    aria-label={`${t('savedReports.delete')} ${report.name}`}
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))) : (
                        <p className="text-center py-8 text-slate-500 dark:text-slate-400">{t('common.noResults')}</p>
                    )}
                </div>
            </div>
        </>
    );
};