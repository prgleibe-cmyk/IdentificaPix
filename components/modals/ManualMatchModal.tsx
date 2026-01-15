
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
            <div className="glass-modal w-full max-w-4xl flex flex-col max-h-[90vh] animate-scale-in">
                
                {/* Header Premium */}
                <div className="px-8 py-5 glass-header flex justify-between items-center shrink-0">
                    <div className="flex flex-col">
                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Associar Contribuição</h3>
                        <p className="text-[10px] uppercase font-bold text-brand-blue tracking-widest mt-0.5">Conciliação Manual Assistida</p>
                    </div>
                    <button type="button" onClick={closeManualMatchModal} className="p-2 rounded-full hover:bg-slate-100/50 dark:hover:bg-slate-700/50 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <XMarkIcon className="w-6 h-6 stroke-[2]" />
                    </button>
                </div>

                <div className="p-8 flex-1 overflow-hidden flex flex-col">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
                        
                        {/* LEFT COLUMN: The Fixed Record */}
                        <div className="flex flex-col h-full bg-slate-50/80 dark:bg-slate-900/50 p-6 rounded-[1.5rem] border border-slate-200 dark:border-slate-700/50 shadow-inner relative overflow-hidden group">
                            {/* Decorative Background */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-3xl pointer-events-none group-hover:bg-brand-blue/10 transition-colors"></div>
                            
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-brand-blue"></span> Registro da Igreja
                            </h4>
                            
                            <div className="space-y-6 flex-1 flex flex-col justify-center">
                                <div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Contribuinte</p>
                                    <p className="text-xl md:text-2xl font-black text-slate-800 dark:text-white leading-tight tracking-tight">
                                        {record.contributor?.cleanedName || record.contributor?.name}
                                    </p>
                                </div>
                                
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Valor Esperado</p>
                                    <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
                                        {formatCurrency(record.contributor?.amount || 0, language)}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Data na Lista</p>
                                    <div className="inline-flex items-center px-4 py-2 bg-slate-200/50 dark:bg-slate-700/50 rounded-xl font-mono font-bold text-slate-700 dark:text-slate-300 text-sm border border-slate-300/50 dark:border-slate-600/50">
                                        {record.contributor?.date}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: The Searchable List */}
                        <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-800 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                             <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/80 backdrop-blur-sm z-10">
                                 <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 
                                    {searchQuery ? 'Resultados da Busca' : 'Sugestões Inteligentes'}
                                 </h4>
                                 <div className="relative">
                                    <SearchIcon className="w-4 h-4 text-slate-400 absolute top-1/2 left-3.5 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Buscar em todo o extrato..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="pl-10 p-3 block w-full rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm transition-all outline-none"
                                    />
                                </div>
                             </div>
                             
                             <div className="overflow-y-auto custom-scrollbar flex-1 p-2 bg-slate-50/20 dark:bg-slate-900/20">
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
                                                        p-4 cursor-pointer rounded-xl border transition-all duration-200 group
                                                        ${isSelected 
                                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-md transform scale-[1.01]' 
                                                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-start gap-4">
                                                        <div className={`
                                                            flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-colors
                                                            ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent'}
                                                        `}>
                                                            <CheckCircleIcon className="w-4 h-4" />
                                                        </div>
                                                        
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-bold truncate transition-colors ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                {tx.cleanedDescription || tx.description}
                                                            </p>
                                                            <div className="flex justify-between items-center mt-1.5">
                                                                <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{tx.date}</span>
                                                                <span className={`text-sm font-bold tracking-tight ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>
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
                                        <p className="text-sm font-medium">
                                            {searchQuery ? 'Nenhum resultado para sua busca.' : 'Nenhuma sugestão automática encontrada.'}
                                        </p>
                                        {!searchQuery && <p className="text-xs mt-1">Use a busca acima para encontrar qualquer transação.</p>}
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={closeManualMatchModal} className="px-6 py-3 text-xs font-bold rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all uppercase tracking-wide">
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleConfirm} 
                        disabled={!selectedTxId} 
                        className="px-8 py-3 text-xs font-bold text-white rounded-full shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none uppercase tracking-wide bg-gradient-to-r from-brand-blue to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                    >
                        Confirmar Associação
                    </button>
                </div>
            </div>
        </div>
    );
};
