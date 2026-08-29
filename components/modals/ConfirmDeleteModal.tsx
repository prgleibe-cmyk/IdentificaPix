
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
            case 'report-row-bulk':
                return (t('modal.confirmDelete.report-row-bulk.message') || 'Tem certeza que deseja excluir permanentemente as {count} linhas selecionadas do relatório?').replace('{count}', String(deletingItem.meta?.ids?.length || 0));
            default:
                return t('modal.confirmDelete.message').replace('{itemName}', deletingItem.name);
        }
    };

    const message = getMessage();

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-scale-in my-auto">
                <div className="p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white tracking-tight">{t('modal.confirmDelete.title')}</h3>
                        <button type="button" onClick={closeDeleteConfirmation} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200/60 dark:border-red-800/60">
                            <ExclamationTriangleIcon className="h-6 w-6 sm:h-7 sm:w-7 text-red-600 dark:text-red-400" aria-hidden="true" />
                        </div>
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-300 pt-1">
                           <p className="leading-relaxed">{message}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/80 px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-end gap-3 rounded-b-3xl border-t border-slate-100 dark:border-slate-800">
                    <button 
                        type="button" 
                        onClick={closeDeleteConfirmation} 
                        className="px-5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs transition-all uppercase tracking-wide cursor-pointer active:scale-95"
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={confirmDeletion} 
                        className="px-6 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl shadow-lg shadow-red-500/25 hover:-translate-y-0.5 transition-all uppercase tracking-wide cursor-pointer active:scale-95 flex items-center gap-1.5"
                    >
                        {t('common.delete')}
                    </button>
                </div>
            </div>
        </div>
    );
};
