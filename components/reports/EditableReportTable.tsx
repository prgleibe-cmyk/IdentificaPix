
import React, { useState, useContext, memo, useEffect, useCallback } from 'react';
import { MatchResult, Church, Language } from '../../types';
import { AppContext } from '../../contexts/AppContext';
import { useUI } from '../../contexts/UIContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { PencilIcon, FloppyDiskIcon, XCircleIcon, ChevronUpIcon, ChevronDownIcon, TrashIcon, ExclamationTriangleIcon, ChevronLeftIcon, ChevronRightIcon } from '../Icons';
import { PLACEHOLDER_CHURCH } from '../../services/processingService';

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

// --- Sub-components for Performance ---

const SortableHeader: React.FC<{
    sortKey: string;
    title: string;
    sortConfig: SortConfig | null;
    onSort: (key: string) => void;
    className?: string;
}> = memo(({ sortKey, title, sortConfig, onSort, className = '' }) => {
    const isSorted = sortConfig?.key === sortKey;
    const direction = sortConfig?.direction;

    return (
        <th scope="col" className={`px-6 py-4 font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider ${className}`}>
            <button onClick={() => onSort(sortKey)} className="flex items-center gap-1.5 group hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                <span>{title}</span>
                <span className={`transition-all duration-200 ${isSorted ? 'opacity-100 text-indigo-500' : 'opacity-0 group-hover:opacity-50'}`}>
                    {isSorted ? (
                        direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />
                    ) : (
                       <ChevronUpIcon className="w-3 h-3" />
                    )}
                </span>
            </button>
        </th>
    );
});

// Memoized Row Component to prevent full table re-render on single cell edit
const ReportRow = memo(({ 
    result, 
    reportType, 
    churches, 
    t, 
    language, 
    onEditStart, 
    onDelete, 
    openManualMatchModal, 
    openDivergenceModal,
    isEditing,
    draftRow,
    onEditChange,
    onSave,
    onCancel
}: {
    result: MatchResult;
    reportType: 'income' | 'expenses';
    churches: Church[];
    t: any;
    language: Language;
    onEditStart: (row: MatchResult) => void;
    onDelete: (row: MatchResult) => void;
    openManualMatchModal: (row: MatchResult) => void;
    openDivergenceModal: (row: MatchResult) => void;
    isEditing: boolean;
    draftRow: MatchResult | null;
    onEditChange: (field: string, value: any) => void;
    onSave: () => void;
    onCancel: () => void;
}) => {
    const currentRow = isEditing && draftRow ? draftRow : result;
    
    const transactionDate = currentRow.transaction.date;
    const contributorDate = currentRow.contributor?.date;
    const showBothDates = contributorDate && !currentRow.transaction.id.startsWith('pending-');
    const displayDate = contributorDate || transactionDate;

    const contributorName = currentRow.contributor?.cleanedName || currentRow.contributor?.name;
    const transactionDesc = currentRow.transaction.cleanedDescription || currentRow.transaction.description;
    const hasValidContributorName = contributorName && contributorName.trim().length > 0 && contributorName !== '---';
    const displayContributor = hasValidContributorName ? contributorName : (transactionDesc || '---');

    const inputClass = "w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm";
    const selectClass = "w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm";

    const getSimilarityBadgeClasses = (similarity: number | null | undefined): string => {
        const value = similarity ?? 0;
        if (value >= 80) return 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
        if (value >= 60) return 'bg-yellow-50 text-yellow-700 border border-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
        return 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    };

    const StatusBadge = () => {
        if (currentRow.status === 'NÃO IDENTIFICADO') {
            return (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                    Pendente
                </span>
            );
        }
        const isManual = currentRow.matchMethod === 'MANUAL';
        return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${isManual ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'}`}>
                {isManual ? 'Manual' : 'Identificado'}
            </span>
        );
    };

    const getDisplayValue = (type: 'income' | 'expenses') => {
        if (type === 'income') {
            if (currentRow.contributor?.originalAmount) return currentRow.contributor.originalAmount;
            if (currentRow.transaction.originalAmount) return currentRow.transaction.originalAmount;
            return ((currentRow.contributorAmount != null) ? formatCurrency(currentRow.contributorAmount, language) : formatCurrency(currentRow.transaction.amount, language));
        } else {
            return currentRow.transaction.originalAmount ?? formatCurrency(currentRow.transaction.amount, language);
        }
    };

    const handleEditClick = () => {
        if (result.status === 'NÃO IDENTIFICADO' && result.transaction.id.startsWith('pending-') && reportType === 'income') {
            openManualMatchModal(result);
        } else {
            onEditStart(result);
        }
    };

    return (
        <tr className={`bg-white dark:bg-slate-800 ${!isEditing && 'hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10'} transition-colors duration-200`}>
            <td className="px-6 py-4 whitespace-nowrap">
                {isEditing ? (
                    <input type="text" value={displayDate} onChange={e => onEditChange('transaction.date', e.target.value)} className={inputClass} />
                ) : showBothDates ? (
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">{contributorDate}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">{transactionDate}</span>
                    </div>
                ) : (
                    <span className="tabular-nums font-medium text-slate-600 dark:text-slate-400">{displayDate}</span>
                )}
            </td>
            
            {reportType === 'income' ? (
                <>
                    <td className="px-6 py-4 break-words">
                        {isEditing ? (
                            <select value={currentRow.church.id} onChange={e => onEditChange('churchId', e.target.value)} className={selectClass}>
                                <option value="unidentified">{t('common.unassigned')}</option>
                                {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        ) : (currentRow.church.name === '---' ? <span className="text-slate-400 italic font-light">{t('common.unassigned')}</span> : <span className="font-semibold text-slate-700 dark:text-slate-300">{currentRow.church.name}</span>)}
                    </td>
                    <td className="px-6 py-4 break-words">
                        {isEditing ? (
                            <input type="text" value={currentRow.contributor?.name || ''} onChange={e => onEditChange('contributor.name', e.target.value)} className={inputClass + (currentRow.status === 'NÃO IDENTIFICADO' ? ' bg-slate-100 dark:bg-slate-700 cursor-not-allowed' : '')} disabled={currentRow.status === 'NÃO IDENTIFICADO' && !currentRow.contributor} />
                        ) : currentRow.contributor ? (
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-slate-200">{displayContributor}</div>
                                    {!currentRow.transaction.id.startsWith('pending-') && transactionDesc && transactionDesc !== displayContributor && (
                                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">{transactionDesc}</div>
                                    )}
                                </div>
                            ) : (
                                <div className="font-semibold text-slate-800 dark:text-slate-200">{displayContributor}</div>
                        )}
                    </td>
                    <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg shadow-sm ${getSimilarityBadgeClasses(currentRow.similarity)}`}>
                            {currentRow.similarity?.toFixed(0) ?? '0'}%
                        </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums tracking-tight text-base">
                            {getDisplayValue('income')}
                        </span>
                    </td>
                </>
            ) : (
                <>
                    <td className="px-6 py-4 break-words">
                        {isEditing ? (
                                <input type="text" value={currentRow.transaction.description} onChange={e => onEditChange('transaction.description', e.target.value)} className={inputClass} />
                        ) : (
                            <div className="font-medium text-slate-800 dark:text-slate-200">{result.transaction.cleanedDescription || result.transaction.description}</div>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                        {isEditing ? (
                            <input type="text" value={currentRow.transaction.originalAmount || currentRow.transaction.amount} onChange={e => onEditChange('transaction.amount', e.target.value)} className={`${inputClass} text-right`} />
                        ) : (
                            <span className={`${currentRow.transaction.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} font-bold tabular-nums tracking-tight text-base`}>
                                {getDisplayValue('expenses')}
                            </span>
                        )}
                    </td>
                    <td className="px-6 py-4 break-words">
                        {isEditing ? (
                            <select value={currentRow.church.id} onChange={e => onEditChange('churchId', e.target.value)} className={selectClass}>
                                <option value="unidentified">{t('common.unassigned')}</option>
                                {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        ) : (currentRow.church.name === '---' ? <span className="text-slate-400 italic">{t('common.unassigned')}</span> : <span className="font-semibold text-slate-700 dark:text-slate-300">{currentRow.church.name}</span>)}
                    </td>
                </>
            )}

            <td className="px-6 py-4 text-center">
                {isEditing ? (
                    <select value={currentRow.status} onChange={e => onEditChange('status', e.target.value)} className={selectClass}>
                        <option value="IDENTIFICADO">{t('table.status.identified')}</option>
                        <option value="NÃO IDENTIFICADO">{t('table.status.unidentified')}</option>
                    </select>
                ) : (
                    <div className="flex items-center justify-center gap-2">
                        <StatusBadge />
                        {currentRow.divergence && (
                            <button
                                onClick={() => openDivergenceModal(currentRow)}
                                className="p-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors shadow-sm"
                                aria-label="Revisar divergência"
                            >
                                <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                            </button>
                        )}
                    </div>
                )}
            </td>
            <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                    {isEditing ? (
                        <>
                            <button onClick={onSave} className="p-2 rounded-xl text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors shadow-sm" title={t('common.save')}><FloppyDiskIcon className="w-4 h-4" /></button>
                            <button onClick={onCancel} className="p-2 rounded-xl text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors shadow-sm" title={t('common.cancel')}><XCircleIcon className="w-4 h-4" /></button>
                        </>
                    ) : (
                        <div className="flex items-center space-x-2">
                            <button onClick={handleEditClick} className="p-2 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors shadow-sm" title={t('common.edit')}>
                                <PencilIcon className="w-4 h-4 stroke-current" />
                            </button>
                            <button
                                onClick={() => onDelete(result)}
                                className="p-2 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 transition-colors shadow-sm"
                                aria-label={t('common.delete')}
                            >
                                <TrashIcon className="w-4 h-4 stroke-current" />
                            </button>
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
});

export const EditableReportTable: React.FC<EditableReportTableProps> = memo(({ data, onRowChange, reportType, sortConfig, onSort }) => {
    const { t, language } = useTranslation();
    const { showToast } = useUI();
    const { churches, openManualMatchModal, openDeleteConfirmation, openDivergenceModal } = useContext(AppContext);
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [draftRow, setDraftRow] = useState<MatchResult | null>(null);
    
    // --- Pagination State ---
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [data.length]);

    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const paginatedData = data.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const startEditing = useCallback((row: MatchResult) => {
        setEditingRowId(row.transaction.id);
        setDraftRow(JSON.parse(JSON.stringify(row))); 
    }, []);

    const handleDelete = useCallback((result: MatchResult) => {
        openDeleteConfirmation({ 
            type: 'report-row', 
            id: result.transaction.id, 
            name: `a linha "${result.transaction.cleanedDescription || result.transaction.description}"`,
            meta: { reportType }
        });
    }, [openDeleteConfirmation, reportType]);

    const handleEditChange = useCallback((field: string, value: any) => {
        setDraftRow(prev => {
            if (!prev) return null;
            const newRow = { ...prev };
            
            if (field === 'transaction.date') newRow.transaction = { ...newRow.transaction, date: value };
            else if (field === 'transaction.amount') newRow.transaction = { ...newRow.transaction, amount: parseFloat(value) || 0, originalAmount: value };
            else if (field === 'transaction.description') newRow.transaction = { ...newRow.transaction, description: value };
            else if (field === 'contributor.name') {
                newRow.contributor = newRow.contributor ? { ...newRow.contributor, name: value } : { name: value };
            }
            else if (field === 'churchId') {
                 const selectedChurch = churches.find(c => c.id === value);
                 if (selectedChurch) {
                    newRow.church = selectedChurch;
                 } else if (value === 'unidentified') {
                    newRow.church = PLACEHOLDER_CHURCH;
                 }
            }
            else if (field === 'status') {
                newRow.status = value;
                if (value === 'NÃO IDENTIFICADO') {
                    if (reportType === 'income') {
                        newRow.contributor = null;
                        newRow.matchMethod = undefined;
                        newRow.similarity = 0;
                        newRow.contributorAmount = undefined;
                    }
                    newRow.church = PLACEHOLDER_CHURCH;
                }
            }
            return newRow;
        });
    }, [churches, reportType]);
    
    const handleSave = useCallback(() => {
        if (!draftRow) return;
        onRowChange(draftRow);
        setEditingRowId(null);
        setDraftRow(null);
        showToast(t('common.saveChanges'));
    }, [draftRow, onRowChange, showToast, t]);
    
    const handleCancel = useCallback(() => {
        setEditingRowId(null);
        setDraftRow(null);
    }, []);

    return (
        <div className="flex flex-col">
            <div className="overflow-x-auto">
                <table className={`w-full text-sm text-left text-slate-600 dark:text-slate-300 ${reportType === 'income' ? 'print-income-table' : 'print-expense-table'}`}>
                    <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                        <tr>
                            {reportType === 'income' ? (
                                <>
                                    <th scope="col" className="px-6 py-4 font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[12%]">
                                        <button onClick={() => onSort('transaction.date')} className="flex items-center gap-1.5 group hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                            <span>{t('table.date')}</span>
                                            <span className={`transition-all duration-200 ${sortConfig?.key === 'transaction.date' ? 'opacity-100 text-indigo-500' : 'opacity-0 group-hover:opacity-50'}`}>
                                                {sortConfig?.key === 'transaction.date' ? (
                                                    sortConfig?.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />
                                                ) : (
                                                <ChevronUpIcon className="w-3 h-3" />
                                                )}
                                            </span>
                                        </button>
                                    </th>
                                    <SortableHeader sortKey="church.name" title={t('table.church')} sortConfig={sortConfig} onSort={onSort} className="w-[20%]" />
                                    <th scope="col" className="px-6 py-4 font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[30%]">
                                        <button onClick={() => onSort('contributor.name')} className="flex items-center gap-1.5 group hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                            <span>Contribuinte / Descrição</span>
                                            <span className={`transition-all duration-200 ${sortConfig?.key === 'contributor.name' ? 'opacity-100 text-indigo-500' : 'opacity-0 group-hover:opacity-50'}`}>
                                                {sortConfig?.key === 'contributor.name' ? (
                                                    sortConfig?.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />
                                                ) : (
                                                <ChevronUpIcon className="w-3 h-3" />
                                                )}
                                            </span>
                                        </button>
                                    </th>
                                    <SortableHeader sortKey="similarity" title={t('table.percentage')} sortConfig={sortConfig} onSort={onSort} className="w-[8%] text-center" />
                                    <SortableHeader sortKey="contributor.amount" title="Valor" sortConfig={sortConfig} onSort={onSort} className="w-[15%] text-right" />
                                    <SortableHeader sortKey="status" title={t('table.status')} sortConfig={sortConfig} onSort={onSort} className="w-[8%] text-center" />
                                    <th scope="col" className="w-[7%] px-6 py-4 font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">{t('table.actions')}</th>
                                </>
                            ) : (
                                <>
                                    <SortableHeader sortKey="transaction.date" title={t('table.date')} sortConfig={sortConfig} onSort={onSort} className="w-[15%]" />
                                    <SortableHeader sortKey="transaction.description" title={t('table.supplier')} sortConfig={sortConfig} onSort={onSort} className="w-[40%]" />
                                    <SortableHeader sortKey="transaction.amount" title={t('table.amount')} sortConfig={sortConfig} onSort={onSort} className="w-[15%] text-right" />
                                    <SortableHeader sortKey="church.name" title={t('table.costCenter')} sortConfig={sortConfig} onSort={onSort} className="w-[15%]" />
                                    <SortableHeader sortKey="status" title={t('table.status')} sortConfig={sortConfig} onSort={onSort} className="w-[8%] text-center" />
                                    <th scope="col" className="w-[7%] px-6 py-4 font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">{t('table.actions')}</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {paginatedData.map((result) => (
                            <ReportRow
                                key={result.transaction.id}
                                result={result}
                                reportType={reportType}
                                churches={churches}
                                t={t}
                                language={language}
                                onEditStart={startEditing}
                                onDelete={handleDelete}
                                openManualMatchModal={openManualMatchModal}
                                openDivergenceModal={openDivergenceModal}
                                isEditing={editingRowId === result.transaction.id}
                                draftRow={draftRow}
                                onEditChange={handleEditChange}
                                onSave={handleSave}
                                onCancel={handleCancel}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 px-8 py-5 bg-white dark:bg-slate-800 rounded-b-3xl">
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Mostrando <span className="font-bold text-slate-900 dark:text-slate-100">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> a <span className="font-bold text-slate-900 dark:text-slate-100">{Math.min(currentPage * ITEMS_PER_PAGE, data.length)}</span> de <span className="font-bold text-slate-900 dark:text-slate-100">{data.length}</span> resultados
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center px-3 py-2 rounded-l-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <span className="sr-only">Anterior</span>
                                    <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                                </button>
                                <span className="relative inline-flex items-center px-4 py-2 border-t border-b border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {currentPage} de {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="relative inline-flex items-center px-3 py-2 rounded-r-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <span className="sr-only">Próxima</span>
                                    <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </nav>
                        </div>
                    </div>
                    <div className="flex items-center justify-between sm:hidden w-full">
                         <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 shadow-sm"
                        >
                            Anterior
                        </button>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 shadow-sm"
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});
