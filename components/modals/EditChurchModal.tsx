import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { ChurchFormData } from '../../types';
import { XMarkIcon } from '../Icons';

export const EditChurchModal: React.FC = () => {
    const { editingChurch, updateChurch, closeEditChurch } = useContext(AppContext);
    const { t } = useTranslation();
    const [formData, setFormData] = useState<ChurchFormData>({ name: '', address: '', pastor: '', logoUrl: '' });

    useEffect(() => {
        if (editingChurch) {
            setFormData({
                name: editingChurch.name,
                address: editingChurch.address,
                pastor: editingChurch.pastor,
                logoUrl: editingChurch.logoUrl
            });
        }
    }, [editingChurch]);

    if (!editingChurch) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id.replace('edit-church-', '')]: value }));
    };

    const handleLogoUpload = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                setFormData(d => ({ ...d, logoUrl: result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateChurch(editingChurch.id, formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">{t('modal.editChurch')}</h3>
                            <button type="button" onClick={closeEditChurch} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-5">
                            {/* Form Fields */}
                            <div>
                                <label htmlFor="name" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('register.churchName')}</label>
                                <input type="text" id="name" value={formData.name} onChange={handleChange} className="block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 transition-all" required />
                            </div>
                            <div>
                                <label htmlFor="address" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('register.address')}</label>
                                <input type="text" id="address" value={formData.address} onChange={handleChange} className="block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 transition-all" />
                            </div>
                            <div>
                                <label htmlFor="pastor" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('register.pastor')}</label>
                                <input type="text" id="pastor" value={formData.pastor} onChange={handleChange} className="block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 transition-all" />
                            </div>
                             <div>
                                <label htmlFor="edit-church-logo-upload" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('register.logo')}</label>
                                <div className="mt-1 flex items-center space-x-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 border-dashed">
                                    <img 
                                        src={formData.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'} 
                                        alt="Pré-visualização" 
                                        className="w-16 h-16 rounded-xl object-cover bg-white shadow-sm" 
                                    />
                                    <label className="cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                                        <span>Alterar Logo</span>
                                        <input 
                                            type="file" 
                                            id="edit-church-logo-upload" 
                                            accept="image/*"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    handleLogoUpload(e.target.files[0]);
                                                }
                                            }}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-2xl border-t border-slate-100 dark:border-slate-700/50 mt-auto">
                        <button type="button" onClick={closeEditChurch} className="px-5 py-2.5 text-sm font-bold rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all">{t('common.cancel')}</button>
                        <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 transition-all">{t('common.save')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};