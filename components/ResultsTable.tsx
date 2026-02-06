import React, { memo, useContext, useState, useCallback, useEffect } from 'react';
import { MatchResult } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useTranslation } from '../contexts/I18nContext';
import { AppContext } from '../contexts/AppContext';
import { SparklesIcon, UserPlusIcon, BrainIcon, BanknotesIcon, UserIcon, LockClosedIcon, LockOpenIcon } from './Icons';
import { BulkActionToolbar } from './BulkActionToolbar';

interface ResultsTableProps {
  results: MatchResult[];
  onManualIdentify: (transactionId: string) => void;
  loadingAiId: string | null;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

const MatchMethodIcon: React.FC<{ method: MatchResult['matchMethod'] }> = ({ method }) => {
    const { t } = useTranslation();
    if (!method) return null;

    const iconMap = {
        LEARNED: { Icon: BrainIcon, tooltip: t('tooltip.learned'), color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30' },
        AI: { Icon: SparklesIcon, tooltip: t('tooltip.ai'), color: 'text-teal-500 bg-teal-50 dark:bg-teal-900/30' },
        MANUAL: { Icon: UserPlusIcon, tooltip: t('tooltip.manual'), color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' },
        AUTOMATIC: null,
        TEMPLATE: null
    };

    const config = iconMap[method] || iconMap.AUTOMATIC;
    if (!config) return null;

    return (
        <span className={`ml-1.5 p-1 rounded-md ${config.color} inline-flex items-center justify-center`} title={config.tooltip}>
            <config.Icon className="w-3 h-3" />
        </span>
    );
};

export const ResultsTable: React.FC<ResultsTableProps> = memo(({ results, onManualIdentify, loadingAiId, currentPage, totalPages, onPageChange }) => {
    const { t, language } = useTranslation();
    const { toggleConfirmation } = useContext(AppContext);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => { 
        setSelectedIds([]); 
    }, [results.length]);

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }, []);

    const toggleAll = useCallback(() => {
        if (selectedIds.length === results.length && results.length > 0) setSelectedIds([]);
        else setSelectedIds(results.map(r => r.transaction.id));
    }, [results, selectedIds]);

    const getStatusBadge = (status: MatchResult['status'], method?: MatchResult['matchMethod'], confirmed?: boolean) => {
        if (confirmed) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wide">
                    <LockClosedIcon className="w-2.5 h-2.5" /> Fechado
                </span>
            );
        }

        if (status === 'NÃO IDENTIFICADO') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wide">
                    Pendente
                </span>
            );
        }

        if (status === 'PENDENTE') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide">
                    Fantasma
                </span>
            );
        }

        let label = 'Auto';
        if (method === 'MANUAL') label = 'Manual';
        else if (method === 'AI') label = 'IA';
        else if (method === 'LEARNED') label = 'Aprendido';

        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wide">
                {label}
            </span>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden mt-6 flex flex-col relative">
            <BulkActionToolbar selectedIds={selectedIds} onClear={() => setSelectedIds([])} />

            <div className="overflow-x-auto custom-scrollbar relative">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/95 dark:bg-slate-800/95 border-b border-slate-200/60 dark:border-slate-700 backdrop-blur-md sticky top-0 z-20">
                        <tr>
                            <th className="px-4 py-2.5 w-10 text-center">
                                <input type="checkbox" className="w-4 h-4 rounded-full border-slate-300 text-brand-blue" onChange={toggleAll} checked={selectedIds.length > 0 && selectedIds.length === results.length} />
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[10%]">{t('table.date')}</th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[30%]">Nome / Descrição</th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[15%]">Igreja</th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[12%]">Forma</th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[13%]">{t('table.amount')}</th>
                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[10%]">{t('table.status')}</th>
                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[10%]">{t('table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {results.map(({ transaction, contributor, status, matchMethod, contributorAmount, paymentMethod, church, isConfirmed }) => {
                            const isSelected = selectedIds.includes(transaction.id);

                            // 🧠 Fonte única de verdade
                            // Fix: transaction.isConfirmed is now valid after updating Transaction interface
                            const confirmed = transaction.isConfirmed ?? isConfirmed ?? false;

                            const displayAmount = status === 'PENDENTE' ? (contributorAmount || contributor?.amount || 0) : transaction.amount;
                            const displayDate = formatDate(status === 'PENDENTE' ? (contributor?.date || transaction.date) : transaction.date);
                            
                            const bankDescription = transaction.description;
                            const identifiedName = contributor?.name || contributor?.cleanedName;

                            return (
                                <tr
                                    key={transaction.id}
                                    className={`group hover:bg-slate-50/80 transition-all 
                                        ${isSelected ? 'bg-blue-50/30' : ''} 
                                        ${confirmed ? 'bg-indigo-50/10 grayscale-[0.3]' : ''}`
                                    }
                                >
                                    <td className="px-4 py-2.5 text-center">
                                        <input type="checkbox" className="w-4 h-4 rounded-full" checked={isSelected} onChange={() => toggleSelection(transaction.id)} />
                                    </td>
                                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{displayDate}</td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                {identifiedName ? <UserIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> : <BanknotesIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                                <span className={`text-xs font-bold uppercase truncate max-w-[200px] ${confirmed ? 'text-indigo-900/60 dark:text-white/60' : 'text-slate-800 dark:text-white'}`}>
                                                    {identifiedName || bankDescription}
                                                </span>
                                            </div>
                                            {identifiedName && <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tight truncate max-w-[200px] mt-0.5">{bankDescription}</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">{church?.name || '---'}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase italic">{paymentMethod || transaction.paymentMethod || '---'}</span>
                                    </td>
                                    <td className={`px-4 py-2.5 text-right font-mono text-xs font-bold ${displayAmount < 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                        {formatCurrency(displayAmount, language)}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {getStatusBadge(status, matchMethod, confirmed)}
                                            {status === 'IDENTIFICADO' && !confirmed && <MatchMethodIcon method={matchMethod} />}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {confirmed ? (
                                                <button 
                                                    onClick={() => toggleConfirmation([transaction.id], false)}
                                                    className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"
                                                    title="Remover Bloqueio"
                                                >
                                                    <LockOpenIcon className="w-3.5 h-3.5" />
                                                </button>
                                            ) : (
                                                status === 'NÃO IDENTIFICADO' && (
                                                    <button 
                                                        onClick={() => onManualIdentify(transaction.id)} 
                                                        className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-brand-blue hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <UserPlusIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
});