
import React, { useState, useContext, memo, useEffect, useCallback, useMemo } from 'react';
import { MatchResult } from '../../types';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { 
    PencilIcon, 
    FloppyDiskIcon, 
    XCircleIcon, 
    ChevronUpIcon, 
    ChevronDownIcon, 
    TrashIcon, 
    ExclamationTriangleIcon, 
    ChevronLeftIcon, 
    ChevronRightIcon, 
    UserIcon 
} from '../Icons';
import { PLACEHOLDER_CHURCH, formatIncomeDescription } from '../../services/processingService';

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
}

const ITEMS_PER_PAGE = 50;

// --- Sub-Componentes de UI de Suporte ---

const SortableHeader: React.FC<{
    sortKey: string;
    title: string;
    sortConfig: SortConfig | null;
    onSort: (key: string) => void;
    className?: string;
}> = memo(({ sortKey, title, sortConfig, onSort, className = '' }) => {
    const isSorted = sortConfig?.key === sortKey;
    return (
        <th scope="col" className={`px-4 py-3 text-left text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest ${className}`}>
            <button onClick={() => onSort(sortKey)} className="flex items-center gap-1.5 group hover:text-brand-blue transition-colors focus:outline-none">
                <span>{title}</span>
                <span className={`transition-all duration-200 ${isSorted ? 'opacity-100 text-brand-blue' : 'opacity-0 group-hover:opacity-50'}`}>
                    {sortConfig?.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                </span>
            </button>
        </th>
    );
});

const SourceBadge: React.FC<{ type: 'list' | 'bank' }> = ({ type }) => (
    <span className={`inline-flex items-center justify-center min-w-[45px] px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border select-none ${
        type === 'list' ? 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
    }`}>
        {type === 'list' ? 'Lista' : 'Extrato'}
    </span>
);

// --- Trilhas de Renderização Isoladas ---

const IncomeRow = memo(({ 
    result, 
    churches, 
    language, 
    onEdit, 
    onDelete, 
    openManualMatch, 
    openDivergence, 
    isEditing, 
    draft, 
    onDraftChange, 
    onSave, 
    onCancel, 
    ignoreKeywords, 
    contributionKeywords 
}: any) => {
    const row = isEditing ? draft : result;
    const isIdentified = row.status === 'IDENTIFICADO';
    const displayDate = row.contributor?.date || row.transaction.date;
    const txDescFormatted = formatIncomeDescription(row.transaction.description, ignoreKeywords);
    const amount = row.contributorAmount ?? row.transaction.amount;

    if (isEditing) {
        return (
            <tr className="bg-slate-50 dark:bg-slate-900/50">
                <td className="px-4 py-2"><input type="text" value={row.transaction.date} onChange={e => onDraftChange('transaction.date', e.target.value)} className="w-full text-[10px] p-1 rounded border border-slate-300 dark:bg-slate-800 dark:border-slate-600 outline-none focus:border-brand-blue" /></td>
                <td className="px-4 py-2">
                    <select value={row.church.id} onChange={e => onDraftChange('churchId', e.target.value)} className="w-full text-[10px] p-1 rounded border border-slate-300 dark:bg-slate-800 dark:border-slate-600 outline-none focus:border-brand-blue">
                        <option value="unidentified">---</option>
                        {churches.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </td>
                <td className="px-4 py-2"><input type="text" value={row.contributor?.name || ''} onChange={e => onDraftChange('contributor.name', e.target.value)} className="w-full text-[10px] p-1 rounded border border-slate-300 dark:bg-slate-800 dark:border-slate-600 outline-none focus:border-brand-blue" /></td>
                <td className="px-4 py-2">
                    <select 
                        value={row.contributionType || ''} 
                        onChange={e => onDraftChange('contributionType', e.target.value)} 
                        className="w-full text-[10px] p-1 rounded border border-slate-300 dark:bg-slate-800 dark:border-slate-600 font-bold uppercase outline-none focus:border-brand-blue"
                    >
                        <option value="">Tipo...</option>
                        {contributionKeywords.map((k: string) => (
                            <option key={k} value={k}>{k}</option>
                        ))}
                    </select>
                </td>
                <td className="px-4 py-2 text-center">-</td>
                <td className="px-4 py-2"><input type="number" value={amount} onChange={e => onDraftChange('transaction.amount', e.target.value)} className="w-full text-[10px] p-1 rounded border border-slate-300 text-right dark:bg-slate-800 dark:border-slate-600 outline-none focus:border-brand-blue" /></td>
                <td className="px-4 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                        <button onClick={onSave} className="p-1 rounded hover:bg-emerald-100 text-emerald-600 transition-colors"><FloppyDiskIcon className="w-4 h-4" /></button>
                        <button onClick={onCancel} className="p-1 rounded hover:bg-slate-200 text-slate-400 transition-colors"><XCircleIcon className="w-4 h-4" /></button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <tr className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-50 dark:border-slate-700/50">
            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{displayDate}</td>
            <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200">{row.church.name}</td>
            <td className="px-4 py-2.5">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <SourceBadge type={isIdentified ? 'list' : 'bank'} />
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{row.contributor?.name || txDescFormatted}</span>
                    </div>
                    {isIdentified && <span className="text-[10px] text-slate-400 pl-[53px]">Origem: {txDescFormatted}</span>}
                </div>
            </td>
            <td className="px-4 py-2.5">
                 <span className={`text-[9px] font-black uppercase tracking-widest ${row.contributionType ? 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700' : 'text-slate-300 italic'}`}>
                    {row.contributionType || '---'}
                 </span>
            </td>
            <td className="px-4 py-2.5 text-center whitespace-nowrap">
                {isIdentified && typeof row.similarity === 'number' ? (
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">{row.similarity.toFixed(0)}%</span>
                ) : (
                    <span className="text-[11px] text-slate-400">---</span>
                )}
            </td>
            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                <span className={`font-mono text-xs font-bold tabular-nums tracking-tight ${amount < 0 ? 'text-red-600 dark:text-red-400 font-black' : 'text-slate-900 dark:text-white'}`}>
                    {formatCurrency(amount, language)}
                </span>
            </td>
            <td className="px-4 py-2.5 text-center">
                <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(row)} className="p-1.5 rounded-lg text-brand-blue bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors shadow-sm" title="Editar">
                        <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                    {isIdentified && !row.contributor && <button onClick={() => openManualMatch(row)} className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition-colors shadow-sm" title="Associar Manualmente"><UserIcon className="w-3.5 h-3.5" /></button>}
                    {row.divergence && <button onClick={() => openDivergence(row)} className="p-1.5 rounded-lg text-yellow-600 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50 transition-colors shadow-sm" title="Confirmar Divergência"><ExclamationTriangleIcon className="w-3.5 h-3.5" /></button>}
                    <button onClick={() => onDelete(row)} className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50 transition-colors shadow-sm" title="Excluir">
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </td>
        </tr>
    );
});

// Main EditableReportTable Component
export const EditableReportTable: React.FC<EditableReportTableProps> = memo(({ data, onRowChange, reportType, sortConfig, onSort }) => {
    const { t, language } = useTranslation();
    const { churches, customIgnoreKeywords, contributionKeywords, openManualMatchModal, openDivergenceModal, openDeleteConfirmation } = useContext(AppContext);
    
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [draftRow, setDraftRow] = useState<MatchResult | null>(null);

    const handleEdit = useCallback((row: MatchResult) => {
        setEditingRowId(row.transaction.id);
        setDraftRow(JSON.parse(JSON.stringify(row))); // Deep copy
    }, []);

    const handleDraftChange = useCallback((path: string, value: any) => {
        setDraftRow(prev => {
            if (!prev) return null;
            const newDraft = { ...prev };
            
            if (path === 'transaction.date') newDraft.transaction.date = value;
            else if (path === 'transaction.amount') newDraft.transaction.amount = parseFloat(value) || 0;
            else if (path === 'contributor.name') {
                if (!newDraft.contributor) newDraft.contributor = { name: '', amount: 0 };
                newDraft.contributor.name = value;
                newDraft.contributor.cleanedName = value;
            }
            else if (path === 'churchId') newDraft.church = churches.find(c => c.id === value) || PLACEHOLDER_CHURCH;
            else if (path === 'contributionType') newDraft.contributionType = value;
            return newDraft;
        });
    }, [churches]);

    const handleSave = useCallback(() => {
        if (draftRow) {
            onRowChange(draftRow);
            setEditingRowId(null);
            setDraftRow(null);
        }
    }, [draftRow, onRowChange]);

    const handleCancel = useCallback(() => {
        setEditingRowId(null);
        setDraftRow(null);
    }, []);

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
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/95 dark:bg-slate-800/95 border-b border-slate-200/60 dark:border-slate-700 backdrop-blur-md sticky top-0 z-20">
                    <tr>
                        <SortableHeader sortKey="transaction.date" title={t('table.date')} sortConfig={sortConfig} onSort={onSort} className="w-[10%]" />
                        <SortableHeader sortKey="church.name" title={t('table.church')} sortConfig={sortConfig} onSort={onSort} className="w-[15%]" />
                        <SortableHeader sortKey={reportType === 'income' ? 'contributor.name' : 'transaction.description'} title={reportType === 'income' ? 'Descrição / Contribuinte' : 'Descrição'} sortConfig={sortConfig} onSort={onSort} className="w-[25%]" />
                        <SortableHeader sortKey="contributionType" title="Tipo" sortConfig={sortConfig} onSort={onSort} className="w-[10%]" />
                        <SortableHeader sortKey="similarity" title="Similaridade" sortConfig={sortConfig} onSort={onSort} className="w-[8%]" />
                        <SortableHeader sortKey="transaction.amount" title={t('table.amount')} sortConfig={sortConfig} onSort={onSort} className="text-right w-[12%]" />
                        <th scope="col" className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-[8%]">{t('table.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {paginatedData.map(result => (
                        <IncomeRow 
                            key={result.transaction.id}
                            result={result}
                            churches={churches}
                            t={t}
                            language={language}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            openManualMatch={openManualMatchModal}
                            openDivergence={openDivergenceModal}
                            isEditing={editingRowId === result.transaction.id}
                            draft={draftRow}
                            onDraftChange={handleDraftChange}
                            onSave={handleSave}
                            onCancel={handleCancel}
                            ignoreKeywords={customIgnoreKeywords}
                            contributionKeywords={contributionKeywords}
                        />
                    ))}
                </tbody>
            </table>
            {totalPages > 1 && (
                <div className="flex justify-between items-center px-4 py-3 bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Página {currentPage} de {totalPages}</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-colors"><ChevronLeftIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-colors"><ChevronRightIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
                    </div>
                </div>
            )}
        </div>
    );
});
