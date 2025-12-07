import React, { useState, useContext, memo, useEffect } from 'react';
import { MatchResult } from '../../types';
import { AppContext } from '../../contexts/AppContext';
import { useUI } from '../../contexts/UIContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { PencilIcon, FloppyDiskIcon, XCircleIcon, CheckCircleIcon, ChevronUpIcon, ChevronDownIcon, TrashIcon, InformationCircleIcon, ExclamationTriangleIcon, ChevronLeftIcon, ChevronRightIcon } from '../Icons';
import { cleanTransactionDescriptionForDisplay, PLACEHOLDER_CHURCH } from '../../services/processingService';

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

const SortableHeader: React.FC<{
    sortKey: string;
    title: string;
    sortConfig: SortConfig | null;
    onSort: (key: string) => void;
    className?: string;
}> = ({ sortKey, title, sortConfig, onSort, className = '' }) => {
    const isSorted = sortConfig?.key === sortKey;
    const direction = sortConfig?.direction;

    return (
        <th scope="col" className={`px-4 py-3 font-medium ${className}`}>
            <button onClick={() => onSort(sortKey)} className="flex items-center gap-1 group">
                <span>{title}</span>
                <span className="opacity-30 group-hover:opacity-100 transition-opacity">
                    {isSorted ? (
                        direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />
                    ) : (
                       <ChevronUpIcon className="w-3 h-3" />
                    )}
                </span>
            </button>
        </th>
    );
};

export const EditableReportTable: React.FC<EditableReportTableProps> = memo(({ data, onRowChange, reportType, sortConfig, onSort }) => {
    const { t, language } = useTranslation();
    const { showToast } = useUI();
    const { churches, openManualMatchModal, openDeleteConfirmation, openDivergenceModal } = useContext(AppContext);
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [draftRow, setDraftRow] = useState<MatchResult | null>(null);
    
    // --- Pagination State ---
    const [currentPage, setCurrentPage] = useState(1);

    // Reset to page 1 when data length changes significantly (filtering)
    useEffect(() => {
        setCurrentPage(1);
    }, [data.length]);

    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const paginatedData = data.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const startEditing = (row: MatchResult) => {
        setEditingRowId(row.transaction.id);
        setDraftRow(JSON.parse(JSON.stringify(row))); // Deep copy for editing
    };

    const handleEditClick = (result: MatchResult) => {
        if (result.status === 'NÃO IDENTIFICADO' && result.transaction.id.startsWith('pending-') && reportType === 'income') {
            openManualMatchModal(result);
        } else {
            startEditing(result);
        }
    };

    const handleEditChange = (field: string, value: any) => {
        if (!draftRow) return;
        setDraftRow(prev => {
            if (!prev) return null;
            const newRow = { ...prev };
            
            if (field === 'transaction.date') newRow.transaction = { ...newRow.transaction, date: value };
            else if (field === 'transaction.amount') newRow.transaction = { ...newRow.transaction, amount: parseFloat(value) || 0 };
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
    };
    
    const handleSave = () => {
        if (!draftRow) return;
        onRowChange(draftRow);
        setEditingRowId(null);
        setDraftRow(null);
        showToast(t('common.saveChanges'));
    };
    
    const handleCancel = () => {
        setEditingRowId(null);
        setDraftRow(null);
    };

    const getSimilarityBadgeClasses = (similarity: number | null | undefined): string => {
        const value = similarity ?? 0;
        if (value >= 80) {
            return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
        }
        if (value >= 60) {
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
        }
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
    };

    const inputClass = "w-full bg-transparent border border-blue-500 rounded px-1 py-0.5";
    const selectClass = "w-full bg-transparent border border-blue-500 rounded px-1 py-0.5 dark:bg-slate-900";

    const StatusIcon = ({ row }: { row: MatchResult }) => {
        if (row.status === 'NÃO IDENTIFICADO') {
            return <XCircleIcon className="w-5 h-5 text-yellow-500" />;
        }
        
        const color = row.matchMethod === 'MANUAL' ? 'text-blue-500' : 'text-green-500';
        return <CheckCircleIcon className={`w-5 h-5 ${color}`} />;
    };

    return (
        <div className="flex flex-col">
            <div className="p-2 overflow-x-auto">
                <table className={`w-full text-sm text-left text-slate-600 dark:text-slate-300 table-auto ${reportType === 'income' ? 'print-income-table' : 'print-expense-table'}`}>
                    <thead className="text-sm text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                        <tr>
                            {reportType === 'income' ? (
                                <>
                                    <th scope="col" className="px-4 py-3 font-medium w-[12%]">
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => onSort('date')} className="flex items-center gap-1 group">
                                                <span>{t('table.date')}</span>
                                                <span className="opacity-30 group-hover:opacity-100 transition-opacity">
                                                    {sortConfig?.key === 'date' ? (
                                                        sortConfig?.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />
                                                    ) : (
                                                    <ChevronUpIcon className="w-3 h-3" />
                                                    )}
                                                </span>
                                            </button>
                                            <div className="relative group">
                                                <InformationCircleIcon className="w-4 h-4 text-slate-400" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs px-3 py-2 text-xs text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                                    <span className="font-semibold text-blue-300">Azul:</span> Data da lista da Igreja.<br />
                                                    <span className="font-semibold">Padrão:</span> Data do extrato bancário.
                                                </div>
                                            </div>
                                        </div>
                                    </th>
                                    <SortableHeader sortKey="church.name" title={t('table.church')} sortConfig={sortConfig} onSort={onSort} className="w-[20%]" />
                                    <th scope="col" className="px-4 py-3 font-medium w-[30%]">
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => onSort('contributor.name')} className="flex items-center gap-1 group">
                                                <span>Contribuinte / Descrição</span>
                                                <span className="opacity-30 group-hover:opacity-100 transition-opacity">
                                                    {sortConfig?.key === 'contributor.name' ? (
                                                        sortConfig?.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />
                                                    ) : (
                                                    <ChevronUpIcon className="w-3 h-3" />
                                                    )}
                                                </span>
                                            </button>
                                            <div className="relative group">
                                                <InformationCircleIcon className="w-4 h-4 text-slate-400" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs px-3 py-2 text-xs text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                                    <span className="font-semibold text-blue-300">Azul:</span> Nome do contribuinte.<br />
                                                    <span className="font-semibold">Padrão:</span> Descrição do extrato.
                                                </div>
                                            </div>
                                        </div>
                                    </th>
                                    <SortableHeader sortKey="similarity" title={t('table.percentage')} sortConfig={sortConfig} onSort={onSort} className="w-[8%] text-center" />
                                    <SortableHeader sortKey="contributor.amount" title="Valor Igreja" sortConfig={sortConfig} onSort={onSort} className="w-[15%] text-right" />
                                    <SortableHeader sortKey="status" title={t('table.status')} sortConfig={sortConfig} onSort={onSort} className="w-[8%] text-center" />
                                    <th scope="col" className="w-[7%] px-4 py-3 font-medium text-center">{t('table.actions')}</th>
                                </>
                            ) : (
                                <>
                                    <SortableHeader sortKey="transaction.date" title={t('table.date')} sortConfig={sortConfig} onSort={onSort} className="w-[15%]" />
                                    <SortableHeader sortKey="transaction.description" title={t('table.supplier')} sortConfig={sortConfig} onSort={onSort} className="w-[40%]" />
                                    <SortableHeader sortKey="transaction.amount" title={t('table.amount')} sortConfig={sortConfig} onSort={onSort} className="w-[15%] text-right" />
                                    <SortableHeader sortKey="church.name" title={t('table.costCenter')} sortConfig={sortConfig} onSort={onSort} className="w-[15%]" />
                                    <SortableHeader sortKey="status" title={t('table.status')} sortConfig={sortConfig} onSort={onSort} className="w-[8%] text-center" />
                                    <th scope="col" className="w-[7%] px-4 py-3 font-medium text-center">{t('table.actions')}</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((result) => {
                            const isEditing = editingRowId === result.transaction.id;
                            const currentRow = isEditing ? draftRow! : result;
                            
                            const transactionDate = currentRow.transaction.date;
                            const contributorDate = currentRow.contributor?.date;
                            const showBothDates = contributorDate && !currentRow.transaction.id.startsWith('pending-');
                            const displayDate = contributorDate || transactionDate;

                            return (
                                <tr key={result.transaction.id} className={`bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 ${!isEditing && 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {isEditing ? (
                                            <input type="text" value={displayDate} onChange={e => handleEditChange('transaction.date', e.target.value)} className={inputClass} />
                                        ) : showBothDates ? (
                                            <div>
                                                <div className="text-sm font-medium text-blue-600 dark:text-blue-400">{contributorDate}</div>
                                                <div className="text-sm text-slate-500 dark:text-slate-400">{transactionDate}</div>
                                            </div>
                                        ) : (
                                            displayDate
                                        )}
                                    </td>
                                    
                                    {reportType === 'income' ? (
                                        <>
                                            <td className="px-4 py-3 break-words">
                                                {isEditing ? (
                                                    <select value={currentRow.church.id} onChange={e => handleEditChange('churchId', e.target.value)} className={selectClass}>
                                                        <option value="unidentified">{t('common.unassigned')}</option>
                                                        {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                ) : (currentRow.church.name === '---' ? t('common.unassigned') : currentRow.church.name)}
                                            </td>
                                            <td className="px-4 py-3 break-words">
                                                {isEditing ? (
                                                    <input type="text" value={currentRow.contributor?.name || ''} onChange={e => handleEditChange('contributor.name', e.target.value)} className={inputClass + (currentRow.status === 'NÃO IDENTIFICADO' ? ' bg-slate-100 dark:bg-slate-700 cursor-not-allowed' : '')} disabled={currentRow.status === 'NÃO IDENTIFICADO' && !currentRow.contributor} />
                                                ) : currentRow.contributor ? (
                                                        <div>
                                                            <div className="font-medium text-blue-600 dark:text-blue-400">{currentRow.contributor.cleanedName || currentRow.contributor.name}</div>
                                                            {currentRow.transaction.id.startsWith('pending-') ? null : (
                                                                <div className="text-sm text-slate-500 dark:text-slate-400">{currentRow.transaction.cleanedDescription || currentRow.transaction.description}</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="font-medium text-slate-800 dark:text-slate-200">{currentRow.transaction.cleanedDescription || currentRow.transaction.description}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${getSimilarityBadgeClasses(currentRow.similarity)}`}>
                                                    {currentRow.similarity?.toFixed(0) ?? '0'}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                    {(currentRow.contributorAmount != null) ? formatCurrency(currentRow.contributorAmount, language) : t('common.notApplicable')}
                                                </span>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-4 py-3 break-words">
                                                {isEditing ? (
                                                     <input type="text" value={currentRow.transaction.description} onChange={e => handleEditChange('transaction.description', e.target.value)} className={inputClass} />
                                                ) : (
                                                    <div className="font-medium text-slate-800 dark:text-slate-200">{result.transaction.cleanedDescription || result.transaction.description}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                {isEditing ? <input type="number" value={currentRow.transaction.amount} onChange={e => handleEditChange('transaction.amount', e.target.value)} className={`${inputClass} text-right`} /> : <span className={`${currentRow.transaction.amount > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'} font-semibold`}>{formatCurrency(currentRow.transaction.amount, language)}</span>}
                                            </td>
                                            <td className="px-4 py-3 break-words">
                                                {isEditing ? (
                                                    <select value={currentRow.church.id} onChange={e => handleEditChange('churchId', e.target.value)} className={selectClass}>
                                                        <option value="unidentified">{t('common.unassigned')}</option>
                                                        {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                ) : (currentRow.church.name === '---' ? t('common.unassigned') : currentRow.church.name)}
                                            </td>
                                        </>
                                    )}

                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <select value={currentRow.status} onChange={e => handleEditChange('status', e.target.value)} className={selectClass}>
                                                <option value="IDENTIFICADO">{t('table.status.identified')}</option>
                                                <option value="NÃO IDENTIFICADO">{t('table.status.unidentified')}</option>
                                            </select>
                                        ) : (
                                            <div className="flex items-center justify-center">
                                                <StatusIcon row={currentRow} />
                                                {currentRow.divergence && (
                                                    <div className="relative group ml-1.5">
                                                        <button
                                                            onClick={() => openDivergenceModal(currentRow)}
                                                            className="p-0.5 rounded-full"
                                                            aria-label="Revisar divergência"
                                                        >
                                                            <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />
                                                        </button>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs px-3 py-2 text-xs text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                                            Divergência detectada! Este contribuinte geralmente está associado a outra igreja. Clique para revisar.
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center space-x-0.5">
                                            {isEditing ? (
                                                <>
                                                    <button onClick={handleSave} className="p-1.5 rounded-md text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-slate-700 transition-colors"><FloppyDiskIcon className="w-5 h-5" /></button>
                                                    <button onClick={handleCancel} className="p-1.5 rounded-md text-red-600 hover:bg-red-100 dark:text-red-500 dark:hover:bg-slate-700 transition-colors"><XCircleIcon className="w-5 h-5" /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleEditClick(result)} className="p-1.5 rounded-md text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-slate-700 transition-colors">
                                                        <PencilIcon className="w-5 h-5 stroke-current" />
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteConfirmation({ 
                                                            type: 'report-row', 
                                                            id: result.transaction.id, 
                                                            name: `a linha "${result.transaction.cleanedDescription || result.transaction.description}"` 
                                                        })}
                                                        className="p-1.5 rounded-md text-red-600 hover:bg-red-100 dark:text-red-500 dark:hover:bg-slate-700 transition-colors"
                                                        aria-label={t('common.delete')}
                                                    >
                                                        <TrashIcon className="w-5 h-5 stroke-current" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 px-4 py-3 sm:px-6 bg-white dark:bg-slate-800">
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                                Mostrando <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> a <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, data.length)}</span> de <span className="font-medium">{data.length}</span> resultados
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="sr-only">Anterior</span>
                                    <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                                </button>
                                <span className="relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {currentPage} de {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="sr-only">Próxima</span>
                                    <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </nav>
                        </div>
                    </div>
                    {/* Mobile Pagination */}
                    <div className="flex items-center justify-between sm:hidden w-full">
                         <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                        >
                            Anterior
                        </button>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});