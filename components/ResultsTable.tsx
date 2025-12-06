import React, { memo } from 'react';
import { MatchResult } from '../types';
import { formatCurrency } from '../utils/formatters';
import { useTranslation } from '../contexts/I18nContext';
import { SparklesIcon, UserPlusIcon, BrainIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';

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
        LEARNED: { Icon: BrainIcon, tooltip: t('tooltip.learned'), color: 'text-purple-600 bg-purple-50 border-purple-100' },
        AI: { Icon: SparklesIcon, tooltip: t('tooltip.ai'), color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
        MANUAL: { Icon: UserPlusIcon, tooltip: t('tooltip.manual'), color: 'text-blue-600 bg-blue-50 border-blue-100' },
        AUTOMATIC: null,
    };

    const config = iconMap[method];
    if (!config) return null;

    return (
        <span className={`relative group ml-2 flex items-center justify-center w-6 h-6 rounded-full border ${config.color} shadow-sm`}>
            <config.Icon className="w-3.5 h-3.5" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 text-[10px] font-bold tracking-wide text-white bg-slate-800 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all transform scale-95 group-hover:scale-100 z-10 pointer-events-none">
                {config.tooltip}
            </span>
        </span>
    );
}

export const ResultsTable: React.FC<ResultsTableProps> = memo(({ results, onManualIdentify, loadingAiId, currentPage, totalPages, onPageChange }) => {
    const { t, language } = useTranslation();
  
    const getStatusBadge = (status: MatchResult['status'], method?: MatchResult['matchMethod']) => {
        if (status === 'NÃO IDENTIFICADO') {
            return (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 animate-pulse"></span>
                    {status}
                </span>
            );
        }
        if (status === 'IDENTIFICADO') {
            return (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
                    {status}
                </span>
            );
        }
        return null;
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-soft mt-8 border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    {t('dashboard.resultsTitle')}
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold shadow-inner">{results.length}</span>
                </h3>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                    <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700">
                        <tr>
                            <th scope="col" className="px-8 py-5 font-bold tracking-wider">{t('table.date')}</th>
                            <th scope="col" className="px-8 py-5 font-bold tracking-wider">{t('table.description')}</th>
                            <th scope="col" className="px-8 py-5 text-right font-bold tracking-wider">{t('table.amount')}</th>
                            <th scope="col" className="px-8 py-5 font-bold tracking-wider">{t('table.church')}</th>
                            <th scope="col" className="px-8 py-5 font-bold tracking-wider">{t('table.contributor')}</th>
                            <th scope="col" className="px-8 py-5 text-center font-bold tracking-wider">{t('table.status')}</th>
                            <th scope="col" className="px-8 py-5 text-center font-bold tracking-wider">{t('table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {results.map(({ transaction, contributor, status, church, matchMethod }) => (
                            <tr key={transaction.id} className="bg-white dark:bg-slate-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group">
                                <td className="px-8 py-5 whitespace-nowrap text-xs font-semibold text-slate-500">{transaction.date}</td>
                                <td className="px-8 py-5 font-medium text-slate-700 dark:text-slate-200 max-w-[220px] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={transaction.cleanedDescription || transaction.description}>
                                    {transaction.cleanedDescription || transaction.description}
                                </td>
                                <td className="px-8 py-5 text-right whitespace-nowrap">
                                    <span className={`font-bold tabular-nums tracking-tight text-base ${transaction.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {transaction.originalAmount || formatCurrency(transaction.amount, language)}
                                    </span>
                                </td>
                                <td className="px-8 py-5 max-w-[180px] truncate" title={church.name}>
                                    <span className="inline-block px-3 py-1 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                        {church.name}
                                    </span>
                                </td>
                                <td className="px-8 py-5 max-w-[180px] truncate font-semibold text-slate-800 dark:text-white" title={contributor?.name}>
                                    {contributor?.cleanedName || contributor?.name || <span className="text-slate-300 font-normal">---</span>}
                                </td>
                                <td className="px-8 py-5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        {getStatusBadge(status, matchMethod)}
                                        {status === 'IDENTIFICADO' && <MatchMethodIcon method={matchMethod} />}
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    {status === 'NÃO IDENTIFICADO' && (
                                        <button 
                                            onClick={() => onManualIdentify(transaction.id)} 
                                            disabled={!!loadingAiId} 
                                            className="inline-flex items-center justify-center p-2.5 rounded-xl text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-600 hover:text-white hover:border-transparent dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-600 dark:hover:text-white transition-all shadow-sm"
                                            title={t('table.actions.manual')}
                                        >
                                            <UserPlusIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {results.length === 0 && (
                <div className="text-center py-20 bg-slate-50/50 dark:bg-slate-800/50">
                    <p className="text-slate-400 dark:text-slate-500 font-medium text-lg">{t('common.noResults')}</p>
                </div>
            )}

            {totalPages && totalPages > 1 && onPageChange && currentPage && (
                <div className="flex items-center justify-between px-8 py-5 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Página <span className="font-bold text-slate-900 dark:text-white">{currentPage}</span> de <span className="font-bold text-slate-900 dark:text-white">{totalPages}</span>
                    </span>
                    <div className="flex items-center space-x-3">
                        <button 
                            onClick={() => onPageChange(currentPage - 1)} 
                            disabled={currentPage === 1} 
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => onPageChange(currentPage + 1)} 
                            disabled={currentPage === totalPages} 
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});