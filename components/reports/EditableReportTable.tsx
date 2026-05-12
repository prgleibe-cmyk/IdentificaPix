import React, { useState, useContext, memo, useCallback, useMemo, useEffect, useRef } from 'react';
import { MatchResult, ReconciliationStatus, MatchMethod } from '../../types';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
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
}

const ROW_HEIGHT_DESKTOP = 48;
const ROW_HEIGHT_MOBILE = 145;
const OVERSCAN = 10;

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
    isSelected,
    onToggleSelection
}: any) => {
    const row = result as MatchResult;
    const confirmed = row.isConfirmed || row.transaction.isConfirmed;
    const isGhost = row.status === 'PENDENTE';
    const isIdentified = row.status === 'IDENTIFICADO';
    const displayAmount = isGhost ? (row.contributorAmount || row.contributor?.amount || 0) : row.transaction.amount;
    const isExpense = displayAmount < 0;
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
                    <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{row.contributor?.contributionType || row.contributionType || '---'}</span>
                    <span>{displayForm}</span>
                </div>
            </div>

                    <div className="flex items-center justify-end gap-2">
                {confirmed ? (
                    <button onClick={() => onToggleLock(row.transaction.id, false)} className="flex-1 py-2 rounded-xl text-indigo-600 bg-indigo-50 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                        <LockOpenIcon className="w-3.5 h-3.5" /> Abrir Registro
                    </button>
                ) : (
                    <>
                        <button onClick={() => onDelete(row)} className="p-2.5 rounded-xl text-rose-600 bg-rose-50"><TrashIcon className="w-4 h-4" /></button>
                        {isIdentified && <button onClick={() => onUndo(row.transaction.id)} className="p-2.5 rounded-xl text-amber-600 bg-amber-50"><ArrowUturnLeftIcon className="w-4 h-4" /></button>}
                        <div className="flex-1" />
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
    isSelected,
    onToggleSelection
}: any) => {
    const row = result as MatchResult;
    // Fix: row.transaction.isConfirmed is now valid after updating Transaction interface
    const confirmed = row.isConfirmed || row.transaction.isConfirmed;
    const isGhost = row.status === 'PENDENTE';
    const isIdentified = row.status === 'IDENTIFICADO';
    const displayAmount = isGhost ? (row.contributorAmount || row.contributor?.amount || 0) : row.transaction.amount;
    const isExpense = displayAmount < 0;
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
            <td className="px-4 py-2.5"><span className="text-[9px] font-bold uppercase bg-slate-100 px-1.5 py-0.5 rounded">{row.contributor?.contributionType || row.contributionType || '---'}</span></td>
            <td className="px-4 py-2.5"><span className="text-[10px] font-bold text-slate-500 uppercase">{displayForm}</span></td>
            <td className="px-4 py-2.5 text-right font-mono text-xs font-bold tabular-nums">
                <span className={isExpense ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}>
                    {formatCurrency(displayAmount, language)}
                </span>
            </td>
            <td className="px-4 py-2.5 text-center">
                <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {confirmed ? (
                        <button onClick={() => onToggleLock(row.transaction.id, false)} className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50" title="Remover Bloqueio">
                            <LockOpenIcon className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        <>
                            {isIdentified && <button onClick={() => onUndo(row.transaction.id)} className="p-1.5 rounded-lg text-amber-600 bg-amber-50"><ArrowUturnLeftIcon className="w-3.5 h-3.5" /></button>}
                            <button onClick={() => onDelete(row)} className="p-1.5 rounded-lg text-rose-600 bg-rose-50"><TrashIcon className="w-3.5 h-3.5" /></button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
});

export const EditableReportTable: React.FC<EditableReportTableProps> = memo(({ data, reportType, sortConfig, onSort, onEdit }) => {
    const { t, language } = useTranslation();
    const { openDeleteConfirmation, undoIdentification, toggleConfirmation } = useContext(AppContext);
    
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 40 });
    const containerRef = useRef<HTMLDivElement>(null);
    
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

    const handleScroll = useCallback(() => {
        if (!containerRef.current) return;

        const { scrollTop, clientHeight } = containerRef.current;
        const isMobile = window.innerWidth < 768;
        const rowHeight = isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP;

        const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
        const end = Math.min(data.length, Math.ceil((scrollTop + clientHeight) / rowHeight) + OVERSCAN);

        setVisibleRange(prev => {
            if (prev.start === start && prev.end === end) return prev;
            console.log(`[VIRTUAL_LIST:VISIBLE_RANGE] start: ${start}, end: ${end}, total: ${data.length}`);
            return { start, end };
        });
    }, [data.length]);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll, { passive: true });
            handleScroll(); // Initial calc
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    // Reset scroll and range when data changes significantly (e.g. new report)
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
            setVisibleRange({ start: 0, end: 40 });
            console.log('[VIRTUAL_LIST:SKIP_FULL_RENDER] Lista reiniciada devido a mudança de dados.');
        }
    }, [data.length]);

    const virtualizedData = useMemo(() => {
        return data.slice(visibleRange.start, visibleRange.end);
    }, [data, visibleRange]);

    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    const rowHeight = isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP;
    const spacerTopHeight = visibleRange.start * rowHeight;
    const spacerBottomHeight = Math.max(0, (data.length - visibleRange.end) * rowHeight);

    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 relative">
            <BulkActionToolbar selectedIds={selectedIds} results={data} onClear={() => setSelectedIds([])} />
            <div ref={containerRef} className="flex-1 w-full overflow-auto custom-scrollbar relative">
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
                        {spacerTopHeight > 0 && (
                            <tr><td colSpan={10} style={{ height: `${spacerTopHeight}px` }}></td></tr>
                        )}
                        {virtualizedData.map(result => {
                            return (
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
                                />
                            );
                        })}
                        {spacerBottomHeight > 0 && (
                            <tr><td colSpan={10} style={{ height: `${spacerBottomHeight}px` }}></td></tr>
                        )}
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
                    
                    {spacerTopHeight > 0 && <div style={{ height: `${spacerTopHeight}px` }} />}
                    {virtualizedData.map(result => {
                        return (
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
                            />
                        );
                    })}
                    {spacerBottomHeight > 0 && <div style={{ height: `${spacerBottomHeight}px` }} />}
                </div>
            </div>
        </div>
    );
});