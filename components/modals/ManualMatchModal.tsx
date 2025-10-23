import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { XMarkIcon, CheckCircleIcon, SearchIcon } from '../Icons';
import { filterTransactionByUniversalQuery } from '../../services/processingService';

export const ManualMatchModal: React.FC = () => {
    const { manualMatchState, closeManualMatchModal, confirmManualAssociation } = useContext(AppContext);
    const { t, language } = useTranslation();
    const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    if (!manualMatchState) return null;

    const { record, suggestions } = manualMatchState;

    const filteredSuggestions = useMemo(() => {
        if (!searchQuery.trim()) return suggestions;
        return suggestions.filter(tx => filterTransactionByUniversalQuery(tx, searchQuery));
    }, [searchQuery, suggestions]);


    const handleConfirm = () => {
        if (selectedTxId) {
            // Find in the original list to ensure we have the correct transaction
            const selectedTx = suggestions.find(s => s.id === selectedTxId);
            if (selectedTx) {
                confirmManualAssociation(selectedTx);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Associar Contribuição Manualmente</h3>
                        <button type="button" onClick={closeManualMatchModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Contributor Info */}
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border dark:border-slate-600">
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Registro da Igreja a ser associado:</h4>
                            <div className="space-y-2 text-sm">
                                <div><span className="font-medium text-slate-500 dark:text-slate-400">Contribuinte:</span> <span className="font-bold text-slate-900 dark:text-slate-100">{record.contributor?.cleanedName || record.contributor?.name}</span></div>
                                <div><span className="font-medium text-slate-500 dark:text-slate-400">Valor:</span> <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(record.contributor?.amount || 0, language)}</span></div>
                                <div><span className="font-medium text-slate-500 dark:text-slate-400">Data:</span> <span className="font-bold text-slate-900 dark:text-slate-100">{record.contributor?.date}</span></div>
                            </div>
                        </div>

                        {/* Suggestions List */}
                        <div>
                             <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Sugestões do Extrato Bancário:</h4>
                             <div className="relative mb-2">
                                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar nas sugestões..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-10 p-2 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400"
                                />
                            </div>
                             <div className="border rounded-md dark:border-slate-700 max-h-60 overflow-y-auto">
                                {filteredSuggestions.length > 0 ? (
                                    <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {filteredSuggestions.map(tx => (
                                            <li
                                                key={tx.id}
                                                onClick={() => setSelectedTxId(tx.id)}
                                                className={`p-3 cursor-pointer flex items-start space-x-3 transition-colors ${selectedTxId === tx.id ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                            >
                                                <div className="flex-shrink-0 mt-1">
                                                     {selectedTxId === tx.id ? <CheckCircleIcon className="w-5 h-5 text-blue-600" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800"></div>}
                                                </div>
                                                <div className="flex-1 text-sm">
                                                    <p className="font-medium text-slate-800 dark:text-slate-200">{tx.cleanedDescription || tx.description}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{tx.date} • <span className="font-semibold">{formatCurrency(tx.amount, language)}</span></p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                        {suggestions.length > 0 ? 'Nenhuma sugestão encontrada para sua busca.' : 'Nenhuma transação não identificada encontrada no extrato com o mesmo valor e data próxima.'}
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 flex justify-end space-x-2">
                    <button type="button" onClick={closeManualMatchModal} className="px-4 py-2 text-sm font-medium rounded-md border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white transition-colors">{t('common.cancel')}</button>
                    <button type="button" onClick={handleConfirm} disabled={!selectedTxId} className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:bg-slate-400 disabled:cursor-not-allowed">Confirmar Associação</button>
                </div>
            </div>
        </div>
    );
};