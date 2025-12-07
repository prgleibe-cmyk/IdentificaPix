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
        reportPreviewData,
        updateReportData,
        learnAssociation
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
            
            const unidentifiedResults = reportPreviewData?.income['unidentified'] || [];
            const originalResult = unidentifiedResults.find(r => r.transaction.id === manualIdentificationTx.id);
            const church = churches.find(c => c.id === selectedChurchId);
        
            if (!originalResult || !church) {
                confirmManualIdentification(manualIdentificationTx.id, selectedChurchId);
                setIsSaving(false);
                return;
            }
        
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
            
            updateReportData(updatedRow, 'income');
            learnAssociation(updatedRow);
        
            showToast('Identificação salva e relatório da igreja atualizado com sucesso!', 'success');
            
            closeManualIdentify();
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700">
                <div className="p-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">{t('modal.manualId')}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                Transação: <span className="font-bold text-slate-700 dark:text-slate-200">{manualIdentificationTx.cleanedDescription || manualIdentificationTx.description}</span>
                                <br/>
                                Valor: <span className="font-bold text-green-600 dark:text-green-400">{manualIdentificationTx.originalAmount || formatCurrency(manualIdentificationTx.amount, language)}</span>
                            </p>
                        </div>
                        <button type="button" onClick={closeManualIdentify} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
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
                            className="block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 transition-all"
                        >
                            <option value="" disabled>{churches.length > 1 ? 'Selecione a igreja destino' : 'Carregando...'}</option>
                            {churches.map(church => (
                                <option key={church.id} value={church.id}>{church.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-2xl border-t border-slate-100 dark:border-slate-700/50">
                    <button type="button" onClick={closeManualIdentify} className="px-5 py-2.5 text-sm font-bold rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all">{t('common.cancel')}</button>
                    <button type="button" onClick={handleConfirm} disabled={!selectedChurchId || isSaving} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                         {isSaving ? `${t('common.save')}...` : t('common.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};