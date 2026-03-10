import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon } from '../Icons';

export const SaveReportModal: React.FC = () => {

    const { savingReportState, closeSaveReportModal, confirmSaveReport } = useContext(AppContext);
    const { t, language } = useTranslation();

    const [name, setName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    /**
     * Define nome padrão do relatório
     */
    useEffect(() => {

        if (!savingReportState) return;

        let defaultName = '';

        if (savingReportState.type === 'global') {

            defaultName =
                `${t('reports.previewTitle')} - ${new Date().toLocaleString(language)}`;

        }
        else if (savingReportState.type === 'spreadsheet') {

            defaultName =
                `${savingReportState.groupName} - ${new Date().toLocaleDateString(language)}`;

        }
        else {

            defaultName =
                `${t('reports.previewSubtitle')} - ${savingReportState.groupName} - ${new Date().toLocaleDateString(language)}`;

        }

        setName(defaultName);

    }, [savingReportState, t, language]);

    /**
     * Não renderiza se não houver estado de salvamento
     */
    if (!savingReportState) return null;

    /**
     * SUBMIT DO FORMULÁRIO
     * Agora aguardando o salvamento corretamente
     */
    const handleSubmit = async (e: React.FormEvent) => {

        e.preventDefault();

        const trimmedName = name.trim();

        if (!trimmedName || isSaving) return;

        try {

            setIsSaving(true);

            const result = await confirmSaveReport(trimmedName);

            /**
             * Se retornar ID significa que salvou corretamente
             */
            if (!result) {

                console.warn('[SaveReportModal] Salvamento não retornou ID');

            }

        }
        catch (error) {

            console.error('[SaveReportModal] Erro ao salvar relatório:', error);

        }
        finally {

            setIsSaving(false);

        }

    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">

            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">

                <form onSubmit={handleSubmit}>

                    <div className="p-8">

                        <div className="flex items-center justify-between mb-6">

                            <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
                                {t('modal.saveReport.title')}
                            </h3>

                            <button
                                type="button"
                                onClick={closeSaveReportModal}
                                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>

                        </div>

                        <div className="space-y-4">

                            <label
                                htmlFor="report-name"
                                className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                            >
                                {t('modal.saveReport.nameLabel')}
                            </label>

                            <input
                                type="text"
                                id="report-name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="block w-full rounded-2xl border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-inner focus:border-indigo-500 focus:ring-indigo-500 py-3.5 px-4 transition-all outline-none text-sm"
                                required
                                autoFocus
                            />

                        </div>

                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-[2rem] border-t border-slate-100 dark:border-slate-700/50">

                        <button
                            type="button"
                            onClick={closeSaveReportModal}
                            disabled={isSaving}
                            className="px-5 py-2.5 text-xs font-bold rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all uppercase tracking-wide disabled:opacity-50"
                        >
                            {t('common.cancel')}
                        </button>

                        <button
                            type="submit"
                            disabled={isSaving || !name.trim()}
                            className="px-6 py-2.5 text-xs font-bold text-white rounded-full shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288]"
                        >
                            {isSaving ? `${t('common.save')}...` : t('common.save')}
                        </button>

                    </div>

                </form>

            </div>

        </div>
    );
};