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
        LEARNED: { Icon: BrainIcon, tooltip: t('tooltip.learned'), color: 'text-purple-500' },
        AI: { Icon: SparklesIcon, tooltip: t('tooltip.ai'), color: 'text-blue-500' },
        MANUAL: { Icon: UserPlusIcon, tooltip: t('tooltip.manual'), color: 'text-slate-600 dark:text-slate-400' },
        AUTOMATIC: null,
    };

    const config = iconMap[method];
    if (!config) return null;

    return (
        <span className="relative group ml-2">
            <config.Icon className={`w-4 h-4 ${config.color}`} />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 text-xs text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {config.tooltip}
            </span>
        </span>
    );
}

export const ResultsTable: React.FC<ResultsTableProps> = memo(({ results, onManualIdentify, loadingAiId, currentPage, totalPages, onPageChange }) => {
    const { t, language } = useTranslation();
  
    const getStatusClasses = (status: MatchResult['status'], method?: MatchResult['matchMethod']) => {
        if (status === 'NÃO IDENTIFICADO') {
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
        }
        if (status === 'IDENTIFICADO') {
            switch (method) {
                case 'MANUAL':
                    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
                default:
                    return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
            }
        }
        return '';
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-sm mt-8 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 px-2 sm:px-0">{t('dashboard.resultsTitle')}</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                    <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                        <tr>
                            <th scope="col" className="px-6 py-3 font-medium">{t('table.date')}</th>
                            <th scope="col" className="px-6 py-3 font-medium">{t('table.description')}</th>
                            <th scope="col" className="px-6 py-3 font-medium">{t('table.amount')}</th>
                            <th scope="col" className="px-6 py-3 font-medium">{t('table.church')}</th>
                            <th scope="col" className="px-6 py-3 font-medium">{t('table.contributor')}</th>
                            <th scope="col" className="px-6 py-3 font-medium">{t('table.status')}</th>
                            <th scope="col" className="px-6 py-3 font-medium text-center">{t('table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map(({ transaction, contributor, status, church, matchMethod }) => (
                            <tr key={transaction.id} className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-6 py-4 whitespace-nowrap">{transaction.date}</td>
                                <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 max-w-sm truncate">{transaction.cleanedDescription || transaction.description}</td>
                                <td className="px-6 py-4 text-right text-green-700 dark:text-green-400 font-semibold whitespace-nowrap">{formatCurrency(transaction.amount, language)}</td>
                                <td className="px-6 py-4">{church.name}</td>
                                <td className="px-6 py-4">{contributor?.cleanedName || contributor?.name || '---'}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusClasses(status, matchMethod)}`}>
                                            {status}
                                        </span>
                                        {status === 'IDENTIFICADO' && <MatchMethodIcon method={matchMethod} />}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {status === 'NÃO IDENTIFICADO' && (
                                        <div className="flex items-center justify-center space-x-2">
                                            <button onClick={() => onManualIdentify(transaction.id)} disabled={!!loadingAiId} className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                                <UserPlusIcon className="w-4 h-4 mr-2" />
                                                {t('table.actions.manual')}
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {results.length === 0 && <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('common.noResults')}</p>}

            {totalPages && totalPages > 1 && onPageChange && currentPage && (
                <div className="flex items-center justify-between mt-4 px-2 sm:px-0">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Página <span className="font-semibold">{currentPage}</span> de <span className="font-semibold">{totalPages}</span></span>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            <ChevronLeftIcon className="w-4 h-4 mr-1" /> Anterior
                        </button>
                        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            Próxima <ChevronRightIcon className="w-4 h-4 ml-1" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});