

import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { formatCurrency } from '../../utils/formatters';
import { XMarkIcon, BanknotesIcon } from '../Icons';
import { Contributor, MatchResult } from '../../types';

export const ManualIdModal: React.FC = () => {
    const { 
        manualIdentificationTx, 
        bulkIdentificationTxs,
        churches,
        confirmManualIdentification, 
        confirmBulkManualIdentification,
        closeManualIdentify,
        findMatchResult,
        learnAssociation
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    
    const [selectedChurchId, setSelectedChurchId] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (churches.length === 1) {
            setSelectedChurchId(churches[0].id);
        } else {
            setSelectedChurchId('');
        }
    }, [churches, manualIdentificationTx, bulkIdentificationTxs]);


    if (!manualIdentificationTx && !bulkIdentificationTxs) return null;
    
    const handleConfirm = () => {
        if (!selectedChurchId) return;
        setIsSaving(true);

        if (bulkIdentificationTxs) {
            const ids = bulkIdentificationTxs.map(tx => tx.id);
            confirmBulkManualIdentification(ids, selectedChurchId);
        } else if (manualIdentificationTx) {
            const originalResult = findMatchResult(manualIdentificationTx.id);
            const church = churches.find(c => c.id === selectedChurchId);
        
            if (!originalResult || !church) {
                confirmManualIdentification(manualIdentificationTx.id, selectedChurchId);
            } else {
                const newContributor: Contributor = {
                    id: `manual-${manualIdentificationTx.id}`,
                    name: originalResult.transaction.cleanedDescription || originalResult.transaction.description,
                    originalAmount: originalResult.transaction.originalAmount,
                    amount: originalResult.transaction.amount,
                };
                const updatedRow: MatchResult = {
                    ...originalResult,
                    status: 'IDENTIFICADO',
                    church,
                    contributor: newContributor,
                    matchMethod: 'MANUAL',
                    similarity: 100,
                    contributorAmount: originalResult.transaction.amount,
                };
                learnAssociation(updatedRow);
                confirmManualIdentification(manualIdentificationTx.id, selectedChurchId);
            }
        }
        setIsSaving(false);
    };

    const isBulk = !!bulkIdentificationTxs;
    const count = bulkIdentificationTxs?.length || 0;
    const totalAmount = bulkIdentificationTxs?.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    return (
        <div className="fixed inset-0 bg-brand-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-brand-deep rounded-[2rem] shadow-2xl w-full max-w-lg border border-slate-200 dark:border-white/10">
                <div className="p-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-brand-graphite dark:text-white tracking-tight">
                                {isBulk ? 'Identificar em Massa' : t('modal.manualId')}
                            </h3>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                {isBulk ? (
                                    <>
                                        <div className="flex items-center gap-2 mb-1">
                                            <BanknotesIcon className="w-3.5 h-3.5 text-blue-500" />
                                            <span>Selecionadas: <span className="font-bold text-slate-700 dark:text-slate-200">{count} transações</span></span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3.5" />
                                            <span>Valor Total: <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalAmount, language)}</span></span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        Transação: <span className="font-bold text-slate-700 dark:text-slate-200">{manualIdentificationTx?.cleanedDescription || manualIdentificationTx?.description}</span>
                                        <br/>
                                        Valor: <span className="font-bold text-emerald-600 dark:text-emerald-400">{manualIdentificationTx?.originalAmount || formatCurrency(manualIdentificationTx?.amount || 0, language)}</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <button type="button" onClick={closeManualIdentify} className="p-2 rounded-full hover:bg-brand-bg dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="mt-6">
                        <label htmlFor="church-select" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                           {t('table.church')} <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="church-select"
                            value={selectedChurchId}
                            onChange={e => setSelectedChurchId(e.target.value)}
                            className="block w-full rounded-2xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-inner focus:border-brand-blue focus:ring-brand-blue py-3.5 px-4 transition-all outline-none text-sm"
                        >
                            <option value="" disabled>{churches.length > 1 ? 'Selecione a igreja destino' : 'Carregando...'}</option>
                            {churches.map(church => (
                                <option key={church.id} value={church.id}>{church.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-[2rem] border-t border-slate-100 dark:border-white/5">
                    <button type="button" onClick={closeManualIdentify} className="px-5 py-2.5 text-xs font-bold rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all uppercase tracking-wide">{t('common.cancel')}</button>
                    <button type="button" onClick={handleConfirm} disabled={!selectedChurchId || isSaving} className="px-6 py-2.5 text-xs font-bold text-white rounded-full shadow-lg shadow-blue-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288]">
                         {isSaving ? `${t('common.save')}...` : (isBulk ? 'Identificar Tudo' : t('common.save'))}
                    </button>
                </div>
            </div>
        </div>
    );
};