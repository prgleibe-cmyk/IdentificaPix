
import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { XMarkIcon, CheckCircleIcon, SearchIcon } from '../Icons';
import { filterTransactionByUniversalQuery, parseDate } from '../../services/processingService';

export const ManualMatchModal: React.FC = () => {
    const { manualMatchState, closeManualMatchModal, confirmManualAssociation, dayTolerance } = useContext(AppContext);
    const { t, language } = useTranslation();
    const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    if (!manualMatchState) return null;

    const { record, suggestions } = manualMatchState;

    // Helper for date diff
    const daysDiff = (d1: Date, d2: Date) => Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));

    // Smart Matches Logic: Runs only when search query is empty
    const smartMatches = useMemo(() => {
        const targetAmount = record.contributor?.amount || 0;
        const targetDate = record.contributor?.date ? parseDate(record.contributor.date) : null;

        return suggestions.filter(match => {
            const tx = match.transaction;
            
            // Amount Match (Strict)
            if (Math.abs(tx.amount - targetAmount) > 0.05) return false;
            
            // Date Match (Tolerance)
            if (targetDate) {
                const txDate = parseDate(tx.date);
                if (txDate && daysDiff(txDate, targetDate) <= (dayTolerance + 2)) {
                    return true;
                }
                return false; 
            }
            return true; // No date to compare, match on amount
        });
    }, [suggestions, record, dayTolerance]);

    const filteredSuggestions = useMemo(() => {
        // If the user types anything, we search the ENTIRE dataset (Global Search)
        if (searchQuery.trim()) {
            return suggestions.filter(match => filterTransactionByUniversalQuery(match.transaction, searchQuery));
        }
        // If search is empty, show Smart Suggestions (Amount/Date match)
        return smartMatches;
    }, [searchQuery, suggestions, smartMatches]);


    const handleConfirm = () => {
        if (selectedTxId) {
            const selectedMatch = suggestions.find(s => s.transaction.id === selectedTxId);
            if (selectedMatch) {
                confirmManualAssociation(selectedMatch);
            }
        }
    };

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal animate-scale-in">
                
                {/* Header */}
                <div className="px-6 py-4 glass-header flex justify-between items-center shrink-0">
                    <div className="flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Associar Contribuição</h3>
                        <p className="text-[10px] uppercase font-semibold text-orange-600 dark:text-orange-400 tracking-wider mt-0.5">Conciliação Manual Assistida</p>
                    </div>
                    <button type="button" onClick={closeManualMatchModal} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
                        <XMarkIcon className="w-5 h-5 stroke-[2]" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-hidden flex flex-col">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
                        
                        {/* LEFT COLUMN: The Fixed Record */}
                        <div className="flex flex-col h-full bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs relative overflow-hidden">
                            <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-5 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-orange-600"></span> Registro da Igreja
                            </h4>
                            
                            <div className="space-y-5 flex-1 flex flex-col justify-center">
                                <div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Contribuinte</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
                                        {record.contributor?.cleanedName || record.contributor?.name}
                                    </p>
                                </div>
                                
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Valor Esperado</p>
                                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
                                        {formatCurrency(record.contributor?.amount || 0, language)}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Data na Lista</p>
                                    <div className="inline-flex items-center px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg font-mono font-semibold text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700 tabular-nums">
                                        {record.contributor?.date}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: The Searchable List */}
                        <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
                              <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 z-10">
                                 <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-600"></span> 
                                    {searchQuery ? 'Resultados da Busca' : 'Sugestões Inteligentes'}
                                 </h4>
                                 <div className="relative">
                                    <SearchIcon className="w-4 h-4 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Buscar em todo o extrato..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="pl-9 pr-3 py-2 block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 text-xs font-medium transition-colors outline-none"
                                    />
                                </div>
                             </div>
                             
                             <div
                                className="overflow-y-auto custom-scrollbar flex-1 p-2.5 bg-slate-50/40 dark:bg-slate-950/30"
                                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                             >
                                {filteredSuggestions.length > 0 ? (
                                    <ul className="space-y-2">
                                        {filteredSuggestions.map(match => {
                                            const tx = match.transaction;
                                            const isSelected = selectedTxId === tx.id;
                                            return (
                                                <li
                                                    key={tx.id}
                                                    onClick={() => setSelectedTxId(tx.id)}
                                                    className={`
                                                        p-3.5 cursor-pointer rounded-xl border transition-colors group
                                                        ${isSelected 
                                                            ? 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 shadow-xs' 
                                                            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`
                                                            flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center border transition-colors mt-0.5
                                                            ${isSelected ? 'bg-orange-600 border-orange-600 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent'}
                                                        `}>
                                                            <CheckCircleIcon className="w-3.5 h-3.5" />
                                                        </div>
                                                        
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-xs font-semibold truncate transition-colors ${isSelected ? 'text-orange-900 dark:text-orange-100' : 'text-slate-800 dark:text-slate-200'}`}>
                                                                {tx.cleanedDescription || tx.description}
                                                            </p>
                                                            <div className="flex justify-between items-center mt-1.5">
                                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded tabular-nums">{tx.date}</span>
                                                                <span className={`text-xs font-bold tracking-tight tabular-nums ${isSelected ? 'text-orange-700 dark:text-orange-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                    {formatCurrency(tx.amount, language)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
                                        <p className="text-xs font-medium">
                                            {searchQuery ? 'Nenhum resultado para sua busca.' : 'Nenhuma sugestão automática encontrada.'}
                                        </p>
                                        {!searchQuery && <p className="text-[11px] mt-1">Use a busca acima para encontrar qualquer transação.</p>}
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex justify-end gap-2.5 shrink-0">
                    <button type="button" onClick={closeManualMatchModal} className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors cursor-pointer">
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleConfirm} 
                        disabled={!selectedTxId} 
                        className="px-5 py-2 text-xs font-semibold text-white rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-orange-600 hover:bg-orange-700 cursor-pointer"
                    >
                        Confirmar Associação
                    </button>
                </div>
            </div>
        </div>
    );
};
