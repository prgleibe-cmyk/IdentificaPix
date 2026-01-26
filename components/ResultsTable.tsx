
import React, { memo, useContext, useState, useCallback, useEffect } from 'react';
import { MatchResult } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useTranslation } from '../contexts/I18nContext';
import { AppContext } from '../contexts/AppContext';
import { SparklesIcon, UserPlusIcon, BrainIcon, ExclamationTriangleIcon, BanknotesIcon, UserIcon, CheckCircleIcon, BuildingOfficeIcon } from './Icons';
import { BulkActionToolbar } from './BulkActionToolbar';
import { NameResolver } from '../core/processors/NameResolver';

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
        LEARNED: { Icon: BrainIcon, tooltip: t('tooltip.learned'), color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400' },
        AI: { Icon: SparklesIcon, tooltip: t('tooltip.ai'), color: 'text-teal-500 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400' },
        MANUAL: { Icon: UserPlusIcon, tooltip: t('tooltip.manual'), color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
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
}

export const ResultsTable: React.FC<ResultsTableProps> = memo(({ results, onManualIdentify, loadingAiId, currentPage, totalPages, onPageChange }) => {
    const { t, language } = useTranslation();
    
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        setSelectedIds([]);
    }, [results.length]);

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }, []);

    const toggleAll = useCallback(() => {
        if (selectedIds.length === results.length && results.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(results.map(r => r.transaction.id));
        }
    }, [results, selectedIds]);

    const getStatusBadge = (status: MatchResult['status'], method?: MatchResult['matchMethod']) => {
        if (status === 'NÃO IDENTIFICADO') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 uppercase tracking-wide whitespace-nowrap">
                    Pendente
                </span>
            );
        }
        if (status === 'PENDENTE') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 uppercase tracking-wide whitespace-nowrap">
                    Não Localizado
                </span>
            );
        }
        let bgClass = 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400';
        let label = 'Auto';
        if (method === 'MANUAL') {
            bgClass = 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400';
            label = 'Manual';
        } else if (method === 'AI') {
            bgClass = 'bg-purple-50 border-purple-100 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400';
            label = 'IA';
        } else if (method === 'LEARNED') { label = 'Aprendido'; }
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wide whitespace-nowrap ${bgClass}`}>
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
                            <th scope="col" className="px-4 py-2.5 w-10 text-center">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded-full border-slate-300 text-brand-blue focus:ring-brand-blue cursor-pointer accent-blue-600"
                                    onChange={toggleAll}
                                    checked={selectedIds.length > 0 && selectedIds.length === results.length}
                                />
                            </th>
                            <th scope="col" className="px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[10%]">{t('table.date')}</th>
                            <th scope="col" className="px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[22%]">Nome / Descrição</th>
                            <th scope="col" className="px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[15%]">Igreja</th>
                            <th scope="col" className="px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[12%]">Tipo</th>
                            <th scope="col" className="px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[10%]">Forma</th>
                            <th scope="col" className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[13%]">{t('table.amount')}</th>
                            <th scope="col" className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[8%]">{t('table.status')}</th>
                            <th scope="col" className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[8%]">{t('table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {results.map(({ transaction, contributor, status, matchMethod, contributorAmount, contributionType, paymentMethod, divergence, church }) => {
                            const isGhost = status === 'PENDENTE';
                            const isSelected = selectedIds.includes(transaction.id);
                            const displayAmount = isGhost ? (contributorAmount || contributor?.amount || 0) : transaction.amount;
                            const isExpense = displayAmount < 0;
                            const rawDate = isGhost ? (contributor?.date || transaction.date) : transaction.date;
                            const displayDate = formatDate(rawDate);
                            
                            const rawName = contributor?.cleanedName || contributor?.name || transaction.cleanedDescription || transaction.description;
                            const primaryName = NameResolver.formatDisplayName(rawName);
                            
                            const displayType = contributor?.contributionType || contributionType || transaction.contributionType || '---';
                            const displayForm = contributor?.paymentMethod || paymentMethod || transaction.paymentMethod || '---';

                            return (
                                <tr key={transaction.id} className={`group hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-all duration-200 ${isGhost ? 'opacity-70 bg-slate-50/30 dark:bg-slate-800/30' : ''} ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                    <td className="px-4 py-2.5 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded-full border-slate-300 text-brand-blue focus:ring-brand-blue cursor-pointer accent-blue-600"
                                            checked={isSelected}
                                            onChange={() => toggleSelection(transaction.id)}
                                        />
                                    </td>
                                    <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{displayDate}</td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                {(contributor || isGhost) ? <UserIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> : <BanknotesIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                                <span className={`text-xs font-bold leading-tight break-words ${isGhost ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-white'}`}>{primaryName}</span>
                                            </div>
                                            {isGhost && <span className="text-[9px] text-red-400 pl-5 font-medium italic">Não encontrado no extrato</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <BuildingOfficeIcon className={`w-3.5 h-3.5 shrink-0 ${status === 'IDENTIFICADO' ? 'text-indigo-400' : 'text-slate-300'}`} />
                                            <span className={`text-[10px] font-bold uppercase break-words ${status === 'IDENTIFICADO' ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                                                {church?.name || '---'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${displayType !== '---' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/30' : 'text-slate-300 italic'}`}>{displayType}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{displayForm}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-xs font-bold tabular-nums">
                                        <span className={isExpense ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}>{formatCurrency(displayAmount, language)}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {getStatusBadge(status, matchMethod)}
                                            {status === 'IDENTIFICADO' && <MatchMethodIcon method={matchMethod} />}
                                            {divergence && <span className="text-yellow-500 ml-1"><ExclamationTriangleIcon className="w-3 h-3"/></span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        {status === 'NÃO IDENTIFICADO' && (
                                            <button onClick={() => onManualIdentify(transaction.id)} className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-brand-blue hover:text-white opacity-0 group-hover:opacity-100 transition-all"><UserPlusIcon className="w-3.5 h-3.5" /></button>
                                        )}
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
