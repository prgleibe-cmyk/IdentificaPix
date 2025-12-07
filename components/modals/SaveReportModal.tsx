import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon } from '../Icons';

export const SaveReportModal: React.FC = () => {
    const { savingReportState, closeSaveReportModal, confirmSaveReport } = useContext(AppContext);
    const { t, language } = useTranslation();
    const [name, setName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (savingReportState) {
            let defaultName = '';
            if (savingReportState.type === 'global') {
                defaultName = `${t('reports.previewTitle')} - ${new Date().toLocaleString(language)}`;
            } else {
                defaultName = `${t('reports.previewSubtitle')} - ${savingReportState.groupName} - ${new Date().toLocaleDateString(language)}`;
            }
            setName(defaultName);
        }
    }, [savingReportState, t, language]);

    if (!savingReportState) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            setIsSaving(true);
            confirmSaveReport(name.trim());
            // The modal will be closed by the context after saving is complete.
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('modal.saveReport.title')}</h3>
                            <button type="button" onClick={closeSaveReportModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="mt-4">
                            <label htmlFor="report-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('modal.saveReport.nameLabel')}</label>
                            <input
                                type="text"
                                id="report-name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400"
                                required
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 flex justify-end space-x-2">
                        <button type="button" onClick={closeSaveReportModal} className="px-4 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">{t('common.cancel')}</button>
                        <button type="submit" disabled={isSaving || !name.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:bg-slate-400 disabled:cursor-not-allowed">
                            {isSaving ? `${t('common.save')}...` : t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};