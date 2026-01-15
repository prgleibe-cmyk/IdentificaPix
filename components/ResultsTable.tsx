
import React, { memo, useContext } from 'react';
import { MatchResult } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useTranslation } from '../contexts/I18nContext';
import { AppContext } from '../contexts/AppContext';
import { SparklesIcon, UserPlusIcon, BrainIcon, ExclamationTriangleIcon, BanknotesIcon, UserIcon } from './Icons';
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
    const { customIgnoreKeywords } = useContext(AppContext);
  
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
            <div className="overflow-x-auto custom-scrollbar relative">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/95 dark:bg-slate-800/95 border-b border-slate-200/60 dark:border-slate-700 backdrop-blur-md sticky top-0 z-20">
                        <tr>
                            <th scope="col" className="px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[12%]">{t('table.date')}</th>
                            <th scope="col" className="px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[40%]">Nome / Descrição</th>
                            <th scope="col" className="px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[13%]">Tipo</th>
                            <th scope="col" className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[15%]">{t('table.amount')}</th>
                            <th scope="col" className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[10%]">{t('table.status')}</th>
                            <th scope="col" className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[10%]">{t('table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {results.map(({ transaction, contributor, status, matchMethod, contributorAmount, contributionType, divergence }) => {
                            const isGhost = status === 'PENDENTE';
                            
                            // Lógica Simplificada de Valor:
                            // Se é Fantasma, usa o valor do contribuinte (que está em contributorAmount ou no obj contributor).
                            // Se é Real, usa o valor da transação.
                            const displayAmount = isGhost 
                                ? (contributorAmount || contributor?.amount || 0)
                                : transaction.amount;
                            
                            const isExpense = displayAmount < 0;

                            // Lógica de Data:
                            // Se é Fantasma, data da lista. Se Real, data do banco.
                            const rawDate = isGhost ? (contributor?.date || transaction.date) : transaction.date;
                            const displayDate = formatDate(rawDate);
                            
                            // Nomes para exibição
                            const cleanedTxDesc = cleanTransactionDescriptionForDisplay(transaction.description, customIgnoreKeywords);
                            const contributorName = contributor?.cleanedName || contributor?.name;
                            
                            // Nome Principal: Se tem contribuinte vinculado (Match ou Fantasma), mostra ele. Senão, mostra descrição limpa do banco.
                            const primaryName = contributorName || cleanedTxDesc;
                            
                            // Tipo: Prioriza o tipo consolidado
                            const displayType = contributor?.contributionType || contributionType || transaction.contributionType || '---';

                            return (
                                <tr key={transaction.id} className={`group hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-all duration-200 ${isGhost ? 'opacity-70 bg-slate-50/30 dark:bg-slate-800/30' : ''}`}>
                                    
                                    {/* Coluna Data */}
                                    <td className="px-4 py-2.5 whitespace-nowrap">
                                        <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums tracking-tight">
                                            {displayDate}
                                        </span>
                                    </td>
                                    
                                    {/* Coluna Nome / Descrição */}
                                    <td className="px-4 py-2.5 break-words min-w-[200px]">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                {/* Ícone Lógico: User = Origem Lista/Match, Banknotes = Origem Banco Pura */}
                                                {(contributor || isGhost) ? (
                                                    <UserIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" title="Origem: Lista de Contribuintes" />
                                                ) : (
                                                    <BanknotesIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" title="Origem: Extrato Bancário" />
                                                )}
                                                
                                                <span className={`text-xs font-bold leading-tight line-clamp-1 ${isGhost ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-white'}`} title={primaryName}>
                                                    {primaryName}
                                                </span>
                                            </div>

                                            {/* Subtítulo: Mostra a origem bancária se houve Match e os nomes diferem */}
                                            {status === 'IDENTIFICADO' && contributor && cleanedTxDesc && cleanedTxDesc !== contributorName && (
                                                <div className="flex items-center gap-2 opacity-80">
                                                    <BanknotesIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" title="Origem: Extrato Bancário" />
                                                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[250px]">
                                                        {cleanedTxDesc}
                                                    </span>
                                                </div>
                                            )}
                                            
                                            {isGhost && (
                                                <span className="text-[9px] text-red-400 dark:text-red-400 pl-5 font-medium italic">
                                                    Não encontrado no extrato
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="px-4 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${displayType !== '---' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' : 'text-slate-300 italic'}`}>
                                            {displayType}
                                        </span>
                                    </td>
                                    
                                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                        <span className={`font-mono text-xs font-bold tabular-nums tracking-tight ${isExpense ? 'text-red-600 dark:text-red-400 font-black' : isGhost ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                            {formatCurrency(displayAmount, language)}
                                        </span>
                                    </td>
                                    
                                    <td className="px-4 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {getStatusBadge(status, matchMethod)}
                                            {status === 'IDENTIFICADO' && <MatchMethodIcon method={matchMethod} />}
                                            {divergence && (
                                                <span className="text-yellow-500 ml-1" title="Possível divergência"><ExclamationTriangleIcon className="w-3 h-3"/></span>
                                            )}
                                        </div>
                                    </td>
                                    
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
        </div>
    );
});
