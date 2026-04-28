
import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { XMarkIcon, SparklesIcon, CheckBadgeIcon, BuildingOfficeIcon, ChevronDownIcon } from '../Icons';
import { Contributor, MatchResult, ReconciliationStatus, MatchMethod } from '../../types';

export const ManualIdModal: React.FC = () => {
    const { 
        bulkIdentificationTxs,
        churches,
        confirmBulkManualIdentification,
        closeManualIdentify,
        findMatchResult,
        contributionKeywords,
        paymentMethods
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    
    const [selectedChurchId, setSelectedChurchId] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>(contributionKeywords?.[0] || 'Dízimo');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(paymentMethods?.[0] || 'Transferência');
    const [isSaving, setIsSaving] = useState(false);

    const isBulk = !!bulkIdentificationTxs && bulkIdentificationTxs.length > 0;

    // --- ATALHOS DE TECLADO ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeManualIdentify();
            if (e.key === 'Enter' && selectedChurchId && !isSaving) handleConfirm();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeManualIdentify, selectedChurchId, isSaving]);

    useEffect(() => {
        if (churches.length === 1) {
            setSelectedChurchId(churches[0].id);
        } else {
            setSelectedChurchId('');
        }
        
    }, [churches, isBulk]);

    if (!isBulk) return null;
    
    const handleConfirm = async () => {
        if (!selectedChurchId) return;
        setIsSaving(true);

        try {
            if (isBulk) {
                const ids = bulkIdentificationTxs.map(tx => tx.id);
                await confirmBulkManualIdentification(ids, selectedChurchId, selectedType, selectedPaymentMethod);
            }
        } catch (error) {
            console.error("[ManualIdModal] Error confirming identification:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const count = bulkIdentificationTxs?.length || 0;
    const totalAmount = bulkIdentificationTxs?.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal w-full max-w-lg flex flex-col animate-scale-in rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-white/10 bg-white dark:bg-[#0F172A]">
                
                <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${isBulk ? 'bg-blue-600 text-white shadow-lg' : 'bg-brand-blue text-white shadow-lg shadow-blue-500/20'}`}>
                            {isBulk ? <CheckBadgeIcon className="w-6 h-6" /> : <BuildingOfficeIcon className="w-6 h-6" />}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                {isBulk ? 'Destinar Lote' : 'Escolher Destino'}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Identificação Pendente</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[7px] font-black text-slate-400 uppercase border border-slate-200 dark:border-slate-800 px-1 rounded">Esc</span>
                        <button type="button" onClick={closeManualIdentify} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Registros Selecionados</span>
                                <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{count} <span className="text-xs font-medium text-slate-400">ítens</span></span>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block mb-1">Montante do Lote</span>
                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(totalAmount, language)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                           Escolha a Igreja de Destino
                        </label>
                        <div className="relative group">
                            <BuildingOfficeIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                            <select
                                value={selectedChurchId}
                                onChange={e => setSelectedChurchId(e.target.value)}
                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 pl-12 pr-10 transition-all outline-none text-sm font-bold appearance-none"
                            >
                                <option value="">-- Clique para ver as igrejas --</option>
                                {churches.map(church => (
                                    <option key={church.id} value={church.id}>
                                        {church.name}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDownIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                Tipo
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedType}
                                    onChange={e => setSelectedType(e.target.value)}
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-4 transition-all outline-none text-sm font-bold appearance-none"
                                >
                                    {contributionKeywords.map((type: string) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDownIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                Forma
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedPaymentMethod}
                                    onChange={e => setSelectedPaymentMethod(e.target.value)}
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-4 transition-all outline-none text-sm font-bold appearance-none"
                                >
                                    {paymentMethods.map((method: string) => (
                                        <option key={method} value={method}>{method}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDownIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3 rounded-b-[2.5rem]">
                    <button 
                        type="button" 
                        onClick={closeManualIdentify} 
                        className="px-6 py-3 text-[10px] font-black rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all uppercase tracking-widest"
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleConfirm} 
                        disabled={!selectedChurchId || isSaving} 
                        className="px-10 py-3 text-[10px] font-black text-white rounded-full shadow-xl shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] flex items-center gap-2"
                    >
                         {isSaving ? 'Processando...' : 'Confirmar Lote'}
                         {!isSaving && selectedChurchId && <span className="ml-1 text-[8px] opacity-70 bg-white/20 px-1 rounded">Enter</span>}
                    </button>
                </div>
            </div>
        </div>
    );
};
