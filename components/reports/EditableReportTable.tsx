import React, { useState, useContext, memo } from 'react';
import { MatchResult } from '../../types';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { PencilIcon, FloppyDiskIcon, XCircleIcon, CheckCircleIcon, ChevronUpIcon, ChevronDownIcon, TrashIcon } from '../Icons';
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
    const { churches, showToast, openManualMatchModal, openDeleteConfirmation } = useContext(AppContext);
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [draftRow, setDraftRow] = useState<MatchResult | null>(null);

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
        <div className="p-2 overflow-x-auto">
            <table className={`w-full text-base text-left text-slate-600 dark:text-slate-300 table-auto ${reportType === 'income' ? 'print-income-table' : 'print-expense-table'}`}>
                <thead className="text-sm text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                    <tr>
                        {reportType === 'income' ? (
                            <>
                                <SortableHeader sortKey="date" title={t('table.date')} sortConfig={sortConfig} onSort={onSort} className="w-[12%]" />
                                <SortableHeader sortKey="church.name" title={t('table.church')} sortConfig={sortConfig} onSort={onSort} className="w-[20%]" />
                                <SortableHeader sortKey="contributor.name" title={t('table.name')} sortConfig={sortConfig} onSort={onSort} className="w-[30%]" />
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
                    {data.map((result) => {
                        const isEditing = editingRowId === result.transaction.id;
                        const currentRow = isEditing ? draftRow! : result;
                        
                        const transactionDate = currentRow.transaction.date;
                        const contributorDate = currentRow.contributor?.date;
                        const datesDiffer = contributorDate && transactionDate && transactionDate !== contributorDate && !currentRow.transaction.id.startsWith('pending-');
                        const displayDate = contributorDate || transactionDate;

                        return (
                            <tr key={result.transaction.id} className={`bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 ${!isEditing && 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    {isEditing ? (
                                        <input type="text" value={displayDate} onChange={e => handleEditChange('transaction.date', e.target.value)} className={inputClass} />
                                    ) : datesDiffer ? (
                                        <div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400">Igr: <span className="text-slate-700 dark:text-slate-300">{contributorDate}</span></div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400">Ext: <span className="text-slate-700 dark:text-slate-300">{transactionDate}</span></div>
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
                                            ) : currentRow.status === 'IDENTIFICADO' && currentRow.contributor ? (
                                                    <div>
                                                        <div className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                            Igreja: <span className="font-medium text-slate-700 dark:text-slate-300">{currentRow.contributor.cleanedName || currentRow.contributor.name}</span>
                                                        </div>
                                                        <div className="text-sm text-slate-500 dark:text-slate-400">
                                                            Extrato: <span className="font-medium text-slate-700 dark:text-slate-300">{currentRow.transaction.cleanedDescription || currentRow.transaction.description}</span>
                                                        </div>
                                                    </div>
                                                ) : currentRow.contributor ? (
                                                    <div className="font-medium text-slate-800 dark:text-slate-200">{currentRow.contributor.cleanedName || currentRow.contributor.name}</div>
                                                ) : (
                                                    <div className="font-medium text-slate-800 dark:text-slate-200">{currentRow.transaction.cleanedDescription || currentRow.transaction.description}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="font-mono text-blue-700 dark:text-blue-400">{currentRow.similarity?.toFixed(0) ?? '0'}%</span>
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
                                        <div className="flex justify-center">
                                            <StatusIcon row={currentRow} />
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center space-x-2">
                                        {isEditing ? (
                                            <>
                                                <button onClick={handleSave} className="text-green-600 hover:text-green-500"><FloppyDiskIcon className="w-5 h-5" /></button>
                                                <button onClick={handleCancel} className="text-red-600 hover:text-red-500"><XCircleIcon className="w-5 h-5" /></button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => handleEditClick(result)} className="text-slate-500 hover:text-blue-600"><PencilIcon className="w-4 h-4" /></button>
                                                <button
                                                    onClick={() => openDeleteConfirmation({ 
                                                        type: 'report-row', 
                                                        id: result.transaction.id, 
                                                        name: `a linha "${result.transaction.cleanedDescription || result.transaction.description}"` 
                                                    })}
                                                    className="text-slate-500 hover:text-red-600"
                                                    aria-label={t('common.delete')}
                                                >
                                                    <TrashIcon className="w-4 h-4" />
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
    );
});