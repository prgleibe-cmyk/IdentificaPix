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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('modal.editChurch')}</h3>
                            <button type="button" onClick={closeEditChurch} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="mt-4 space-y-4">
                            {/* Form Fields */}
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.churchName')}</label>
                                <input type="text" id="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" required />
                            </div>
                            <div>
                                <label htmlFor="address" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.address')}</label>
                                <input type="text" id="address" value={formData.address} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" required />
                            </div>
                            <div>
                                <label htmlFor="pastor" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.pastor')}</label>
                                <input type="text" id="pastor" value={formData.pastor} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" required />
                            </div>
                             <div>
                                <label htmlFor="edit-church-logo-upload" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.logo')}</label>
                                <div className="mt-1 flex items-center space-x-4">
                                    <img 
                                        src={formData.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'} 
                                        alt="Pré-visualização do logo" 
                                        className="w-16 h-16 rounded-md object-cover bg-slate-200" 
                                    />
                                    <input 
                                        type="file" 
                                        id="edit-church-logo-upload" 
                                        accept="image/*"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                handleLogoUpload(e.target.files[0]);
                                            }
                                        }}
                                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-700 dark:file:text-blue-300 dark:hover:file:bg-slate-600"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 flex justify-end space-x-2">
                        <button type="button" onClick={closeEditChurch} className="px-4 py-2 text-sm font-medium rounded-md border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white transition-colors">{t('common.cancel')}</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md">{t('common.save')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
