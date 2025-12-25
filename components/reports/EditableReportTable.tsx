
import React, { useState, useContext, memo, useEffect, useCallback } from 'react';
import { MatchResult, Church, Language } from '../../types';
import { AppContext } from '../../contexts/AppContext';
import { useUI } from '../../contexts/UIContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { PencilIcon, FloppyDiskIcon, XCircleIcon, ChevronUpIcon, ChevronDownIcon, TrashIcon, ExclamationTriangleIcon, ChevronLeftIcon, ChevronRightIcon, BuildingOfficeIcon, UserIcon, BanknotesIcon } from '../Icons';
import { PLACEHOLDER_CHURCH, formatIncomeDescription, formatExpenseDescription } from '../../services/processingService';

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

const IncomeRow = memo(({ result, churches, t, language, onEdit, onDelete, openManualMatch, openDivergence, isEditing, draft, onDraftChange, onSave, onCancel, ignoreKeywords, contributionKeywords }: any) => {
    const row = isEditing ? draft : result;
    const isIdentified = row.status === 'IDENTIFICADO';
    const displayDate = row.contributor?.date || row.transaction.date;
    const txDescFormatted = formatIncomeDescription(row.transaction.description, ignoreKeywords);
    const amount = row.contributorAmount ?? row.transaction.amount;

    if (isEditing) {
        return (
            <tr className="bg-slate-50 dark:bg-slate-900/50">
                <td className="px-4 py-2"><input type="text" value={row.transaction.date} onChange={e => onDraftChange('transaction.date', e.target.value)} className="w-full text-[10px] p-1 rounded border dark:bg-slate-800 dark:border-slate-600" /></td>
                <td className="px-4 py-2">
                    <select value={row.church.id} onChange={e => onDraftChange('churchId', e.target.value)} className="w-full text-[10px] p-1 rounded border dark:bg-slate-800 dark:border-slate-600">
                        <option value="unidentified">---</option>
                        {churches.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </td>
                <td className="px-4 py-2"><input type="text" value={row.contributor?.name || ''} onChange={e => onDraftChange('contributor.name', e.target.value)} className="w-full text-[10px] p-1 rounded border dark:bg-slate-800 dark:border-slate-600" /></td>
                <td className="px-4 py-2">
                    <select 
                        value={row.contributionType || ''} 
                        onChange={e => onDraftChange('contributionType', e.target.value)} 
                        className="w-full text-[10px] p-1 rounded border dark:bg-slate-800 dark:border-slate-600 font-bold uppercase"
                    >
                        <option value="">Tipo...</option>
                        {contributionKeywords.map((k: string) => (
                            <option key={k} value={k}>{k}</option>
                        ))}
                    </select>
                </td>
                <td className="px-4 py-2 text-center">-</td>
                <td className="px-4 py-2"><input type="number" value={amount} onChange={e => onDraftChange('transaction.amount', e.target.value)} className="w-full text-[10px] p-1 rounded border text-right dark:bg-slate-800 dark:border-slate-600" /></td>
                <td className="px-4 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                        <button onClick={onSave} className="text-emerald-600"><FloppyDiskIcon className="w-4 h-4" /></button>
                        <button onClick={onCancel} className="text-slate-400"><XCircleIcon className="w-4 h-4" /></button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <tr className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-50 dark:border-slate-700/50">
            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{displayDate}</td>
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
            <td className="px-4 py-2.5 text-center">
                {row.similarity != null && isIdentified && <span className="text-[10px] font-bold text-brand-blue">{row.similarity.toFixed(0)}%</span>}
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(amount, language)}</td>
            <td className="px-4 py-2.5 text-center">
                <div className="flex items-center justify-center gap-2">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isIdentified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {isIdentified ? 'IDENTIFICADO' : 'PENDENTE'}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(row)} className="p-1 text-slate-400 hover:text-brand-blue"><PencilIcon className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onDelete(row)} className="p-1 text-slate-400 hover:text-red-500"><TrashIcon className="w-3.5 h-3.5" /></button>
                    </div>
                </div>
            </td>
        </tr>
    );
});

const ExpenseRow = memo(({ result, churches, t, language, onEdit, onDelete, isEditing, draft, onDraftChange, onSave, onCancel }: any) => {
    const row = isEditing ? draft : result;
    const txDescFormatted = formatExpenseDescription(row.transaction.description);

    if (isEditing) {
        return (
            <tr className="bg-slate-50 dark:bg-slate-900/50">
                <td className="px-4 py-2"><input type="text" value={row.transaction.date} onChange={e => onDraftChange('transaction.date', e.target.value)} className="w-full text-[10px] p-1 rounded border dark:bg-slate-800 dark:border-slate-600" /></td>
                <td className="px-4 py-2"><input type="text" value={row.transaction.description} onChange={e => onDraftChange('transaction.description', e.target.value)} className="w-full text-[10px] p-1 rounded border dark:bg-slate-800 dark:border-slate-600" /></td>
                <td className="px-4 py-2"><input type="number" value={row.transaction.amount} onChange={e => onDraftChange('transaction.amount', e.target.value)} className="w-full text-[10px] p-1 rounded border text-right dark:bg-slate-800 dark:border-slate-600" /></td>
                <td className="px-4 py-2">
                    <select value={row.church.id} onChange={e => onDraftChange('churchId', e.target.value)} className="w-full text-[10px] p-1 rounded border dark:bg-slate-800 dark:border-slate-600">
                        <option value="unidentified">---</option>
                        {churches.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </td>
                <td className="px-4 py-2 text-center">
                     <div className="flex gap-1 justify-center">
                        <button onClick={onSave} className="text-emerald-600"><FloppyDiskIcon className="w-4 h-4" /></button>
                        <button onClick={onCancel} className="text-slate-400"><XCircleIcon className="w-4 h-4" /></button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <tr className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-50 dark:border-slate-700/50">
            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{row.transaction.date}</td>
            <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200">{txDescFormatted}</td>
            <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-red-600 dark:text-red-400">{formatCurrency(row.transaction.amount, language)}</td>
            <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">{row.church.name}</td>
            <td className="px-4 py-2.5 text-center">
                <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(row)} className="p-1 text-slate-400 hover:text-brand-blue"><PencilIcon className="w-3.5 h-3.5" /></button>
                    <button onClick={() => onDelete(row)} className="p-1 text-slate-400 hover:text-red-500"><TrashIcon className="w-3.5 h-3.5" /></button>
                </div>
            </td>
        </tr>
    );
});

export const EditableReportTable: React.FC<EditableReportTableProps> = memo(({ data, onRowChange, reportType, sortConfig, onSort }) => {
    const { t, language } = useTranslation();
    const { showToast } = useUI();
    const { churches, openManualMatchModal, openDeleteConfirmation, customIgnoreKeywords, contributionKeywords } = useContext(AppContext);
    
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [draftRow, setDraftRow] = useState<MatchResult | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => { setCurrentPage(1); }, [data.length]);

    const handleEditStart = useCallback((row: MatchResult) => {
        if (row.status === 'NÃO IDENTIFICADO' && row.transaction.id.startsWith('pending-') && reportType === 'income') {
            openManualMatchModal(row);
        } else {
            setEditingRowId(row.transaction.id);
            setDraftRow(JSON.parse(JSON.stringify(row))); 
        }
    }, [reportType, openManualMatchModal]);

    const handleDraftChange = useCallback((field: string, value: any) => {
        setDraftRow(prev => {
            if (!prev) return null;
            const newRow = { ...prev };
            if (field === 'transaction.date') newRow.transaction.date = value;
            else if (field === 'transaction.amount') newRow.transaction.amount = parseFloat(value) || 0;
            else if (field === 'transaction.description') newRow.transaction.description = value;
            else if (field === 'contributionType') newRow.contributionType = value;
            else if (field === 'contributor.name') { if (newRow.contributor) newRow.contributor.name = value; else newRow.contributor = { name: value } as any; }
            else if (field === 'churchId') { const c = churches.find(ch => ch.id === value); newRow.church = c || PLACEHOLDER_CHURCH; }
            return newRow;
        });
    }, [churches]);

    const handleSave = useCallback(() => {
        if (draftRow) { onRowChange(draftRow); setEditingRowId(null); setDraftRow(null); showToast(t('common.saveChanges')); }
    }, [draftRow, onRowChange, showToast, t]);

    const paginatedData = data.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);

    return (
        <div className="flex flex-col">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-[900px] w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-20">
                        <tr>
                            {reportType === 'income' ? (
                                <>
                                    <SortableHeader sortKey="transaction.date" title={t('table.date')} sortConfig={sortConfig} onSort={onSort} className="w-[10%]" />
                                    <SortableHeader sortKey="church.name" title={t('table.church')} sortConfig={sortConfig} onSort={onSort} className="w-[15%]" />
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Contribuinte / Origem</th>
                                    <SortableHeader sortKey="contributionType" title="Tipo" sortConfig={sortConfig} onSort={onSort} className="w-[10%]" />
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest text-center">Simil.</th>
                                    <SortableHeader sortKey="transaction.amount" title="Valor" sortConfig={sortConfig} onSort={onSort} className="w-[12%] text-right" />
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest text-center">Status</th>
                                </>
                            ) : (
                                <>
                                    <SortableHeader sortKey="transaction.date" title={t('table.date')} sortConfig={sortConfig} onSort={onSort} className="w-[15%]" />
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Descrição da Saída</th>
                                    <SortableHeader sortKey="transaction.amount" title={t('table.amount')} sortConfig={sortConfig} onSort={onSort} className="w-[15%] text-right" />
                                    <SortableHeader sortKey="church.name" title="Centro de Custo" sortConfig={sortConfig} onSort={onSort} className="w-[20%]" />
                                    <th className="w-[8%]"></th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {paginatedData.map(res => (
                            reportType === 'income' ? (
                                <IncomeRow 
                                    key={res.transaction.id} result={res} churches={churches} t={t} language={language} ignoreKeywords={customIgnoreKeywords} contributionKeywords={contributionKeywords}
                                    isEditing={editingRowId === res.transaction.id} draft={draftRow} onDraftChange={handleDraftChange} onSave={handleSave} onCancel={() => setEditingRowId(null)}
                                    onEdit={handleEditStart} onDelete={(r: any) => openDeleteConfirmation({ type: 'report-row', id: r.transaction.id, name: 'esta linha', meta: { reportType }})} 
                                />
                            ) : (
                                <ExpenseRow 
                                    key={res.transaction.id} result={res} churches={churches} t={t} language={language}
                                    isEditing={editingRowId === res.transaction.id} draft={draftRow} onDraftChange={handleDraftChange} onSave={handleSave} onCancel={() => setEditingRowId(null)}
                                    onEdit={handleEditStart} onDelete={(r: any) => openDeleteConfirmation({ type: 'report-row', id: r.transaction.id, name: 'esta linha', meta: { reportType }})} 
                                />
                            )
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Página {currentPage} de {totalPages} ({data.length} total)
                    </p>
                    <nav className="flex gap-1">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 rounded-full border border-slate-200 text-[10px] font-bold disabled:opacity-50"><ChevronLeftIcon className="w-3 h-3" /></button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 rounded-full border border-slate-200 text-[10px] font-bold disabled:opacity-50"><ChevronRightIcon className="w-3 h-3" /></button>
                    </nav>
                </div>
            )}
        </div>
    );
});
