
import React, { memo, useContext } from 'react';
import { MatchResult } from '../types';
import { formatCurrency } from '../utils/formatters';
import { useTranslation } from '../contexts/I18nContext';
import { AppContext } from '../contexts/AppContext';
import { SparklesIcon, UserPlusIcon, BrainIcon, ChevronLeftIcon, ChevronRightIcon, ExclamationTriangleIcon } from './Icons';
import { cleanTransactionDescriptionForDisplay } from '../services/processingService';

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
    };

    const config = iconMap[method];
    if (!config) return null;

    return (
        <span className={`ml-1.5 p-1 rounded-md ${config.color} inline-flex items-center justify-center`} title={config.tooltip}>
            <config.Icon className="w-3 h-3" />
        </span>
    );
}

export const ResultsTable: React.FC<ResultsTableProps> = memo(({ results, onManualIdentify, loadingAiId, currentPage, totalPages, onPageChange }) => {
    const { t, language } = useTranslation();
    const { customIgnoreKeywords } = useContext(AppContext);
  
    // Avatar Logic Helpers
    const getChurchInitial = (name: string) => name.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase() || '?';
    const avatarColors = [
        'bg-indigo-50 text-indigo-600 border-indigo-100',
        'bg-blue-50 text-blue-600 border-blue-100',
        'bg-violet-50 text-violet-600 border-violet-100',
        'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100'
    ];

    const getStatusBadge = (status: MatchResult['status'], method?: MatchResult['matchMethod']) => {
        if (status === 'NÃO IDENTIFICADO') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 uppercase tracking-wide whitespace-nowrap">
                    Pendente
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
        } else if (method === 'LEARNED') {
             label = 'Aprendido';
        }

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wide whitespace-nowrap ${bgClass}`}>
                {label}
            </span>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden mt-6 flex flex-col">
            
            {/* Table Container with Internal Scroll */}
            <div className="overflow-x-auto custom-scrollbar relative">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/95 dark:bg-slate-800/95 border-b border-slate-200/60 dark:border-slate-700 backdrop-blur-md sticky top-0 z-20">
                        <tr>
                            <th scope="col" className="px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[12%]">{t('table.date')}</th>
                            <th scope="col" className="px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[20%]">{t('table.church')}</th>
                            <th scope="col" className="px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[30%]">Descrição / Contribuinte</th>
                            <th scope="col" className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[15%]">{t('table.amount')}</th>
                            <th scope="col" className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[10%]">{t('table.status')}</th>
                            <th scope="col" className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[8%]">{t('table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {results.map(({ transaction, contributor, status, church, matchMethod, contributorAmount, divergence }) => {
                            const isExpense = transaction.amount < 0;
                            // Prioridade para o valor do contribuinte se for uma transação virtual (pendente no extrato)
                            // Senão, usa o valor da transação bancária original.
                            const amount = isExpense 
                                ? transaction.amount 
                                : (contributorAmount ?? (Math.abs(transaction.amount) > 0 ? transaction.amount : (contributor?.amount ?? 0)));
                            
                            const churchName = church?.name || '---';
                            const displayDate = contributor?.date || transaction.date;
                            
                            // CRÍTICO: Re-limpar a descrição na hora da exibição para refletir alterações em Palavras-chave Ignoradas sem precisar re-processar
                            const cleanedTxDesc = cleanTransactionDescriptionForDisplay(transaction.description, customIgnoreKeywords);
                            const displayName = contributor?.cleanedName || contributor?.name || cleanedTxDesc;
                            
                            const avatarColor = avatarColors[churchName.length % avatarColors.length];

                            return (
                                <tr key={transaction.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-all duration-200">
                                    
                                    {/* Date */}
                                    <td className="px-4 py-2.5 whitespace-nowrap">
                                        <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums tracking-tight">
                                            {displayDate}
                                        </span>
                                    </td>

                                    {/* Church */}
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center">
                                            {churchName !== '---' && (
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold mr-2 border shrink-0 transition-transform group-hover:scale-105 ${avatarColor} dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600`}>
                                                    {getChurchInitial(churchName)}
                                                </div>
                                            )}
                                            <span className={`text-xs font-semibold truncate max-w-[150px] ${churchName === '---' ? 'text-slate-400 italic font-normal' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {churchName === '---' ? t('common.unassigned') : churchName}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Description / Name */}
                                    <td className="px-4 py-2.5 break-words min-w-[200px]">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-800 dark:text-white leading-tight line-clamp-1" title={displayName}>
                                                {displayName}
                                            </span>
                                            {status === 'IDENTIFICADO' && contributor && cleanedTxDesc && cleanedTxDesc !== contributor.cleanedName && (
                                                <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium truncate max-w-[250px]">
                                                    Origem: {cleanedTxDesc}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Amount */}
                                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                        <span className={`font-mono text-xs font-bold tabular-nums tracking-tight ${isExpense ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                                            {formatCurrency(amount, language)}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td className="px-4 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {getStatusBadge(status, matchMethod)}
                                            {status === 'IDENTIFICADO' && <MatchMethodIcon method={matchMethod} />}
                                            {divergence && (
                                                <span className="text-yellow-500 ml-1" title="Possível divergência"><ExclamationTriangleIcon className="w-3 h-3"/></span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-2.5 text-center">
                                        {status === 'NÃO IDENTIFICADO' && (
                                            <button 
                                                onClick={() => onManualIdentify(transaction.id)} 
                                                disabled={!!loadingAiId} 
                                                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-brand-blue hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-blue-600 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                                title={t('table.actions.manual')}
                                            >
                                                <UserPlusIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages && totalPages > 1 && onPageChange && currentPage && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-800">
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                <span className="text-slate-700 dark:text-slate-200">{(currentPage - 1) * 50 + 1}</span> - <span className="text-slate-700 dark:text-slate-200">{Math.min(currentPage * 50, results.length)}</span>
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-full shadow-sm" aria-label="Pagination">
                                <button
                                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center px-3 py-1 rounded-l-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase"
                                >
                                    <ChevronLeftIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                                    Ant
                                </button>
                                <span className="relative inline-flex items-center px-3 py-1 border-t border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-[10px] font-black text-brand-blue dark:text-blue-400 min-w-[2rem] justify-center">
                                    {currentPage}
                                </span>
                                <button
                                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="relative inline-flex items-center px-3 py-1 rounded-r-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase"
                                >
                                    Prox
                                    <ChevronRightIcon className="h-3 w-3 ml-1" aria-hidden="true" />
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            )}
            
            {results.length === 0 && (
                <div className="text-center py-16 bg-slate-50/50 dark:bg-slate-900/30">
                    <p className="text-slate-400 font-medium text-xs">{t('common.noResults')}</p>
                </div>
            )}
        </div>
    );
});
