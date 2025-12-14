
import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { formatCurrency } from '../../utils/formatters';
import { XMarkIcon } from '../Icons';
import { Contributor, MatchResult } from '../../types';

export const ManualIdModal: React.FC = () => {
    const { 
        manualIdentificationTx, 
        churches,
        confirmManualIdentification, 
        closeManualIdentify,
        findMatchResult, // Used to find the original row
        learnAssociation,
        // For local preview updates only if needed, but main update is via confirm
        updateReportData, 
        reportPreviewData
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    const { showToast } = useUI();
    
    const [selectedChurchId, setSelectedChurchId] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (churches.length === 1) {
            setSelectedChurchId(churches[0].id);
        } else {
            setSelectedChurchId('');
        }
    }, [churches, manualIdentificationTx]);


    if (!manualIdentificationTx) return null;
    
    const handleConfirm = () => {
        if (selectedChurchId) {
            setIsSaving(true);
            
            // Find the original result from ANY source (Active or History)
            const originalResult = findMatchResult(manualIdentificationTx.id);
            const church = churches.find(c => c.id === selectedChurchId);
        
            if (!originalResult || !church) {
                // Fallback to simpler confirm if full result not found (unlikely)
                confirmManualIdentification(manualIdentificationTx.id, selectedChurchId);
                setIsSaving(false);
                return;
            }
        
            // Construct new Contributor Data
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
            
            // Learn Association
            learnAssociation(updatedRow);
            
            // Confirm & Update Data Source (Delegated to AppContext to decide where to update)
            confirmManualIdentification(manualIdentificationTx.id, selectedChurchId);
            
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-brand-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-brand-deep rounded-[2rem] shadow-2xl w-full max-w-lg border border-slate-200 dark:border-white/10">
                <div className="p-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-brand-graphite dark:text-white tracking-tight">{t('modal.manualId')}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                Transação: <span className="font-bold text-slate-700 dark:text-slate-200">{manualIdentificationTx.cleanedDescription || manualIdentificationTx.description}</span>
                                <br/>
                                Valor: <span className="font-bold text-emerald-600 dark:text-emerald-400">{manualIdentificationTx.originalAmount || formatCurrency(manualIdentificationTx.amount, language)}</span>
                            </p>
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
                         {isSaving ? `${t('common.save')}...` : t('common.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};
