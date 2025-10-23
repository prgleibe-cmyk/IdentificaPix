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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('modal.confirmDelete.title')}</h3>
                        <button type="button" onClick={closeDeleteConfirmation} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="mt-4 flex items-start space-x-4">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                           <p>{message}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 flex justify-end space-x-2">
                    <button type="button" onClick={closeDeleteConfirmation} className="px-4 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">{t('common.cancel')}</button>
                    <button type="button" onClick={confirmDeletion} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md">{t('common.delete')}</button>
                </div>
            </div>
        </div>
    );
};