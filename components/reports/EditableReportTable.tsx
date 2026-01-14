
import React, { useState, useContext, memo, useCallback, useMemo } from 'react';
import { MatchResult } from '../../types';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { 
    PencilIcon, 
    ChevronUpIcon, 
    ChevronDownIcon, 
    TrashIcon, 
    ExclamationTriangleIcon, 
    ChevronLeftIcon, 
    ChevronRightIcon, 
    UserIcon,
    UserPlusIcon,
    SparklesIcon,
    BrainIcon,
    BanknotesIcon,
    ArrowUturnLeftIcon
} from '../Icons';
import { formatIncomeDescription } from '../../services/processingService';

type SortDirection = 'asc' | 'desc';
interface SortConfig {
    key: string;
    direction: SortDirection;
}

interface EditableReportTableProps {
    data: MatchResult[];
    onRowChange: (updatedRow: MatchResult) => void;
    reportType: 'income' | 'expenses';
    sortConfig: SortConfig | null;
    onSort: (key: string) => void;
    loadingAiId: string | null; 
    onEdit?: (row: MatchResult) => void;
}

const ITEMS_PER_PAGE = 50;

const SortableHeader: React.FC<{
    sortKey: string;
    title: string;
    sortConfig: SortConfig | null;
    onSort: (key: string) => void;
    className?: string;
}> = memo(({ sortKey, title, sortConfig, onSort, className = '' }) => {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <th scope="col" className={`px-4 py-3 text-left text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider ${className}`}>
            <button onClick={() => onSort(sortKey)} className="flex items-center gap-1.5 group hover:text-black dark:hover:text-white transition-colors focus:outline-none w-full justify-center">
                <span>{title}</span>
                <span className={`transition-all duration-200 ${isSorted ? 'opacity-100 text-brand-blue dark:text-blue-400' : 'opacity-0 group-hover:opacity-50'}`}>
                    {sortConfig?.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                </span>
            </button>
        </th>
    );
});

const MatchMethodIcon: React.FC<{ method: MatchResult['matchMethod'] }> = ({ method }) => {
    if (!method || method === 'AUTOMATIC') return null;

    const iconMap = {
        LEARNED: { Icon: BrainIcon, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400' },
        AI: { Icon: SparklesIcon, color: 'text-teal-500 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400' },
        MANUAL: { Icon: UserPlusIcon, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
        TEMPLATE: { Icon: SparklesIcon, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400' }
    };

    const config = iconMap[method];
    if (!config) return null;

    return (
        <span className={`ml-1.5 p-1 rounded-md ${config.color} inline-flex items-center justify-center`} title={method}>
            <config.Icon className="w-3 h-3" />
        </span>
    );
}

const IncomeRow = memo(({ 
    result, 
    language, 
    onEdit, 
    onDelete, 
    onUndo,
    openDivergence, 
    ignoreKeywords,
}: any) => {
    const row = result as MatchResult;
    const isIdentified = row.status === 'IDENTIFICADO';
    const isPendingList = row.status === 'PENDENTE';
    
    // --- Lógica de Data com Divergência Visual ---
    const bankDateRaw = row.transaction.date;
    const listDateRaw = row.contributor?.date;
    
    const bankDisplay = formatDate(bankDateRaw);
    const listDisplay = listDateRaw ? formatDate(listDateRaw) : null;
    
    const datesDiverge = isIdentified && listDisplay && bankDisplay !== listDisplay;

    const txDescFormatted = formatIncomeDescription(row.transaction.description, ignoreKeywords);
    
    // Nome: Contribuinte > Descrição Limpa
    const displayName = row.contributor?.name || txDescFormatted;
    
    // Tipos Separados para as duas linhas
    const contribType = row.contributor?.contributionType;
    const bankType = row.transaction.contributionType;
    
    const amount = isPendingList ? 0 : (row.contributorAmount ?? row.transaction.amount);
    const expectedAmount = isPendingList ? row.contributorAmount : 0;

    const getStatusBadge = () => {
        if (!isIdentified && !isPendingList) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 uppercase tracking-wide whitespace-nowrap">
                    Pendente
                </span>
            );
        }

        if (isPendingList) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 uppercase tracking-wide whitespace-nowrap">
                    Não Localizado
                </span>
            );
        }
        
        let bgClass = 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400';
        let label = 'Auto';

        if (row.matchMethod === 'MANUAL') {
            bgClass = 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400';
            label = 'Manual';
        } else if (row.matchMethod === 'AI') {
            bgClass = 'bg-teal-50 border-teal-100 text-teal-700 dark:bg-teal-900/30 dark:border-teal-800 dark:text-teal-400';
            label = 'IA';
        } else if (row.matchMethod === 'LEARNED') {
             bgClass = 'bg-purple-50 border-purple-100 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400';
             label = 'Aprendido';
        }

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wide whitespace-nowrap ${bgClass}`}>
                {label}
            </span>
        );
    };

    return (
        <tr className={`
            group 
            transition-colors 
            border-b border-slate-200 dark:border-slate-700 
            hover:bg-blue-50/60 dark:hover:bg-blue-900/20 
            ${isPendingList 
                ? 'bg-amber-50/50 dark:bg-amber-900/10' 
                : 'odd:bg-white even:bg-slate-50 dark:odd:bg-slate-800 dark:even:bg-slate-800/40'
            }
        `}>
            {/* Coluna Data com Destaque de Divergência */}
            <td className="px-4 py-2.5 font-mono text-[11px]">
                {datesDiverge ? (
                    <div className="flex flex-col leading-tight">
                        <span className="text-slate-500 dark:text-slate-400" title="Data Banco">{bankDisplay}</span>
                        <span className="text-amber-600 dark:text-amber-400 font-bold" title="Data Lista (Divergente)">{listDisplay}</span>
                    </div>
                ) : (
                    <span className="text-slate-500 dark:text-slate-400">{bankDisplay || listDisplay}</span>
                )}
            </td>
            
            {/* Coluna Nome/Descrição com Ícones Inline */}
            <td className="px-4 py-2.5">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        {(row.contributor || isPendingList) ? (
                            <UserIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" title="Origem: Lista de Contribuintes" />
                        ) : (
                            <BanknotesIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" title="Origem: Extrato Bancário" />
                        )}
                        
                        <span className={`text-xs font-bold leading-tight truncate max-w-[250px] ${isPendingList ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`} title={displayName}>
                            {displayName}
                        </span>
                    </div>

                    {isIdentified && displayName !== txDescFormatted && (
                        <div className="flex items-center gap-2 opacity-80">
                            <BanknotesIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" title="Origem: Extrato Bancário" />
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[250px]">
                                {txDescFormatted}
                            </span>
                        </div>
                    )}
                    
                    {isPendingList && (
                        <span className="text-[9px] text-red-400 pl-5 font-medium italic">
                            Não identificado no banco
                        </span>
                    )}
                </div>
            </td>
            
            <td className="px-4 py-2.5 text-center">
                <div className="flex items-center justify-center">
                    {getStatusBadge()}
                    {isIdentified && <MatchMethodIcon method={row.matchMethod} />}
                </div>
            </td>
            <td className="px-4 py-2.5 text-center">
                <span className={`text-[10px] font-bold ${row.similarity && row.similarity >= 90 ? 'text-emerald-600 dark:text-emerald-400' : row.similarity && row.similarity >= 70 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                    {row.similarity ? `${row.similarity.toFixed(0)}%` : '-'}
                </span>
            </td>
            
            <td className="px-4 py-2.5">
                <div className="flex flex-col gap-1.5 items-start">
                    {(row.contributor || isPendingList) && (
                        <div className="flex items-center gap-1.5" title="Tipo na Lista">
                            <UserIcon className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 px-1.5 py-0.5 rounded uppercase tracking-wide leading-none">
                                {contribType || '---'}
                            </span>
                        </div>
                    )}

                    {!isPendingList && (
                        <div className="flex items-center gap-1.5 opacity-80" title="Tipo no Extrato">
                            <BanknotesIcon className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-[9px] font-medium text-slate-600 bg-slate-100 border border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-700 px-1.5 py-0.5 rounded uppercase tracking-wide leading-none">
                                {bankType || '---'}
                            </span>
                        </div>
                    )}
                </div>
            </td>

            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                {isPendingList ? (
                    <div className="flex flex-col items-end">
                        <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 line-through">
                            0,00
                        </span>
                        <span className="text-[9px] text-slate-300 dark:text-slate-600 font-medium">
                            (Exp: {formatCurrency(expectedAmount, language)})
                        </span>
                    </div>
                ) : (
                    <span className={`font-mono text-xs font-bold tabular-nums tracking-tight ${amount < 0 ? 'text-red-600 dark:text-red-400 font-black' : 'text-slate-900 dark:text-white'}`}>
                        {formatCurrency(amount, language)}
                    </span>
                )}
            </td>
            <td className="px-4 py-2.5 text-center">
                <div className="flex gap-1 justify-center transition-opacity">
                    {!isIdentified && !isPendingList ? (
                        <div className="flex items-center justify-center gap-1">
                            <button 
                                onClick={() => onEdit(row)} 
                                className={`p-1.5 rounded-lg text-white transition-all shadow-md hover:-translate-y-0.5 ${
                                    row.suggestion 
                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 ring-1 ring-purple-300 dark:ring-purple-700' 
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'
                                }`}
                                title={row.suggestion ? "Identificar (Sugestão IA Disponível)" : "Identificar (IA + Manual)"}
                            >
                                {row.suggestion ? <SparklesIcon className="w-3.5 h-3.5 animate-pulse" /> : <UserPlusIcon className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => onDelete(row)} className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50 transition-colors shadow-sm opacity-0 group-hover:opacity-100" title="Excluir">
                                <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button onClick={() => onEdit(row)} className="p-1.5 rounded-lg text-brand-blue bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors shadow-sm" title="Editar / Corrigir">
                                <PencilIcon className="w-3.5 h-3.5" />
                            </button>
                            
                            {/* UNDO BUTTON */}
                            {isIdentified && (
                                <button onClick={() => onUndo(row.transaction.id)} className="p-1.5 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 transition-colors shadow-sm" title="Desfazer Identificação">
                                    <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                            
                            {row.divergence && <button onClick={() => openDivergence(row)} className="p-1.5 rounded-lg text-yellow-600 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50 transition-colors shadow-sm" title="Confirmar Divergência"><ExclamationTriangleIcon className="w-3.5 h-3.5" /></button>}
                            
                            <button onClick={() => onDelete(row)} className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50 transition-colors shadow-sm" title="Excluir">
                                <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
});

export const EditableReportTable: React.FC<EditableReportTableProps> = memo(({ data, onRowChange, reportType, sortConfig, onSort, loadingAiId, onEdit }) => {
    const { t, language } = useTranslation();
    const { 
        openDivergenceModal, 
        openDeleteConfirmation,
        openSmartEdit,
        undoIdentification // NEW
    } = useContext(AppContext);
    
    const handleEdit = useCallback((row: MatchResult) => {
        if (onEdit) {
            onEdit(row);
        } else {
            openSmartEdit(row);
        }
    }, [openSmartEdit, onEdit]);

    const handleDelete = useCallback((row: MatchResult) => {
        openDeleteConfirmation({ type: 'report-row', id: row.transaction.id, name: `Transação ${row.transaction.id}`, meta: { reportType } });
    }, [openDeleteConfirmation, reportType]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return data.slice(start, start + ITEMS_PER_PAGE);
    }, [data, currentPage]);

    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900">
            <div className="flex-1 w-full overflow-auto custom-scrollbar relative">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-200 dark:bg-slate-950 border-b-2 border-slate-300 dark:border-slate-600 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <SortableHeader sortKey="transaction.date" title={t('table.date')} sortConfig={sortConfig} onSort={onSort} className="w-[12%]" />
                            <SortableHeader sortKey={reportType === 'income' ? 'contributor.name' : 'transaction.description'} title={reportType === 'income' ? 'Nome / Contribuinte' : 'Descrição'} sortConfig={sortConfig} onSort={onSort} className="w-[35%]" />
                            <SortableHeader sortKey="status" title="Status" sortConfig={sortConfig} onSort={onSort} className="text-center w-[10%]" />
                            <SortableHeader sortKey="similarity" title="Simil." sortConfig={sortConfig} onSort={onSort} className="text-center w-[8%]" />
                            <SortableHeader sortKey="contributionType" title="Tipo" sortConfig={sortConfig} onSort={onSort} className="w-[12%]" />
                            <SortableHeader sortKey="transaction.amount" title={t('table.amount')} sortConfig={sortConfig} onSort={onSort} className="text-right w-[13%]" />
                            <SortableHeader sortKey="hasSuggestion" title={t('table.actions')} sortConfig={sortConfig} onSort={onSort} className="text-center w-[10%]" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {paginatedData.map(result => (
                            <IncomeRow 
                                key={result.transaction.id}
                                result={result}
                                t={t}
                                language={language}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onUndo={undoIdentification}
                                openDivergence={openDivergenceModal}
                                ignoreKeywords={[]}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex-shrink-0 flex justify-between items-center px-4 py-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-30">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Página {currentPage} de {totalPages}</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-colors"><ChevronLeftIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-colors"><ChevronRightIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
                    </div>
                </div>
            )}
        </div>
    );
});
