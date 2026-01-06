
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, ExclamationTriangleIcon } from '../Icons';

export const ConfirmDeleteModal: React.FC = () => {
    const { deletingItem, closeDeleteConfirmation, confirmDeletion } = useContext(AppContext);
    const { t } = useTranslation();

    if (!deletingItem) return null;

    const getMessage = () => {
        switch (deletingItem.type) {
            case 'all-data':
                return t('settings.confirmDelete.all-data.message');
            case 'uploaded-files':
                return t('settings.confirmDelete.uploaded-files.message');
            case 'match-results':
                return t('settings.confirmDelete.match-results.message');
            case 'learned-associations':
                return t('settings.confirmDelete.learned-associations.message');
            case 'report-saved':
                return t('settings.confirmDelete.report-saved.message').replace('{itemName}', deletingItem.name);
            case 'report-row':
                return t('modal.confirmDelete.report-row.message');
            default:
                return t('modal.confirmDelete.message').replace('{itemName}', deletingItem.name);
        }
    };

    const message = getMessage();

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
                <div className="p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">{t('modal.confirmDelete.title')}</h3>
                        <button type="button" onClick={closeDeleteConfirmation} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex items-start space-x-5">
                        <div className="flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-2xl bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800">
                            <ExclamationTriangleIcon className="h-7 w-7 text-red-600 dark:text-red-400" aria-hidden="true" />
                        </div>
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-300 pt-1">
                           <p className="leading-relaxed">{message}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-3xl border-t border-slate-100 dark:border-slate-700/50">
                    <button type="button" onClick={closeDeleteConfirmation} className="px-5 py-2.5 text-xs font-bold rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all uppercase tracking-wide">{t('common.cancel')}</button>
                    <button type="button" onClick={confirmDeletion} className="px-6 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-full shadow-lg shadow-red-500/30 hover:-translate-y-0.5 transition-all uppercase tracking-wide">{t('common.delete')}</button>
                </div>
            </div>
        </div>
    );
};
