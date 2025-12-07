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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('modal.editBank')}</h3>
                            <button type="button" onClick={closeEditBank} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="mt-4">
                            <label htmlFor="edit-bank-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.bankName')}</label>
                            <input
                                type="text"
                                id="edit-bank-name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400"
                                required
                            />
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 flex justify-end space-x-2">
                        <button type="button" onClick={closeEditBank} className="px-4 py-2 text-sm font-medium rounded-md border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white transition-colors">{t('common.cancel')}</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md">{t('common.save')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
