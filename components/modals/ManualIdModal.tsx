import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { XMarkIcon } from '../Icons';

export const ManualIdModal: React.FC = () => {
    const { 
        manualIdentificationTx, 
        churches,
        confirmManualIdentification, 
        closeManualIdentify 
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
    }, [churches, manualIdentificationTx]);


    if (!manualIdentificationTx) return null;
    
    const handleConfirm = () => {
        if (selectedChurchId) {
            setIsSaving(true);
            // The logic in context is synchronous for state updates,
            // but we show feedback for perceived performance.
            try {
                confirmManualIdentification(manualIdentificationTx.id, selectedChurchId);
            } catch (e) {
                console.error(e); // Context handles error toast
            } finally {
                setIsSaving(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('modal.manualId')}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {manualIdentificationTx.cleanedDescription || manualIdentificationTx.description} - <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(manualIdentificationTx.amount, language)}</span>
                            </p>
                        </div>
                        <button type="button" onClick={closeManualIdentify} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                    
                    <div className="mt-6">
                        <label htmlFor="church-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                           {t('table.church')} <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="church-select"
                            value={selectedChurchId}
                            onChange={e => setSelectedChurchId(e.target.value)}
                            className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm"
                        >
                            <option value="" disabled>{churches.length > 1 ? 'Selecione a igreja' : 'Carregando...'}</option>
                            {churches.map(church => (
                                <option key={church.id} value={church.id}>{church.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 flex justify-end space-x-2">
                    <button type="button" onClick={closeManualIdentify} className="px-4 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">{t('common.cancel')}</button>
                    <button type="button" onClick={handleConfirm} disabled={!selectedChurchId || isSaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:bg-slate-400 disabled:cursor-not-allowed">
                         {isSaving ? `${t('common.save')}...` : t('common.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};
