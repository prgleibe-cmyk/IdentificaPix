
import React, { useState, useContext, memo, useCallback, useMemo, useEffect } from 'react';
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
    BuildingOfficeIcon
} from '../Icons';
import { formatIncomeDescription } from '../../services/processingService';
import { BulkActionToolbar } from '../BulkActionToolbar';

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

const IncomeRow = memo(({ 
    result, 
    language, 
    onEdit, 
    onDelete, 
    onUndo,
    ignoreKeywords,
    isSelected,
    onToggleSelection
}: any) => {
    const row = result as MatchResult;
    const isGhost = row.status === 'PENDENTE';
    const isIdentified = row.status === 'IDENTIFICADO';
    const displayAmount = isGhost ? (row.contributorAmount || row.contributor?.amount || 0) : row.transaction.amount;
    const displayDate = formatDate(isGhost ? (row.contributor?.date || row.transaction.date) : row.transaction.date);
    const txDescFormatted = formatIncomeDescription(row.transaction.description, ignoreKeywords);
    const displayName = row.contributor?.name || row.contributor?.cleanedName || txDescFormatted;
    const displayForm = row.contributor?.paymentMethod || row.paymentMethod || row.transaction.paymentMethod || '---';

    return (
        <tr className={`group transition-colors border-b border-slate-200 dark:border-slate-700 hover:bg-blue-50/60 dark:hover:bg-blue-900/20 ${isGhost ? 'bg-amber-50/50' : 'odd:bg-white even:bg-slate-50'} ${isSelected ? 'bg-blue-50/80 dark:bg-blue-900/30' : ''}`}>
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
                        <span className={`text-xs font-bold truncate max-w-[250px] ${isGhost ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>{displayName}</span>
                    </div>
                </div>
            </td>
            <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <BuildingOfficeIcon className={`w-3.5 h-3.5 shrink-0 ${isIdentified ? 'text-indigo-400' : 'text-slate-300'}`} />
                    <span className={`text-[11px] font-bold truncate max-w-[150px] ${isIdentified ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                        {row.church?.name || '---'}
                    </span>
                </div>
            </td>
            <td className="px-4 py-2.5 text-center">
                {isIdentified ? <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 uppercase">Auto</span> : <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-100 uppercase">Pendente</span>}
            </td>
            <td className="px-4 py-2.5"><span className="text-[9px] font-bold uppercase bg-slate-100 px-1.5 py-0.5 rounded">{row.contributor?.contributionType || '---'}</span></td>
            <td className="px-4 py-2.5"><span className="text-[10px] font-bold text-slate-500 uppercase">{displayForm}</span></td>
            <td className="px-4 py-2.5 text-right font-mono text-xs font-bold">{formatCurrency(displayAmount, language)}</td>
            <td className="px-4 py-2.5 text-center">
                <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isIdentified && !isGhost ? (
                        <button onClick={() => onEdit(row)} className="p-1.5 rounded-lg bg-brand-blue text-white shadow-sm"><UserPlusIcon className="w-3.5 h-3.5" /></button>
                    ) : (
                        <>
                            <button onClick={() => onEdit(row)} className="p-1.5 rounded-lg text-brand-blue bg-blue-50"><PencilIcon className="w-3.5 h-3.5" /></button>
                            {isIdentified && <button onClick={() => onUndo(row.transaction.id)} className="p-1.5 rounded-lg text-amber-600 bg-amber-50"><ArrowUturnLeftIcon className="w-3.5 h-3.5" /></button>}
                        </>
                    )}
                    <button onClick={() => onDelete(row)} className="p-1.5 rounded-lg text-rose-600 bg-rose-50"><TrashIcon className="w-3.5 h-3.5" /></button>
                </div>
            </td>
        </tr>
    );
});

export const EditableReportTable: React.FC<EditableReportTableProps> = memo(({ data, reportType, sortConfig, onSort, onEdit }) => {
    const { t, language } = useTranslation();
    const { openDeleteConfirmation, openSmartEdit, undoIdentification } = useContext(AppContext);
    
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
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
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return data.slice(start, start + ITEMS_PER_PAGE);
    }, [data, currentPage]);

    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 relative">
            <BulkActionToolbar selectedIds={selectedIds} onClear={() => setSelectedIds([])} />
            <div className="flex-1 w-full overflow-auto custom-scrollbar relative">
                <table className="w-full text-left border-collapse">
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
                            <SortableHeader sortKey="transaction.date" title={t('table.date')} sortConfig={sortConfig} onSort={onSort} className="w-[10%]" />
                            <SortableHeader sortKey={reportType === 'income' ? 'contributor.name' : 'transaction.description'} title={reportType === 'income' ? 'Nome / Contribuinte' : 'Descrição'} sortConfig={sortConfig} onSort={onSort} className="w-[25%]" />
                            <SortableHeader sortKey="church.name" title="Igreja" sortConfig={sortConfig} onSort={onSort} className="w-[15%]" />
                            <SortableHeader sortKey="status" title="Status" sortConfig={sortConfig} onSort={onSort} className="text-center w-[10%]" />
                            <SortableHeader sortKey="contributionType" title="Tipo" sortConfig={sortConfig} onSort={onSort} className="w-[12%]" />
                            <SortableHeader sortKey="paymentMethod" title="Forma" sortConfig={sortConfig} onSort={onSort} className="w-[12%]" />
                            <SortableHeader sortKey="transaction.amount" title={t('table.amount')} sortConfig={sortConfig} onSort={onSort} className="text-right w-[13%]" />
                            <th className="px-4 py-3 text-center text-[10px] font-bold uppercase text-slate-700">Ações</th>
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
                                onEdit={(row: MatchResult) => onEdit ? onEdit(row) : openSmartEdit(row)}
                                onDelete={(row: MatchResult) => openDeleteConfirmation({ type: 'report-row', id: row.transaction.id, name: `Transação ${row.transaction.id}`, meta: { reportType } })}
                                onUndo={undoIdentification}
                            />
                        ))}
                    </tbody>
                </table>
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
        </div>
    );
});
