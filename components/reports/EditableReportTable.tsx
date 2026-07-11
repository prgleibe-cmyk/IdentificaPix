import React, { useState, useContext, memo, useCallback, useMemo, useEffect } from 'react';
import { MatchResult, ReconciliationStatus, MatchMethod } from '../../types';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { GitFork, Printer, X } from 'lucide-react';
import { 
    PencilIcon, 
    ChevronUpIcon, 
    ChevronDownIcon, 
    TrashIcon, 
    ChevronLeftIcon, 
    ChevronRightIcon, 
    UserIcon,
    UserPlusIcon,
    BanknotesIcon,
    ArrowUturnLeftIcon,
    CheckCircleIcon,
    BuildingOfficeIcon,
    LockClosedIcon,
    LockOpenIcon
} from '../Icons';
import { BulkActionToolbar } from '../BulkActionToolbar';
import { NameResolver } from '../../core/processors/NameResolver';

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
    onSplit?: (row: MatchResult) => void;
}

const ITEMS_PER_PAGE = 50;

const SortableHeader: React.FC<{
    sortKey: string;
    title: string;
    sortConfig: SortConfig | null;
    onSort: (key: string) => void;
    className?: string;
    align?: 'left' | 'center' | 'right';
}> = memo(({ sortKey, title, sortConfig, onSort, className = '', align = 'left' }) => {
    const isSorted = sortConfig?.key === sortKey;
    const justifyClass = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';
    
    return (
        <th scope="col" className={`px-4 py-3 text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider ${className}`}>
            <button 
                onClick={() => onSort(sortKey)} 
                className={`flex items-center gap-1.5 group hover:text-black dark:hover:text-white transition-colors focus:outline-none w-full ${justifyClass}`}
            >
                <span>{title}</span>
                <span className={`transition-all duration-200 ${isSorted ? 'opacity-100 text-brand-blue dark:text-blue-400' : 'opacity-0 group-hover:opacity-50'}`}>
                    {sortConfig?.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                </span>
            </button>
        </th>
    );
});

const MobileCard = memo(({ 
    result, 
    language, 
    onEdit, 
    onDelete, 
    onUndo,
    onToggleLock,
    onSplit,
    isSelected,
    onToggleSelection,
    onGenerateReceipt
}: any) => {
    const row = result as MatchResult;
    const confirmed = row.isConfirmed || row.transaction.isConfirmed;
    const isGhost = row.status === 'PENDENTE';
    const isIdentified = row.status === 'IDENTIFICADO';
    const displayAmount = isGhost ? (row.contributorAmount || row.contributor?.amount || 0) : row.transaction.amount;
    const isExpense = displayAmount < 0 || 
                      row.transaction?.type?.toLowerCase() === 'expense' || 
                      row.transaction?.type?.toLowerCase() === 'saida' || 
                      row.contributionType?.toLowerCase() === 'saída' || 
                      row.contributionType?.toLowerCase() === 'saida';
    const displayDate = formatDate(isGhost ? (row.contributor?.date || row.transaction.date) : row.transaction.date);
    const displayName = row.contributor?.name || row.contributor?.cleanedName || row.transaction.cleanedDescription || row.transaction.description;
    const displayForm = row.contributor?.paymentMethod || row.paymentMethod || row.transaction.paymentMethod || '---';

    return (
        <div className={`p-4 border-b border-slate-200 dark:border-slate-700 transition-colors ${isSelected ? 'bg-blue-50/80 dark:bg-blue-900/30' : 'bg-white dark:bg-slate-800'}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                    <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => onToggleSelection(row.transaction.id)}
                        className="w-5 h-5 rounded-full border-slate-300 text-brand-blue cursor-pointer accent-blue-600"
                    />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{displayDate}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                            {(row.contributor || isGhost) ? <UserIcon className="w-3.5 h-3.5 text-indigo-500" /> : <BanknotesIcon className="w-3.5 h-3.5 text-slate-400" />}
                            <span className={`text-sm font-black uppercase tracking-tight ${confirmed ? 'text-slate-500/70' : isGhost ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                {displayName}
                            </span>
                        </div>
                        {row.splits && row.splits.length > 0 && (
                            <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[8px]">Distribuição:</span>
                                <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                                    {row.splits.map((s, idx) => (
                                        <li key={s.id || idx}>
                                            <span className="uppercase text-slate-600 dark:text-slate-300">{s.contributionType}</span>: <span className="font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(s.amount, language)}</span> {s.description ? `(${s.description})` : ''}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-sm font-black tabular-nums ${isExpense ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                        {formatCurrency(displayAmount, language)}
                    </span>
                    <div className="mt-1">
                        {confirmed ? (
                            <span className="text-[8px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 uppercase inline-flex items-center gap-1">
                                <LockClosedIcon className="w-2 h-2" /> Fechado
                            </span>
                        ) : isIdentified ? (
                            <span className="text-[8px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 uppercase">Auto</span>
                        ) : (
                            <span className="text-[8px] font-black px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-100 uppercase">Pendente</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">
                <div className="flex items-center gap-1.5 truncate">
                    <BuildingOfficeIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{row.church?.name || '---'}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {row.splits && row.splits.length > 0 ? (
                        <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30 font-bold uppercase text-[9px]">Rateado</span>
                    ) : (
                        <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{row.contributor?.contributionType || row.contributionType || '---'}</span>
                    )}
                    <span>{displayForm}</span>
                </div>
            </div>

                    <div className="flex items-center justify-end gap-2 w-full">
                        <button 
                            onClick={() => onGenerateReceipt(row)} 
                            className="px-3.5 py-2 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors" 
                            title="Gerar Recibo"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Recibo</span>
                        </button>
                        {confirmed ? (
                            <button onClick={() => onToggleLock(row.transaction.id, false)} className="flex-1 py-2 rounded-xl text-indigo-600 bg-indigo-50 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                                <LockOpenIcon className="w-3.5 h-3.5" /> Abrir Registro
                            </button>
                        ) : (
                            <>
                                <button onClick={() => onDelete(row)} className="p-2.5 rounded-xl text-rose-600 bg-rose-50" title="Excluir"><TrashIcon className="w-4 h-4" /></button>
                                {isIdentified && <button onClick={() => onUndo(row.transaction.id)} className="p-2.5 rounded-xl text-amber-600 bg-amber-50" title="Desfazer auto-identificação"><ArrowUturnLeftIcon className="w-4 h-4" /></button>}
                                {onSplit && (
                                    <button 
                                        onClick={() => onSplit(row)} 
                                        className="px-3.5 py-2 rounded-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                                    >
                                        <GitFork className="w-3.5 h-3.5" /> Ratear
                                    </button>
                                )}
                            </>
                        )}
                    </div>
        </div>
    );
});

const IncomeRow = memo(({ 
    result, 
    language, 
    onEdit, 
    onDelete, 
    onUndo,
    onToggleLock,
    onSplit,
    isSelected,
    onToggleSelection,
    onGenerateReceipt
}: any) => {
    const row = result as MatchResult;
    // Fix: row.transaction.isConfirmed is now valid after updating Transaction interface
    const confirmed = row.isConfirmed || row.transaction.isConfirmed;
    const isGhost = row.status === 'PENDENTE';
    const isIdentified = row.status === 'IDENTIFICADO';
    const displayAmount = isGhost ? (row.contributorAmount || row.contributor?.amount || 0) : row.transaction.amount;
    const isExpense = displayAmount < 0 || 
                      row.transaction?.type?.toLowerCase() === 'expense' || 
                      row.transaction?.type?.toLowerCase() === 'saida' || 
                      row.contributionType?.toLowerCase() === 'saída' || 
                      row.contributionType?.toLowerCase() === 'saida';
    const displayDate = formatDate(isGhost ? (row.contributor?.date || row.transaction.date) : row.transaction.date);
    
    // FIDELIDADE TOTAL: Usa o valor original entregue pelo modelo/IA
    const displayName = row.contributor?.name || row.contributor?.cleanedName || row.transaction.cleanedDescription || row.transaction.description;

    const displayForm = row.contributor?.paymentMethod || row.paymentMethod || row.transaction.paymentMethod || '---';

    return (
        <tr className={`group transition-colors border-b border-slate-200 dark:border-slate-700 hover:bg-blue-50/60 dark:hover:bg-blue-900/20 ${confirmed ? 'bg-indigo-50/10' : isGhost ? 'bg-amber-50/50' : 'odd:bg-white even:bg-slate-50'} ${isSelected ? 'bg-blue-50/80 dark:bg-blue-900/30' : ''}`}>
            <td className="px-4 py-2.5 text-center">
                <input 
                    type="checkbox" 
                    checked={isSelected} 
                    onChange={() => onToggleSelection(row.transaction.id)}
                    className="w-4 h-4 rounded-full border-slate-300 text-brand-blue cursor-pointer accent-blue-600"
                />
            </td>
            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{displayDate}</td>
            <td className="px-4 py-2.5">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        {(row.contributor || isGhost) ? <UserIcon className="w-3.5 h-3.5 text-indigo-500" /> : <BanknotesIcon className="w-3.5 h-3.5 text-slate-400" />}
                        <span className={`text-xs font-bold break-words uppercase ${confirmed ? 'text-slate-500/70' : isGhost ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>{displayName}</span>
                    </div>
                    {row.splits && row.splits.length > 0 && (
                        <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[8px]">Distribuição:</span>
                            <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                                {row.splits.map((s, idx) => (
                                    <li key={s.id || idx}>
                                        <span className="uppercase text-slate-600 dark:text-slate-300">{s.contributionType}</span>: <span className="font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(s.amount, language)}</span> {s.description ? `(${s.description})` : ''}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </td>
            <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <BuildingOfficeIcon className={`w-3.5 h-3.5 shrink-0 ${isIdentified ? 'text-indigo-400' : 'text-slate-300'}`} />
                    <span className={`text-[11px] font-bold break-words ${isIdentified ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                        {row.church?.name || '---'}
                    </span>
                </div>
            </td>
            <td className="px-4 py-2.5 text-center">
                {confirmed ? (
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 uppercase flex items-center justify-center gap-1">
                        <LockClosedIcon className="w-2.5 h-2.5" /> Fechado
                    </span>
                ) : isIdentified ? (
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 uppercase">Auto</span>
                ) : (
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-100 uppercase">Pendente</span>
                )}
            </td>
            <td className="px-4 py-2.5">
                {row.splits && row.splits.length > 0 ? (
                    <span className="text-[9px] font-bold uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30">Rateado</span>
                ) : (
                    <span className="text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">{row.contributor?.contributionType || row.contributionType || '---'}</span>
                )}
            </td>
            <td className="px-4 py-2.5"><span className="text-[10px] font-bold text-slate-500 uppercase">{displayForm}</span></td>
            <td className="px-4 py-2.5 text-right font-mono text-xs font-bold tabular-nums">
                <span className={isExpense ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}>
                    {formatCurrency(displayAmount, language)}
                </span>
            </td>
            <td className="px-4 py-2.5 text-center">
                <div className="flex gap-1.5 items-center justify-center">
                    {/* Todas as ações visíveis no hover */}
                    <div className="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button 
                            onClick={() => onGenerateReceipt(row)} 
                            className="p-1.5 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-all border border-blue-100/50 dark:border-blue-900/20 cursor-pointer shadow-sm" 
                            title="Gerar e Imprimir Recibo"
                        >
                            <Printer className="w-3.5 h-3.5" />
                        </button>

                        {confirmed ? (
                            <button onClick={() => onToggleLock(row.transaction.id, false)} className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 cursor-pointer" title="Remover Bloqueio">
                                <LockOpenIcon className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <>
                                {isIdentified && <button onClick={() => onUndo(row.transaction.id)} className="p-1.5 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 cursor-pointer" title="Desfazer auto-identificação"><ArrowUturnLeftIcon className="w-3.5 h-3.5" /></button>}
                                <button onClick={() => onDelete(row)} className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 cursor-pointer" title="Excluir"><TrashIcon className="w-3.5 h-3.5" /></button>
                                {onSplit && (
                                    <button 
                                        onClick={() => onSplit(row)} 
                                        className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer" 
                                        title="Desmembrar / Ratear Lançamento"
                                    >
                                        <GitFork className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </td>
        </tr>
    );
});

function valorPorExtenso(valor: number): string {
    if (!valor || valor <= 0) return 'zero reais';
    
    const centavos = Math.round((valor % 1) * 100);
    const inteiro = Math.floor(valor);
    
    const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const dezenas = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const dezenaComposta = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    
    function convertGroup(n: number): string {
        if (n === 100) return 'cem';
        let parts: string[] = [];
        const c = Math.floor(n / 100);
        const d = Math.floor((n % 100) / 10);
        const u = n % 10;
        
        if (c > 0) parts.push(centenas[c]);
        
        if (d === 1) {
            parts.push(dezenaComposta[u]);
        } else {
            if (d > 1) parts.push(dezenas[d]);
            if (u > 0) parts.push(unidades[u]);
        }
        
        return parts.join(' e ');
    }
    
    let extenso = '';
    
    if (inteiro > 0) {
        if (inteiro === 1) {
            extenso = 'um real';
        } else if (inteiro < 1000) {
            extenso = convertGroup(inteiro) + ' reais';
        } else if (inteiro < 1000000) {
            const milhar = Math.floor(inteiro / 1000);
            const resto = inteiro % 1000;
            const milharStr = milhar === 1 ? 'mil' : convertGroup(milhar) + ' mil';
            const restoStr = resto > 0 ? (resto < 100 || resto % 100 === 0 ? ' e ' : ' ') + convertGroup(resto) : '';
            extenso = milharStr + restoStr + ' reais';
        } else {
            extenso = inteiro.toLocaleString('pt-BR') + ' reais';
        }
    }
    
    if (centavos > 0) {
        const centavosStr = centavos === 1 ? 'um centavo' : convertGroup(centavos) + ' centavos';
        if (inteiro > 0) {
            extenso += ' e ' + centavosStr;
        } else {
            extenso = centavosStr;
        }
    }
    
    return extenso.charAt(0).toUpperCase() + extenso.slice(1);
}

export const EditableReportTable: React.FC<EditableReportTableProps> = memo(({ data, reportType, sortConfig, onSort, onEdit, onSplit }) => {
    const { t, language } = useTranslation();
    const { openDeleteConfirmation, undoIdentification, toggleConfirmation, churches } = useContext(AppContext);
    
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedReceipt, setSelectedReceipt] = useState<MatchResult | null>(null);
    
    useEffect(() => {
        setSelectedIds([]);
    }, [data.length]);

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }, []);

    const toggleAll = useCallback(() => {
        if (selectedIds.length === data.length && data.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(data.map(r => r.transaction.id));
        }
    }, [data, selectedIds]);

    const [currentPage, setCurrentPage] = useState(1);

    const receiptAmount = selectedReceipt ? Math.abs(selectedReceipt.contributorAmount || selectedReceipt.contributor?.amount || selectedReceipt.transaction.amount) : 0;
    const receiptFormattedAmount = selectedReceipt ? formatCurrency(receiptAmount, language) : '';
    const receiptAmountExtenso = selectedReceipt ? valorPorExtenso(receiptAmount) : '';
    const receiptDisplayName = selectedReceipt ? (selectedReceipt.contributor?.name || selectedReceipt.contributor?.cleanedName || selectedReceipt.transaction.cleanedDescription || selectedReceipt.transaction.description) : '';
    const receiptDisplayDescription = selectedReceipt ? (selectedReceipt.contributionType || selectedReceipt.transaction.description || 'Despesa Geral') : '';
    const receiptDisplayCategory = selectedReceipt ? (selectedReceipt.contributionType || 'Contribuição / Dízimo') : '';
    const receiptFullChurch = selectedReceipt ? (churches?.find((c: any) => c.id === selectedReceipt.church?.id) || churches?.[0] || selectedReceipt.church) : null;
    const receiptDisplayChurch = receiptFullChurch?.name || selectedReceipt?.church?.name || '---';
    const receiptDisplayForm = selectedReceipt ? (selectedReceipt.contributor?.paymentMethod || selectedReceipt.paymentMethod || selectedReceipt.transaction.paymentMethod || '---') : '---';
    const receiptDisplayDate = selectedReceipt ? formatDate(selectedReceipt.contributor?.date || selectedReceipt.transaction.date) : '';
    const receiptIsExpense = selectedReceipt ? (selectedReceipt.contributorAmount || selectedReceipt.contributor?.amount || selectedReceipt.transaction.amount) < 0 : false;
    const receiptRecordId = selectedReceipt ? selectedReceipt.transaction.id : '';

    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);

    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds([]);
    }, [reportType]);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [data.length, totalPages, currentPage]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return data.slice(start, start + ITEMS_PER_PAGE);
    }, [data, currentPage]);

    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 relative">
            <BulkActionToolbar selectedIds={selectedIds} results={data} onClear={() => setSelectedIds([])} />
            <div className="flex-1 w-full overflow-auto custom-scrollbar relative">
                {/* Desktop Table View */}
                <table className="hidden md:table w-full text-left border-collapse">
                    <thead className="bg-slate-200 dark:bg-slate-950 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="px-4 py-3 w-10 text-center">
                                <input 
                                    type="checkbox" 
                                    onChange={toggleAll}
                                    checked={selectedIds.length > 0 && selectedIds.length === data.length}
                                    className="w-4 h-4 rounded-full border-slate-300 text-brand-blue cursor-pointer accent-blue-600"
                                />
                            </th>
                            <SortableHeader sortKey="transaction.date" title={t('table.date')} sortConfig={sortConfig} onSort={onSort} className="w-[10%]" align="left" />
                            <SortableHeader 
                                sortKey={reportType === 'income' ? 'contributor.name' : 'transaction.description'} 
                                title={reportType === 'income' ? 'Nome / Contribuinte' : 'Descrição'} 
                                sortConfig={sortConfig} 
                                onSort={onSort} 
                                className="w-[25%]" 
                                align="left"
                            />
                            <SortableHeader sortKey="church.name" title="Igreja" sortConfig={sortConfig} onSort={onSort} className="w-[15%]" align="left" />
                            <SortableHeader sortKey="status" title="Status" sortConfig={sortConfig} onSort={onSort} className="w-[10%]" align="center" />
                            <SortableHeader sortKey="contributionType" title="Tipo" sortConfig={sortConfig} onSort={onSort} className="w-[12%]" align="left" />
                            <SortableHeader sortKey="paymentMethod" title="Forma" sortConfig={sortConfig} onSort={onSort} className="w-[12%]" align="left" />
                            <SortableHeader sortKey="transaction.amount" title={t('table.amount')} sortConfig={sortConfig} onSort={onSort} className="w-[13%]" align="right" />
                            <SortableHeader sortKey="status" title="Ações" sortConfig={sortConfig} onSort={onSort} className="w-[8%]" align="center" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {paginatedData.map(result => (
                            <IncomeRow 
                                key={result.transaction.id}
                                result={result}
                                language={language}
                                isSelected={selectedIds.includes(result.transaction.id)}
                                onToggleSelection={toggleSelection}
                                onEdit={() => {}}
                                onDelete={(row: MatchResult) => openDeleteConfirmation({ type: 'report-row', id: row.transaction.id, name: `Transação ${row.transaction.id}`, meta: { reportType } })}
                                onUndo={undoIdentification}
                                onToggleLock={(id: string, lock: boolean) => toggleConfirmation([id], lock)}
                                onSplit={onSplit}
                                onGenerateReceipt={setSelectedReceipt}
                            />
                        ))}
                    </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                onChange={toggleAll}
                                checked={selectedIds.length > 0 && selectedIds.length === data.length}
                                className="w-5 h-5 rounded-full border-slate-300 text-brand-blue cursor-pointer accent-blue-600"
                            />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Selecionar Todos</span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{data.length} registros</span>
                    </div>
                    {paginatedData.map(result => (
                        <MobileCard 
                            key={result.transaction.id}
                            result={result}
                            language={language}
                            isSelected={selectedIds.includes(result.transaction.id)}
                            onToggleSelection={toggleSelection}
                            onEdit={() => {}}
                            onDelete={(row: MatchResult) => openDeleteConfirmation({ type: 'report-row', id: row.transaction.id, name: `Transação ${row.transaction.id}`, meta: { reportType } })}
                            onUndo={undoIdentification}
                            onToggleLock={(id: string, lock: boolean) => toggleConfirmation([id], lock)}
                            onSplit={onSplit}
                            onGenerateReceipt={setSelectedReceipt}
                        />
                    ))}
                </div>
            </div>
            {data.length > ITEMS_PER_PAGE && (
                <div className="flex-shrink-0 flex justify-between items-center px-4 py-3 bg-white border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500">Página {currentPage} de {Math.ceil(data.length / ITEMS_PER_PAGE)}</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30"><ChevronLeftIcon className="w-4 h-4" /></button>
                        <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(data.length / ITEMS_PER_PAGE), p + 1))} disabled={currentPage === Math.ceil(data.length / ITEMS_PER_PAGE)} className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30"><ChevronRightIcon className="w-4 h-4" /></button>
                    </div>
                </div>
            )}

            {/* Receipt Preview & Printing Modal */}
            {selectedReceipt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in text-slate-950">
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2.5rem] w-full max-w-2xl shadow-2xl p-8 space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-white/5">
                            <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                Comprovante de Lançamento / Recibo
                            </h3>
                            <button
                                onClick={() => setSelectedReceipt(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-full transition-all cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Preview Section */}
                        <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-2xl border border-slate-100 dark:border-white/5 overflow-x-auto">
                            <div id="receipt-print-area" className="bg-white text-slate-900 p-8 rounded-xl shadow-sm border border-slate-200 max-w-xl mx-auto font-sans">
                                {/* Receipt Header */}
                                <div className="flex gap-4 items-center border-b-2 border-indigo-500 pb-4 mb-6">
                                    {receiptFullChurch?.logoUrl ? (
                                        <img 
                                            src={receiptFullChurch.logoUrl} 
                                            alt={receiptDisplayChurch} 
                                            className="w-12 h-12 object-contain rounded-lg border border-slate-100 bg-slate-50 p-0.5"
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-indigo-600 text-base">
                                            {receiptDisplayChurch ? receiptDisplayChurch.substring(0, 2).toUpperCase() : 'IP'}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">
                                            {receiptDisplayChurch}
                                        </h1>
                                        {receiptFullChurch?.address && (
                                            <p className="text-[10px] text-slate-500 font-medium truncate">
                                                {receiptFullChurch.address}
                                            </p>
                                        )}
                                        {receiptFullChurch?.pastor && (
                                            <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-wide mt-0.5">
                                                Pastor: {receiptFullChurch.pastor}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 inline-block">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase block tracking-wider">Valor</span>
                                            <span className="text-base font-black text-slate-900 font-mono leading-none">
                                                {receiptFormattedAmount}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Title */}
                                <div className="text-center mb-6">
                                    <h2 className="text-base font-black text-slate-800 uppercase tracking-wide">
                                        {receiptIsExpense ? 'Recibo de Pagamento / Saída' : 'Recibo de Entrada / Contribuição'}
                                    </h2>
                                    <p className="text-[9px] text-slate-400 font-mono mt-1">
                                        Nº do Registro: <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{receiptRecordId}</span>
                                    </p>
                                </div>

                                {/* Body text */}
                                <div className="text-xs leading-relaxed text-slate-700 mb-6 text-justify bg-slate-50 border border-slate-100 rounded-xl p-4 border-dashed">
                                    {receiptIsExpense ? (
                                        <>
                                            Declaramos que pagamos a importância de <strong className="text-slate-900">{receiptFormattedAmount}</strong> (<span className="italic font-semibold">{receiptAmountExtenso}</span>) a <strong className="text-slate-900 uppercase">{receiptDisplayName}</strong>, referente a <strong className="text-slate-900 uppercase">{receiptDisplayDescription}</strong>.
                                        </>
                                    ) : (
                                        <>
                                            Confirmamos o recebimento da importância de <strong className="text-slate-900">{receiptFormattedAmount}</strong> (<span className="italic font-semibold">{receiptAmountExtenso}</span>) de <strong className="text-slate-900 uppercase">{receiptDisplayName}</strong>, referente a <strong className="text-slate-900 uppercase">{receiptDisplayCategory}</strong>.
                                        </>
                                    )}
                                </div>

                                {/* Meta details */}
                                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-150 mb-8">
                                    <div>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase block tracking-wider mb-0.5">Igreja Destinação</span>
                                        <span className="font-extrabold text-slate-800 uppercase">{receiptDisplayChurch}</span>
                                    </div>
                                    <div>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase block tracking-wider mb-0.5">Forma de Pagamento</span>
                                        <span className="font-extrabold text-slate-800 uppercase">{receiptDisplayForm}</span>
                                    </div>
                                    <div>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase block tracking-wider mb-0.5">Data da Transação</span>
                                        <span className="font-bold text-slate-700 font-mono">{receiptDisplayDate}</span>
                                    </div>
                                    <div>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase block tracking-wider mb-0.5">Data de Emissão</span>
                                        <span className="font-bold text-slate-700 font-mono">{new Date().toLocaleDateString('pt-BR')}</span>
                                    </div>
                                </div>

                                {/* Signature block */}
                                <div className="grid grid-cols-2 gap-8 mt-12 pt-6">
                                    <div className="text-center">
                                        <div className="border-t border-slate-300 w-full mb-1"></div>
                                        <span className="text-[9px] font-bold text-slate-600 uppercase block">
                                            {receiptIsExpense ? 'Favorecido / Recebedor' : 'Contribuinte'}
                                        </span>
                                    </div>
                                    <div className="text-center">
                                        <div className="border-t border-slate-300 w-full mb-1"></div>
                                        <span className="text-[9px] font-bold text-slate-600 uppercase block">Responsável Financeiro</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                            <button
                                onClick={() => setSelectedReceipt(null)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={() => {
                                    const todayFormatted = new Date().toLocaleDateString('pt-BR');
                                    const isExpense = receiptIsExpense;
                                    const recordId = receiptRecordId;

                                    const printTime = new Date().toLocaleTimeString('pt-BR');
                                    const htmlContent = `
                                        <div style="max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); background-color: white; color: #1e293b; font-family: 'Inter', system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                                            <!-- HEADER -->
                                            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 24px; margin-bottom: 30px; gap: 20px;">
                                                <div style="display: flex; align-items: center; gap: 16px;">
                                                    ${receiptFullChurch?.logoUrl ? `
                                                        <img src="${receiptFullChurch.logoUrl}" alt="${receiptDisplayChurch}" style="width: 60px; height: 60px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; padding: 4px; background: #f8fafc;" referrerPolicy="no-referrer" />
                                                    ` : `
                                                        <div style="width: 60px; height: 60px; border-radius: 8px; background: #eff6ff; border: 1px solid #bfdbfe; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #2563eb;">
                                                            ${(receiptDisplayChurch || 'IP').substring(0, 2).toUpperCase()}
                                                        </div>
                                                    `}
                                                    <div>
                                                        <h1 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: -0.02em;">${receiptDisplayChurch}</h1>
                                                        ${receiptFullChurch?.address ? `<p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0; font-weight: 500;">${receiptFullChurch.address}</p>` : ''}
                                                        ${receiptFullChurch?.pastor ? `<p style="font-size: 10px; color: #2563eb; margin: 4px 0 0 0; font-weight: 700; text-transform: uppercase;">Pastor: ${receiptFullChurch.pastor}</p>` : ''}
                                                    </div>
                                                </div>
                                                <div style="text-align: right; flex-shrink: 0;">
                                                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 24px; display: inline-block;">
                                                        <span style="font-size: 9px; font-weight: 800; color: #64748b; display: block; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Valor do Recibo</span>
                                                        <span style="font-size: 22px; font-weight: 900; color: #1e3a8a; font-family: monospace; letter-spacing: -0.02em;">${receiptFormattedAmount}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style="text-align: center; margin-bottom: 35px;">
                                                <h2 style="font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; position: relative; display: inline-block; padding-bottom: 8px;">
                                                    ${isExpense ? 'Recibo de Pagamento / Saída' : 'Recibo de Entrada / Contribuição'}
                                                </h2>
                                                <p style="font-size: 11px; color: #64748b; margin: 8px 0 0 0; font-weight: 600;">Nº do Registro: <span style="font-family: monospace; font-weight: 800; color: #0f172a; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${recordId}</span></p>
                                            </div>

                                            <div style="font-size: 14px; line-height: 1.8; color: #334155; margin-bottom: 40px; text-align: justify; border-bottom: 1px dashed #cbd5e1; padding-bottom: 35px; background: #fafafa; padding: 24px; border-radius: 12px; border: 1px solid #f3f4f6;">
                                                ${isExpense 
                                                    ? `Declaramos que pagamos a importância de <strong style="color: #0f172a;">${receiptFormattedAmount}</strong> (<span style="font-style: italic; font-weight: 600;">${receiptAmountExtenso}</span>) a <strong style="color: #0f172a; text-transform: uppercase;">${receiptDisplayName.toUpperCase()}</strong>, referente a <strong style="color: #0f172a; text-transform: uppercase;">${receiptDisplayDescription.toUpperCase()}</strong>.`
                                                    : `Confirmamos o recebimento da importância de <strong style="color: #0f172a;">${receiptFormattedAmount}</strong> (<span style="font-style: italic; font-weight: 600;">${receiptAmountExtenso}</span>) de <strong style="color: #0f172a; text-transform: uppercase;">${receiptDisplayName.toUpperCase()}</strong>, referente a <strong style="color: #0f172a; text-transform: uppercase;">${receiptDisplayCategory.toUpperCase()}</strong>.`
                                                }
                                            </div>

                                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 50px; background-color: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
                                                <div>
                                                    <span style="font-size: 9px; font-weight: 800; color: #64748b; display: block; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Igreja Destinação</span>
                                                    <span style="font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase;">${receiptDisplayChurch}</span>
                                                </div>
                                                <div>
                                                    <span style="font-size: 9px; font-weight: 800; color: #64748b; display: block; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Forma de Pagamento</span>
                                                    <span style="font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase;">${receiptDisplayForm}</span>
                                                </div>
                                                <div style="margin-top: 10px;">
                                                    <span style="font-size: 9px; font-weight: 800; color: #64748b; display: block; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Data da Transação</span>
                                                    <span style="font-size: 13px; font-weight: 700; color: #0f172a; font-family: monospace;">${receiptDisplayDate}</span>
                                                </div>
                                                <div style="margin-top: 10px;">
                                                    <span style="font-size: 9px; font-weight: 800; color: #64748b; display: block; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Data de Emissão do Recibo</span>
                                                    <span style="font-size: 13px; font-weight: 700; color: #0f172a; font-family: monospace;">${todayFormatted}</span>
                                                </div>
                                            </div>

                                            <div style="display: flex; justify-content: space-between; gap: 40px; margin-top: 60px;">
                                                <div style="flex: 1; text-align: center;">
                                                    <div style="border-top: 1px solid #cbd5e1; width: 100%; margin-bottom: 8px;"></div>
                                                    <span style="font-size: 11px; font-weight: 700; color: #334155; display: block; text-transform: uppercase;">${isExpense ? 'Favorecido / Recebedor' : 'Contribuinte'}</span>
                                                    <span style="font-size: 10px; color: #64748b; display: block; margin-top: 2px;">Assinatura</span>
                                                </div>
                                                <div style="flex: 1; text-align: center;">
                                                    <div style="border-top: 1px solid #cbd5e1; width: 100%; margin-bottom: 8px;"></div>
                                                    <span style="font-size: 11px; font-weight: 700; color: #334155; display: block; text-transform: uppercase;">Responsável Financeiro</span>
                                                    <span style="font-size: 10px; color: #64748b; display: block; margin-top: 2px;">Assinatura</span>
                                                </div>
                                            </div>

                                            <!-- FOOTER -->
                                            <div style="border-top: 1px solid #e2e8f0; margin-top: 60px; padding-top: 16px; text-align: center; font-size: 10px; color: #94a3b8; font-weight: 500;">
                                                Documento emitido eletronicamente via <strong>IdentificaPix</strong> em ${todayFormatted} às ${printTime} - Todos os direitos reservados.
                                            </div>
                                        </div>
                                    `;
                                    
                                    const iframe = document.createElement('iframe');
                                    iframe.style.position = 'absolute';
                                    iframe.style.width = '0px';
                                    iframe.style.height = '0px';
                                    iframe.style.border = 'none';
                                    document.body.appendChild(iframe);
                                    
                                    const iframeDoc = iframe.contentWindow?.document;
                                    if (iframeDoc) {
                                        iframeDoc.open();
                                        iframeDoc.write(`
                                            <html>
                                                <head>
                                                    <title>Recibo - ${recordId}</title>
                                                    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                                                    <style>
                                                        body {
                                                            font-family: 'Inter', sans-serif;
                                                            background-color: white;
                                                            color: black;
                                                            padding: 20px;
                                                        }
                                                        @media print {
                                                            body {
                                                                padding: 0;
                                                            }
                                                        }
                                                    </style>
                                                </head>
                                                <body onload="window.print(); setTimeout(function() { window.frameElement.remove(); }, 1500);">
                                                    ${htmlContent}
                                                </body>
                                            </html>
                                        `);
                                        iframeDoc.close();
                                    }
                                }}
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
                            >
                                <Printer className="w-4 h-4" />
                                Imprimir Recibo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});