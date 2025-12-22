
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
    const daysDiff = (d1: Date, d2: Date) => Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));

    const smartMatches = useMemo(() => {
        const targetAmount = record.contributor?.amount || 0;
        const targetDate = record.contributor?.date ? parseDate(record.contributor.date) : null;

        return suggestions.filter(tx => {
            if (Math.abs(tx.amount - targetAmount) > 0.05) return false;
            if (targetDate) {
                const txDate = parseDate(tx.date);
                if (txDate && daysDiff(txDate, targetDate) <= (dayTolerance + 2)) return true;
                return false; 
            }
            return true;
        });
    }, [suggestions, record, dayTolerance]);

    const filteredSuggestions = useMemo(() => {
        if (searchQuery.trim()) {
            return suggestions.filter(tx => filterTransactionByUniversalQuery(tx, searchQuery));
        }
        return smartMatches;
    }, [searchQuery, suggestions, smartMatches]);

    const handleConfirm = () => {
        if (selectedTxId) {
            const selectedTx = suggestions.find(s => s.id === selectedTxId);
            if (selectedTx) confirmManualAssociation(selectedTx);
        }
    };

    return (
        <div className="glass-overlay">
            <div className="glass-modal max-w-5xl w-full animate-scale-in">
                
                <div className="px-6 py-4 glass-header flex justify-between items-center">
                    <div className="flex flex-col">
                        <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Associar Contribuição</h3>
                        <p className="text-[9px] uppercase font-bold text-brand-blue tracking-widest">Conciliação Assistida</p>
                    </div>
                    <button onClick={closeManualMatchModal} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                    {/* Registro Fixo (Esquerda) */}
                    <div className="w-full md:w-[320px] bg-slate-50 dark:bg-slate-900/50 p-6 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 overflow-y-auto custom-scrollbar shrink-0">
                        <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Registro da Lista</h4>
                        <div className="space-y-6">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Contribuinte</p>
                                <p className="text-xl font-black text-slate-800 dark:text-white leading-tight">{record.contributor?.cleanedName || record.contributor?.name}</p>
                            </div>
                            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Valor Esperado</p>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(record.contributor?.amount || 0, language)}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Data</p>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">{record.contributor?.date}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Igreja</p>
                                    <p className="text-xs font-bold text-brand-blue truncate">{record.church.name}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lista de Sugestões (Direita) */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
                        <div className="p-4 border-b border-slate-50 dark:border-slate-800 shrink-0">
                            <div className="relative">
                                <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Pesquisar em todo o extrato bancário..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-blue/20 transition-all"
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">
                                {searchQuery ? 'Resultados da Busca' : 'Sugestões pelo Valor'}
                            </h4>
                            {filteredSuggestions.length > 0 ? (
                                <div className="space-y-2">
                                    {filteredSuggestions.map(tx => (
                                        <div
                                            key={tx.id}
                                            onClick={() => setSelectedTxId(tx.id)}
                                            className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center gap-4 ${selectedTxId === tx.id ? 'bg-blue-50 dark:bg-blue-900/20 border-brand-blue shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                                        >
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedTxId === tx.id ? 'bg-brand-blue border-brand-blue text-white' : 'border-slate-200 dark:border-slate-600 text-transparent'}`}>
                                                <CheckCircleIcon className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{tx.cleanedDescription || tx.description}</p>
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className="text-[10px] font-mono text-slate-400">{tx.date}</span>
                                                    <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(tx.amount, language)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-40 flex flex-col items-center justify-center text-slate-400 opacity-50">
                                    <SearchIcon className="w-8 h-8 mb-2" />
                                    <p className="text-xs font-medium">Nenhuma transação correspondente encontrada.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 glass-footer flex justify-end gap-3">
                    <button onClick={closeManualMatchModal} className="px-5 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all uppercase tracking-wide">Cancelar</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={!selectedTxId}
                        className="px-8 py-2 text-[10px] font-black text-white bg-gradient-to-r from-brand-blue to-indigo-600 rounded-full shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:grayscale uppercase tracking-widest"
                    >
                        Confirmar Associação
                    </button>
                </div>
            </div>
        </div>
    );
};
