
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
            } else if (savingReportState.type === 'spreadsheet') {
                defaultName = `${savingReportState.groupName} - ${new Date().toLocaleDateString(language)}`;
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
        }
    };

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal animate-scale-in">
                <form onSubmit={handleSubmit}>
                    <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{t('modal.saveReport.title')}</h3>
                        <button type="button" onClick={closeSaveReportModal} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6 space-y-2">
                        <label htmlFor="report-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300">{t('modal.saveReport.nameLabel')}</label>
                        <input
                            type="text"
                            id="report-name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 py-2.5 px-3 transition-colors outline-none text-sm font-medium"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="bg-slate-50/70 dark:bg-slate-900 px-6 py-4 flex justify-end space-x-2.5 rounded-b-2xl border-t border-slate-200/80 dark:border-slate-800">
                        <button type="button" onClick={closeSaveReportModal} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer">{t('common.cancel')}</button>
                        <button type="submit" disabled={isSaving || !name.trim()} className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                            {isSaving ? `${t('common.save')}...` : t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};