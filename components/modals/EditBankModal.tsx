

import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon } from '../Icons';

export const EditBankModal: React.FC = () => {
    const { editingBank, updateBank, closeEditBank } = useContext(AppContext);
    const { t } = useTranslation();
    const [name, setName] = useState('');

    useEffect(() => {
        if (editingBank) {
            setName(editingBank.account_name ?? editingBank.name);
        }
    }, [editingBank]);

    if (!editingBank) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateBank(editingBank.id, name);
    };

    return (
        <div className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden">
            <form onSubmit={handleSubmit} className="flex flex-col h-full w-full">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-row flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-brand-blue text-white shadow-lg shadow-blue-500/20">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                    {t('modal.editBank')}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                    Editar Cadastro de Banco
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                        <button type="button" onClick={closeEditBank} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 flex-1 overflow-y-auto w-full">
                    <div className="space-y-6 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label htmlFor="edit-bank-name" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    {t('register.bankName')}
                                </label>
                                <input
                                    type="text"
                                    id="edit-bank-name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-5 transition-all outline-none text-sm font-bold"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800/50 mt-auto">
                    <button type="button" onClick={closeEditBank} className="px-6 py-3 rounded-full text-xs font-bold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase tracking-wide">{t('common.cancel')}</button>
                    <button type="submit" className="px-8 py-3 rounded-full shadow-lg shadow-emerald-500/30 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 transition-all uppercase tracking-wide">{t('common.save')}</button>
                </div>
            </form>
        </div>
    );
};