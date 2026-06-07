import React, { useState, useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon } from '../Icons';
import { ChurchFormData } from '../../types';
import { BANK_CATALOG } from '../../constants/bankCatalog';

export const BankModal: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { addBank, banks } = useContext(AppContext);
    const { t } = useTranslation();
    const [accountName, setAccountName] = useState('');
    const [selectedBankKey, setSelectedBankKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isDuplicate = !!(selectedBankKey && accountName.trim() && banks && banks.some((b: any) => {
        const bKey = b.bank_key || null;
        const bAccName = (b.account_name || b.name || '').trim().toLowerCase();
        return bKey === selectedBankKey && bAccName === accountName.trim().toLowerCase();
    }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!selectedBankKey || !accountName.trim() || isDuplicate) return;
        
        setIsSubmitting(true);
        try {
            const success = await addBank({
                bank_key: selectedBankKey,
                name: accountName.trim(), // compatibilidade visual
                account_name: accountName.trim()
            });
            if (success) {
                setAccountName('');
                setSelectedBankKey('');
                onCancel();
            }
        } catch (error) {
            console.error("Erro ao adicionar banco:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-brand-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" id="bank-modal-container">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 transform transition-all scale-100 flex flex-col max-h-[90vh]" id="bank-modal-content">
                <form onSubmit={handleSubmit} className="flex flex-col h-full" id="bank-modal-form">
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-brand-graphite dark:text-white tracking-tight" id="bank-modal-title">{t('register.bankName')}</h3>
                            <button type="button" onClick={onCancel} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" id="btn-close-bank-modal">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label htmlFor="bank-key" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 ml-1" id="lbl-bank-key">Selecionar Banco</label>
                                <select 
                                    id="bank-key" 
                                    value={selectedBankKey} 
                                    onChange={(e) => setSelectedBankKey(e.target.value)} 
                                    className="block w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all cursor-pointer"
                                    disabled={isSubmitting}
                                    required
                                >
                                    <option value="">Selecione o banco</option>
                                    {BANK_CATALOG.filter(b => b.active).map(b => (
                                        <option key={b.key} value={b.key}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="account-name" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 ml-1" id="lbl-account-name">Nome da Conta</label>
                                <input 
                                    type="text" 
                                    id="account-name" 
                                    value={accountName} 
                                    onChange={(e) => setAccountName(e.target.value)} 
                                    className={`block w-full rounded-2xl bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner text-sm p-3.5 outline-none transition-all ${isDuplicate ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-brand-blue'}`} 
                                    placeholder="Ex: Conta Principal, Dízimos, Ofertas..." 
                                    required 
                                    disabled={isSubmitting}
                                />
                                {isDuplicate && (
                                    <p className="text-rose-500 text-xs font-semibold mt-2 ml-1 animate-fade-in" id="dup-warning">
                                        Já existe uma conta com esse nome neste banco
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-[2rem] border-t border-slate-100 dark:border-slate-700/50 mt-auto" id="bank-modal-actions">
                        <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase disabled:opacity-50 tracking-wide" id="btn-cancel-bank">{t('common.cancel')}</button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting || !selectedBankKey || !accountName.trim() || isDuplicate} 
                            className="px-6 py-2.5 rounded-full shadow-lg shadow-emerald-500/30 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:bg-emerald-700 transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 tracking-wide"
                            id="btn-save-bank"
                        >
                            {isSubmitting ? 'Salvando...' : t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const ChurchModal: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { addChurch } = useContext(AppContext);
    const { t } = useTranslation();
    const [data, setData] = useState<ChurchFormData>({ name: '', address: '', pastor: '', logoUrl: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data.name.trim()) return;
        setIsSubmitting(true);
        const success = await addChurch(data);
        setIsSubmitting(false);
        if (success) {
            setData({ name: '', address: '', pastor: '', logoUrl: '' });
            onCancel();
        }
    };
    
    const handleLogoUpload = (file: File) => {
         if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setData(d => ({...d, logoUrl: e.target?.result as string}));
            reader.readAsDataURL(file);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-brand-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 transform transition-all scale-100 flex flex-col max-h-[90vh]">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-brand-graphite dark:text-white tracking-tight">{t('register.churchName')}</h3>
                            <button type="button" onClick={onCancel} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                             <div>
                                <label htmlFor="church-name" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{t('register.churchName')}</label>
                                <input type="text" id="church-name" value={data.name} onChange={e => setData(d => ({...d, name: e.target.value}))} className="block w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all" placeholder="Ex: Comunidade da Graça" required disabled={isSubmitting} />
                            </div>
                             <div>
                                <label htmlFor="church-address" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{t('register.address')}</label>
                                <input type="text" id="church-address" value={data.address} onChange={e => setData(d => ({...d, address: e.target.value}))} className="block w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all" placeholder="Ex: Av. da Paz, 456" disabled={isSubmitting} />
                            </div>
                            <div>
                                <label htmlFor="church-pastor" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{t('register.pastor')}</label>
                                <input type="text" id="church-pastor" value={data.pastor} onChange={e => setData(d => ({...d, pastor: e.target.value}))} className="block w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all" placeholder="Ex: Pr. Maria Oliveira" disabled={isSubmitting} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 ml-1">{t('register.logo')}</label>
                                <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <img src={data.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'} alt="Preview" className="w-12 h-12 rounded-xl object-cover bg-white shadow-sm" />
                                    <label className={`cursor-pointer bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <span>Escolher arquivo</span>
                                        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} className="hidden" disabled={isSubmitting} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-[2rem] border-t border-slate-100 dark:border-slate-700/50 mt-auto">
                        <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase disabled:opacity-50 tracking-wide">{t('common.cancel')}</button>
                        <button type="submit" disabled={isSubmitting || !data.name.trim()} className="px-6 py-2.5 rounded-full shadow-lg shadow-emerald-500/30 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:bg-emerald-700 transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 tracking-wide">
                            {isSubmitting ? 'Salvando...' : t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};