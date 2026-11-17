
import React, { useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, ExclamationTriangleIcon } from '../Icons';

export const ConfirmDeleteModal: React.FC = () => {
    const { deletingItem, closeDeleteConfirmation, confirmDeletion } = useContext(AppContext);
    const { t } = useTranslation();

    useEffect(() => {
        if (!deletingItem) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeDeleteConfirmation();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [deletingItem, closeDeleteConfirmation]);

    if (!deletingItem) return null;

    const getMessage = () => {
        if (deletingItem.meta?.message) {
            return deletingItem.meta.message;
        }
        switch (deletingItem.type) {
            case 'payment-method':
                return `Tem certeza que deseja excluir a forma "${deletingItem.name}"?`;
            case 'contribution-type':
                return `Tem certeza que deseja excluir a descrição "${deletingItem.name}"?`;
            case 'contributor-inactivate':
                return `Tem certeza que deseja inativar o contribuinte "${deletingItem.name}"?`;
            case 'contributor-permanent':
                return `ATENÇÃO: Você deseja EXCLUIR DEFINITIVAMENTE o cadastro do contribuinte "${deletingItem.name}"? Esta ação é irreversível e removerá permanentemente o cadastro do banco de dados.`;
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
    const modalTitle = deletingItem.meta?.title || t('modal.confirmDelete.title');
    const confirmLabel = deletingItem.meta?.confirmLabel || t('common.delete');

    return (
        <div
            data-register-overlay="true"
            className="fixed inset-0 z-[90] bg-slate-900/55 dark:bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in"
            onClick={(e) => {
                e.stopPropagation();
                closeDeleteConfirmation();
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden animate-scale-in my-auto"
            >
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">{modalTitle}</h3>
                    <button
                        type="button"
                        onClick={closeDeleteConfirmation}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        aria-label="Fechar"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 flex items-start gap-3.5">
                    <div className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/70 dark:border-rose-800/60">
                        <ExclamationTriangleIcon className="h-5 w-5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 pt-0.5">
                        <p className="leading-relaxed">{message}</p>
                    </div>
                </div>
                <div className="bg-slate-50/80 dark:bg-slate-900/70 px-5 py-3.5 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={closeDeleteConfirmation}
                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors cursor-pointer"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={confirmDeletion}
                        className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
