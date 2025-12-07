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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 transform transition-all scale-100">
                <form onSubmit={handleSubmit}>
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">{t('modal.editBank')}</h3>
                            <button type="button" onClick={closeEditBank} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <label htmlFor="edit-bank-name" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('register.bankName')}</label>
                            <input
                                type="text"
                                id="edit-bank-name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 transition-all"
                                required
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-2xl border-t border-slate-100 dark:border-slate-700/50">
                        <button type="button" onClick={closeEditBank} className="px-5 py-2.5 text-sm font-bold rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all">{t('common.cancel')}</button>
                        <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 transition-all">{t('common.save')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};