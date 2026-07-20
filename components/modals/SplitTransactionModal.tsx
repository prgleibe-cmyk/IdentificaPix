import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, PlusIcon, TrashIcon } from '../Icons';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { MatchResult, TransactionSplit } from '../../types';

interface SplitTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    matchResult: MatchResult | null;
    onSave: (splits: TransactionSplit[]) => void;
}

export const SplitTransactionModal: React.FC<SplitTransactionModalProps> = ({
    isOpen,
    onClose,
    matchResult,
    onSave
}) => {
    const { contributionKeywords, language } = useContext(AppContext);
    const { t } = useTranslation();

    const [splits, setSplits] = useState<TransactionSplit[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Get original details
    const originalAmount = matchResult ? matchResult.transaction.amount : 0;
    const isExpense = originalAmount < 0;
    const absoluteOriginal = Math.abs(originalAmount);

    useEffect(() => {
        if (isOpen && matchResult) {
            if (matchResult.splits && matchResult.splits.length > 0) {
                // Load existing splits
                setSplits(matchResult.splits.map(s => ({ ...s })));
            } else {
                // Initialize with 1 split covering the whole amount
                const defaultType = matchResult.contributor?.contributionType || matchResult.contributionType || contributionKeywords?.[0] || 'Dízimo';
                setSplits([
                    {
                        id: Math.random().toString(36).substring(2, 9),
                        amount: absoluteOriginal,
                        contributionType: defaultType,
                        description: ''
                    }
                ]);
            }
            setErrorMessage(null);
        }
    }, [isOpen, matchResult, absoluteOriginal, contributionKeywords]);

    if (!isOpen || !matchResult) return null;

    const totalSplitAmount = splits.reduce((sum, s) => sum + (s.amount || 0), 0);
    const difference = absoluteOriginal - totalSplitAmount;
    const isSumPerfect = Math.abs(difference) < 0.01;

    const handleAddSplit = () => {
        const remainingAmount = Math.max(0, difference);
        const defaultType = contributionKeywords?.[0] || 'Dízimo';
        setSplits(prev => [
            ...prev,
            {
                id: Math.random().toString(36).substring(2, 9),
                amount: remainingAmount,
                contributionType: defaultType,
                description: ''
            }
        ]);
    };

    const handleRemoveSplit = (id: string) => {
        if (splits.length <= 1) return;
        setSplits(prev => prev.filter(s => s.id !== id));
    };

    const handleSplitChange = (id: string, field: keyof TransactionSplit, value: any) => {
        setSplits(prev => prev.map(s => {
            if (s.id === id) {
                if (field === 'amount') {
                    const parsed = parseFloat(value) || 0;
                    return { ...s, amount: Math.abs(parsed) };
                }
                return { ...s, [field]: value };
            }
            return s;
        }));
    };

    const handleSaveClick = () => {
        if (!isSumPerfect) {
            setErrorMessage(`A soma das distribuições (${formatCurrency(totalSplitAmount, language)}) precisa ser exatamente igual ao valor total (${formatCurrency(absoluteOriginal, language)})`);
            return;
        }

        const hasInvalidAmount = splits.some(s => s.amount <= 0);
        if (hasInvalidAmount) {
            setErrorMessage('Cada distribuição deve ter um valor maior que zero.');
            return;
        }

        // Adjust split amounts signs to match the original transaction (e.g. positive for receipts, negative for expenses)
        const finalSplits = splits.map(s => ({
            ...s,
            amount: isExpense ? -Math.abs(s.amount) : Math.abs(s.amount)
        }));

        onSave(finalSplits);
        onClose();
    };

    const displayName = matchResult.contributor?.name || matchResult.contributor?.cleanedName || matchResult.transaction.cleanedDescription || matchResult.transaction.description;
    const displayDate = formatDate(matchResult.transaction.date);

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal animate-scale-in">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-slate-50 dark:bg-slate-900/30">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
                            Desmembrar / Ratear Lançamento
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            Distribua o valor total em múltiplos destinos sem perder o histórico do registro original.
                        </p>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    
                    {/* Source Information Box */}
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Origem do Lançamento</span>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mt-0.5 truncate max-w-md">
                                {displayName}
                            </h4>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                                <span>{displayDate}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                <span>{matchResult.church?.name || 'Igreja não identificada'}</span>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Valor Total</span>
                            <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                                {formatCurrency(absoluteOriginal, language)}
                            </p>
                        </div>
                    </div>

                    {/* Distribution Form */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Distribuição dos Valores</span>
                            <button 
                                type="button" 
                                onClick={handleAddSplit}
                                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/20 dark:text-orange-400 dark:hover:bg-orange-900/30 rounded-lg flex items-center gap-1.5 transition-all"
                            >
                                <PlusIcon className="w-3.5 h-3.5" /> Adicionar Destino
                            </button>
                        </div>

                        {/* Splits List */}
                        <div className="space-y-3">
                            {splits.map((split, index) => (
                                <div 
                                    key={split.id} 
                                    className="flex flex-col md:flex-row items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm"
                                >
                                    {/* Number / Index */}
                                    <span className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold text-xs rounded-full">
                                        {index + 1}
                                    </span>

                                    {/* Amount Input */}
                                    <div className="w-full md:w-1/4">
                                        <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Valor (R$)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                                            <input 
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                value={split.amount || ''}
                                                onChange={(e) => handleSplitChange(split.id, 'amount', e.target.value)}
                                                placeholder="0,00"
                                                className="w-full pl-9 pr-3 py-2 text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-blue"
                                            />
                                        </div>
                                    </div>

                                    {/* Category Select Dropdown */}
                                    <div className="w-full md:w-1/3">
                                        <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Tipo de Contribuição</label>
                                        <select
                                            value={split.contributionType}
                                            onChange={(e) => handleSplitChange(split.id, 'contributionType', e.target.value)}
                                            className="w-full px-3 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-blue"
                                        >
                                            {contributionKeywords?.map((keyword: string) => (
                                                <option key={keyword} value={keyword}>{keyword}</option>
                                            ))}
                                            {!contributionKeywords?.includes(split.contributionType) && (
                                                <option value={split.contributionType}>{split.contributionType}</option>
                                            )}
                                        </select>
                                    </div>

                                    {/* Observation Input */}
                                    <div className="w-full flex-1">
                                        <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Observação / Campanha</label>
                                        <input 
                                            type="text"
                                            value={split.description || ''}
                                            onChange={(e) => handleSplitChange(split.id, 'description', e.target.value)}
                                            placeholder="Ex: Campanha Missionária, Oferta de Amor"
                                            className="w-full px-3 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-blue"
                                        />
                                    </div>

                                    {/* Delete Button */}
                                    <button 
                                        type="button"
                                        onClick={() => handleRemoveSplit(split.id)}
                                        disabled={splits.length <= 1}
                                        className="mt-4 md:mt-0 p-2 text-slate-400 hover:text-red-500 disabled:opacity-20 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all"
                                        title="Remover distribuição"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Summary Balance Strip */}
                    <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total Distribuído</span>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 tabular-nums">
                                    {formatCurrency(totalSplitAmount, language)}
                                </p>
                            </div>
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total do Registro</span>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 tabular-nums">
                                    {formatCurrency(absoluteOriginal, language)}
                                </p>
                            </div>
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Saldo Restante</span>
                                <p className={`text-sm font-black mt-0.5 tabular-nums ${isSumPerfect ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                                    {formatCurrency(difference, language)}
                                </p>
                            </div>
                        </div>

                        {/* Status Message */}
                        <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-center">
                            {isSumPerfect ? (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                                    ● Distribuição exata (100% do valor alocado)
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                                    ⚠️ A soma das parcelas difere do total original em {formatCurrency(Math.abs(difference), language)}
                                </span>
                            )}
                        </div>
                    </div>

                    {errorMessage && (
                        <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-semibold p-3.5 rounded-xl border border-red-100 dark:border-red-900/30">
                            {errorMessage}
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-700/50 shrink-0">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-5 py-2 text-xs font-bold rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all uppercase tracking-wide"
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleSaveClick}
                        disabled={!isSumPerfect}
                        className="px-6 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none rounded-full shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 transition-all uppercase tracking-wide"
                    >
                        Confirmar Distribuição
                    </button>
                </div>

            </div>
        </div>
    );
};
