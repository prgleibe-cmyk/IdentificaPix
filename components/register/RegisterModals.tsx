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
        <div className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden" id="bank-modal-container">
            <form onSubmit={handleSubmit} className="flex flex-col h-full w-full" id="bank-modal-form">
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
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase" id="bank-modal-title">
                                    {t('register.bankName')}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                    Novo Cadastro de Banco
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                        <button type="button" onClick={onCancel} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors" id="btn-close-bank-modal">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 flex-1 overflow-y-auto w-full">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label htmlFor="bank-key" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1" id="lbl-bank-key">
                                    Selecionar Banco
                                </label>
                                <select 
                                    id="bank-key" 
                                    value={selectedBankKey} 
                                    onChange={(e) => setSelectedBankKey(e.target.value)} 
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-5 transition-all outline-none text-sm font-bold cursor-pointer"
                                    disabled={isSubmitting}
                                    required
                                >
                                    <option value="">Selecione o banco</option>
                                    {BANK_CATALOG.filter(b => b.active).map(b => (
                                        <option key={b.key} value={b.key}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label htmlFor="account-name" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1" id="lbl-account-name">
                                    Nome da Conta
                                </label>
                                <input 
                                    type="text" 
                                    id="account-name" 
                                    value={accountName} 
                                    onChange={(e) => setAccountName(e.target.value)} 
                                    className={`block w-full rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 py-4 px-5 outline-none transition-all text-sm font-bold ${isDuplicate ? 'border border-rose-500 focus:ring-rose-500/10' : 'border border-slate-200 dark:border-slate-700 focus:ring-brand-blue/10'}`} 
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
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800/50 mt-auto" id="bank-modal-actions">
                    <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-6 py-3 rounded-full text-xs font-bold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase disabled:opacity-50 tracking-wide" id="btn-cancel-bank">{t('common.cancel')}</button>
                    <button 
                        type="submit" 
                        disabled={isSubmitting || !selectedBankKey || !accountName.trim() || isDuplicate} 
                        className="px-8 py-3 rounded-full shadow-lg shadow-emerald-500/30 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:bg-emerald-700 transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 tracking-wide"
                        id="btn-save-bank"
                    >
                        {isSubmitting ? 'Salvando...' : t('common.save')}
                    </button>
                </div>
            </form>
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
        <div className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden">
            <form onSubmit={handleSubmit} className="flex flex-col h-full w-full">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-row flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-brand-blue text-white shadow-lg shadow-blue-500/20">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                    {t('register.churchName')}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                    Novo Cadastro de Congregação
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                        <button type="button" onClick={onCancel} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 flex-1 overflow-y-auto w-full">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label htmlFor="church-name" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    {t('register.churchName')}
                                </label>
                                <input 
                                    type="text" 
                                    id="church-name" 
                                    value={data.name} 
                                    onChange={e => setData(d => ({...d, name: e.target.value}))} 
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-5 transition-all outline-none text-sm font-bold" 
                                    placeholder="Ex: Comunidade da Graça" 
                                    required 
                                    disabled={isSubmitting} 
                                />
                            </div>

                            <div className="space-y-3">
                                <label htmlFor="church-address" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    {t('register.address')}
                                </label>
                                <input 
                                    type="text" 
                                    id="church-address" 
                                    value={data.address} 
                                    onChange={e => setData(d => ({...d, address: e.target.value}))} 
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-5 transition-all outline-none text-sm font-bold" 
                                    placeholder="Ex: Av. da Paz, 456" 
                                    disabled={isSubmitting} 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label htmlFor="church-pastor" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    {t('register.pastor')}
                                </label>
                                <input 
                                    type="text" 
                                    id="church-pastor" 
                                    value={data.pastor} 
                                    onChange={e => setData(d => ({...d, pastor: e.target.value}))} 
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-5 transition-all outline-none text-sm font-bold" 
                                    placeholder="Ex: Pr. Maria Oliveira" 
                                    disabled={isSubmitting} 
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    {t('register.logo')}
                                </label>
                                <div className="flex items-center space-x-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <img src={data.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'} alt="Preview" className="w-16 h-16 rounded-xl object-cover bg-white shadow-sm border border-slate-100" />
                                    <label className={`cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm uppercase tracking-wide ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <span>Escolher arquivo</span>
                                        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} className="hidden" disabled={isSubmitting} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800/50 mt-auto">
                    <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-6 py-3 rounded-full text-xs font-bold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase disabled:opacity-50 tracking-wide">{t('common.cancel')}</button>
                    <button type="submit" disabled={isSubmitting || !data.name.trim()} className="px-8 py-3 rounded-full shadow-lg shadow-emerald-500/30 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:bg-emerald-700 transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 tracking-wide">
                        {isSubmitting ? 'Salvando...' : t('common.save')}
                    </button>
                </div>
            </form>
        </div>
    );
};