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
            const selectedTx = suggestions.find(s => s.id === selectedTxId);
            if (selectedTx) {
                confirmManualAssociation(selectedTx);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]">
                <div className="p-8 flex-1 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-6 flex-shrink-0">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Associar Contribuição</h3>
                        <button type="button" onClick={closeManualMatchModal} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
                        {/* Contributor Info */}
                        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">Registro da Igreja</h4>
                            <div className="space-y-4 flex-1">
                                <div>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Contribuinte</p>
                                    <p className="text-lg font-bold text-slate-800 dark:text-white leading-tight">{record.contributor?.cleanedName || record.contributor?.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Valor Esperado</p>
                                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(record.contributor?.amount || 0, language)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Data na Lista</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 w-fit">{record.contributor?.date}</p>
                                </div>
                            </div>
                        </div>

                        {/* Suggestions List */}
                        <div className="flex flex-col h-full min-h-0">
                             <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Encontrar no Extrato</h4>
                             <div className="relative mb-3 flex-shrink-0">
                                <SearchIcon className="w-4 h-4 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar transação..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-10 p-2.5 block w-full rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm transition-all"
                                />
                            </div>
                             <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-slate-900 shadow-inner">
                                {filteredSuggestions.length > 0 ? (
                                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredSuggestions.map(tx => (
                                            <li
                                                key={tx.id}
                                                onClick={() => setSelectedTxId(tx.id)}
                                                className={`p-4 cursor-pointer flex items-start gap-3 transition-all duration-200 ${selectedTxId === tx.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            >
                                                <div className="flex-shrink-0 mt-0.5">
                                                     {selectedTxId === tx.id ? (
                                                         <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                                                             <CheckCircleIcon className="w-3.5 h-3.5" />
                                                         </div>
                                                     ) : (
                                                         <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600"></div>
                                                     )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-bold truncate ${selectedTxId === tx.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{tx.cleanedDescription || tx.description}</p>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <span className="text-[10px] text-slate-400 font-mono">{tx.date}</span>
                                                        <span className={`text-xs font-bold ${selectedTxId === tx.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>{formatCurrency(tx.amount, language)}</span>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
                                        <p className="text-sm font-medium">Nenhuma transação correspondente.</p>
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-2xl border-t border-slate-100 dark:border-slate-700/50 flex-shrink-0">
                    <button type="button" onClick={closeManualMatchModal} className="px-5 py-2.5 text-sm font-bold rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all">{t('common.cancel')}</button>
                    <button type="button" onClick={handleConfirm} disabled={!selectedTxId} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
                        Confirmar Associação
                    </button>
                </div>
            </div>
        </div>
    );
};