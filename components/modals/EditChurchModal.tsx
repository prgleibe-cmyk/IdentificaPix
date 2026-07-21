

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
        <div className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden">
            <form onSubmit={handleSubmit} className="flex flex-col h-full w-full">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-row flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                    {t('modal.editChurch')}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                    Editar Cadastro de Congregação
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                        <button type="button" onClick={closeEditChurch} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 flex-1 overflow-y-auto w-full">
                    <div className="space-y-6 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label htmlFor="name" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    {t('register.churchName')}
                                </label>
                                <input type="text" id="name" value={formData.name} onChange={handleChange} className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-4 px-5 transition-all outline-none text-sm font-bold" required />
                            </div>
                            <div className="space-y-3">
                                <label htmlFor="address" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    {t('register.address')}
                                </label>
                                <input type="text" id="address" value={formData.address} onChange={handleChange} className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-4 px-5 transition-all outline-none text-sm font-bold" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label htmlFor="pastor" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    {t('register.pastor')}
                                </label>
                                <input type="text" id="pastor" value={formData.pastor} onChange={handleChange} className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-4 px-5 transition-all outline-none text-sm font-bold" />
                            </div>
                            <div className="space-y-3">
                                <label htmlFor="edit-church-logo-upload" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    {t('register.logo')}
                                </label>
                                <div className="mt-1 flex items-center space-x-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <img 
                                        src={formData.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'} 
                                        alt="Pré-visualização" 
                                        className="w-16 h-16 rounded-xl object-cover bg-white shadow-sm border border-slate-100" 
                                    />
                                    <label className="cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm uppercase tracking-wide">
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
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800/50 mt-auto">
                    <button type="button" onClick={closeEditChurch} className="px-6 py-3 rounded-full text-xs font-bold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase tracking-wide">{t('common.cancel')}</button>
                    <button type="submit" className="px-8 py-3 rounded-full shadow-lg shadow-emerald-500/30 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 transition-all uppercase tracking-wide">{t('common.save')}</button>
                </div>
            </form>
        </div>
    );
};