
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
            setName(editingBank.name);
        }
    }, [editingBank]);

    if (!editingBank) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateBank(editingBank.id, name);
    };

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal w-full max-w-md animate-scale-in">
                <form onSubmit={handleSubmit}>
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-brand-graphite dark:text-white tracking-tight">{t('modal.editBank')}</h3>
                            <button type="button" onClick={closeEditBank} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <label htmlFor="edit-bank-name" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">{t('register.bankName')}</label>
                            <input
                                type="text"
                                id="edit-bank-name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="block w-full rounded-2xl border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-brand-graphite dark:text-white shadow-inner focus:border-brand-blue focus:ring-brand-blue py-4 px-5 transition-all outline-none text-sm font-medium"
                                required
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="bg-slate-50/50 dark:bg-slate-900/30 px-8 py-6 flex justify-end space-x-3 border-t border-slate-100 dark:border-white/5 backdrop-blur-sm">
                        <button type="button" onClick={closeEditBank} className="px-6 py-3 text-xs font-bold rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all uppercase tracking-wide">{t('common.cancel')}</button>
                        <button type="submit" className="px-8 py-3 text-xs font-bold text-white rounded-full shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 transition-all uppercase tracking-wide bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400">{t('common.save')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
