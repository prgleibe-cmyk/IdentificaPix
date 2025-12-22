
import React, { useState, useContext, memo, useEffect, useCallback } from 'react';
import { MatchResult, Church, Language } from '../../types';
import { AppContext } from '../../contexts/AppContext';
import { useUI } from '../../contexts/UIContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { PencilIcon, FloppyDiskIcon, XCircleIcon, ChevronUpIcon, ChevronDownIcon, TrashIcon, ExclamationTriangleIcon, ChevronLeftIcon, ChevronRightIcon, BuildingOfficeIcon, UserIcon, BanknotesIcon } from '../Icons';
import { PLACEHOLDER_CHURCH, cleanTransactionDescriptionForDisplay } from '../../services/processingService';

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
}> = memo(({ sortKey, title, sortConfig, onSort, className = '' }) => {
    const isSorted = sortConfig?.key === sortKey;
    const direction = sortConfig?.direction;

    return (
        <th scope="col" className={`px-4 py-3 text-left text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest ${className}`}>
            <button onClick={() => onSort(sortKey)} className="flex items-center gap-1.5 group hover:text-brand-blue dark:hover:text-blue-400 transition-colors focus:outline-none">
                <span>{title}</span>
                <span className={`transition-all duration-200 ${isSorted ? 'opacity-100 text-brand-blue' : 'opacity-0 group-hover:opacity-50'}`}>
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

const SourceBadge: React.FC<{ type: 'list' | 'bank'; className?: string }> = ({ type, className = '' }) => {
    const isList = type === 'list';
    return (
        <span className={`inline-flex items-center justify-center min-w-[45px] px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border select-none flex-shrink-0 ${
            isList 
            ? 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' 
            : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
        } ${className}`}>
            {isList ? 'Lista' : 'Extrato'}
        </span>
    );
};

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
    onCancel,
    customIgnoreKeywords
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
    customIgnoreKeywords: string[];
}) => {
    const currentRow = isEditing && draftRow ? draftRow : result;
    const isIdentified = currentRow.status === 'IDENTIFICADO';
    
    const transactionDate = currentRow.transaction.date;
    const contributorDate = currentRow.contributor?.date;
    const datesDiffer = isIdentified && contributorDate && transactionDate !== contributorDate;

    const contributorName = currentRow.contributor?.cleanedName || currentRow.contributor?.name;
    
    // CRÍTICO: Re-limpar a descrição bancária usando as keywords customizadas para garantir que fiquem invisíveis se cadastradas
    const transactionDesc = cleanTransactionDescriptionForDisplay(currentRow.transaction.description, customIgnoreKeywords);

    const txAmount = Math.abs(currentRow.transaction.amount);
    const expectedAmount = currentRow.contributorAmount !== undefined 
        ? Math.abs(currentRow.contributorAmount) 
        : (currentRow.contributor?.amount ? Math.abs(currentRow.contributor.amount) : 0);
    
    const amountsDiffer = isIdentified && currentRow.contributor && Math.abs(txAmount - expectedAmount) > 0.01;

    const inputClass = "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all shadow-sm h-7";
    const selectClass = "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all shadow-sm cursor-pointer h-7";

    const getSimilarityColor = (similarity: number | null | undefined) => {
        const value = similarity ?? 0;
        if (value >= 90) return 'text-emerald-500';
        if (value >= 70) return 'text-blue-500';
        if (value >= 50) return 'text-yellow-500';
        return 'text-red-500';
    };

    const StatusBadge = () => {
        if (currentRow.status === 'NÃO IDENTIFICADO') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 uppercase tracking-wide whitespace-nowrap">
                    Pendente
                </span>
            );
        }
        const isManual = currentRow.matchMethod === 'MANUAL';
        const isAI = currentRow.matchMethod === 'AI';
        const isLearned = currentRow.matchMethod === 'LEARNED';
        
        let bgClass = 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400';
        let label = 'Auto';

        if (isManual) {
            bgClass = 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400';
            label = 'Manual';
        } else if (isAI) {
            bgClass = 'bg-purple-50 border-purple-100 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400';
            label = 'IA';
        } else if (isLearned) {
            bgClass = 'bg-indigo-50 border-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400';
            label = 'Aprendido';
        }

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wide whitespace-nowrap ${bgClass}`}>
                {label}
            </span>
        );
    };

    const handleEditClick = () => {
        if (result.status === 'NÃO IDENTIFICADO' && result.transaction.id.startsWith('pending-') && reportType === 'income') {
            openManualMatchModal(result);
        } else {
            onEditStart(result);
        }
    };

    const avatarColors = [
        'bg-indigo-50 text-indigo-600 border-indigo-100',
        'bg-blue-50 text-blue-600 border-blue-100',
        'bg-violet-50 text-violet-600 border-violet-100',
        'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100'
    ];
    const avatarColor = avatarColors[currentRow.church.name.length % avatarColors.length];

    return (
        <tr className={`group bg-white dark:bg-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-all duration-200 border-b border-slate-50 dark:border-slate-700/50 last:border-0 ${isEditing ? 'bg-slate-50' : ''}`}>
            <td className="px-4 py-2.5 whitespace-nowrap align-top">
                {isEditing ? (
                    <input type="text" value={transactionDate} onChange={e => onEditChange('transaction.date', e.target.value)} className={inputClass} />
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {isIdentified && contributorDate ? (
                            <>
                                <div className="flex items-center gap-2" title="Data na Lista de Membros">
                                    <UserIcon className="w-3 h-3 text-indigo-400" />
                                    <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200 tabular-nums tracking-tight">
                                        {contributorDate}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2" title="Data no Extrato Bancário">
                                    <BanknotesIcon className="w-3 h-3 text-slate-400" />
                                    <span className={`font-mono text-[10px] tabular-nums tracking-tight ${datesDiffer ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                                        {transactionDate}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums tracking-tight">
                                {contributorDate || transactionDate}
                            </span>
                        )}
                    </div>
                )}
            </td>
            
            {reportType === 'income' ? (
                <>
                    <td className="px-4 py-2.5 align-top">
                        {isEditing ? (
                            <select value={currentRow.church.id} onChange={e => onEditChange('churchId', e.target.value)} className={selectClass}>
                                <option value="unidentified">{t('common.unassigned')}</option>
                                {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        ) : (
                            <div className="flex items-center">
                                {currentRow.church.name !== '---' && (
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold mr-2 border shrink-0 transition-transform group-hover:scale-105 ${avatarColor} dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600`}>
                                        {currentRow.church.name.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase() || '?'}
                                    </div>
                                )}
                                <span className={`text-xs font-semibold truncate max-w-[120px] ${currentRow.church.name === '---' ? 'text-slate-400 italic font-normal' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {currentRow.church.name === '---' ? t('common.unassigned') : currentRow.church.name}
                                </span>
                            </div>
                        )}
                    </td>

                    <td className="px-4 py-2.5 break-words min-w-[200px] align-top">
                        {isEditing ? (
                            <input type="text" value={currentRow.contributor?.name || ''} onChange={e => onEditChange('contributor.name', e.target.value)} className={inputClass} disabled={currentRow.status === 'NÃO IDENTIFICADO' && !currentRow.contributor} />
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {currentRow.contributor ? (
                                    <>
                                        <div className="flex items-start gap-2">
                                            <SourceBadge type="list" />
                                            <span className="text-xs font-bold leading-tight text-slate-900 dark:text-white pt-0.5" title="Nome na Lista">
                                                {contributorName || '---'}
                                            </span>
                                        </div>
                                        {isIdentified && (
                                            <div className="flex items-start gap-2">
                                                <SourceBadge type="bank" />
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight pt-0.5" title="Descrição no Extrato">
                                                    {transactionDesc || '---'}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-start gap-2">
                                            <SourceBadge type="bank" />
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-tight pt-0.5">
                                                {transactionDesc || '---'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </td>

                    <td className="px-4 py-2.5 text-center align-top">
                        {currentRow.similarity != null && currentRow.status === 'IDENTIFICADO' && (
                            <div className="flex flex-col items-center justify-center gap-0.5 pt-1">
                                <span className={`text-[10px] font-bold ${getSimilarityColor(currentRow.similarity)} tabular-nums`}>
                                    {currentRow.similarity.toFixed(0)}%
                                </span>
                                <div className={`w-8 h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden`}>
                                    <div className={`h-full ${getSimilarityColor(currentRow.similarity).replace('text-', 'bg-')}`} style={{ width: `${currentRow.similarity}%` }}></div>
                                </div>
                            </div>
                        )}
                    </td>

                    <td className="px-4 py-2.5 text-right whitespace-nowrap align-top">
                        <div className="flex flex-col items-end gap-1.5">
                            {isIdentified ? (
                                <>
                                    <div className="flex items-center gap-2" title="Valor na Lista">
                                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">
                                            {formatCurrency(expectedAmount, language)}
                                        </span>
                                        <UserIcon className="w-3 h-3 text-indigo-400" />
                                    </div>
                                    <div className="flex items-center gap-2" title="Valor no Extrato">
                                        <span className={`font-mono text-[10px] tabular-nums tracking-tight ${amountsDiffer ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                                            {formatCurrency(txAmount, language)}
                                        </span>
                                        <BanknotesIcon className="w-3 h-3 text-slate-400" />
                                    </div>
                                </>
                            ) : (
                                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">
                                    {formatCurrency(expectedAmount > 0 ? expectedAmount : txAmount, language)}
                                </span>
                            )}
                        </div>
                    </td>
                </>
            ) : (
                <>
                    <td className="px-4 py-2.5 break-words min-w-[200px] align-top">
                        {isEditing ? (
                                <input type="text" value={currentRow.transaction.description} onChange={e => onEditChange('transaction.description', e.target.value)} className={inputClass} />
                        ) : (
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                {transactionDesc}
                            </span>
                        )}
                    </td>

                    <td className="px-4 py-2.5 text-right whitespace-nowrap align-top">
                        {isEditing ? (
                            <input type="text" value={currentRow.transaction.originalAmount || currentRow.transaction.amount} onChange={e => onEditChange('transaction.amount', e.target.value)} className={`${inputClass} text-right`} />
                        ) : (
                            <span className={`${currentRow.transaction.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} font-mono text-xs font-bold tabular-nums tracking-tight`}>
                                {formatCurrency(currentRow.transaction.amount, language)}
                            </span>
                        )}
                    </td>

                    <td className="px-4 py-2.5 align-top">
                        {isEditing ? (
                            <select value={currentRow.church.id} onChange={e => onEditChange('churchId', e.target.value)} className={selectClass}>
                                <option value="unidentified">{t('common.unassigned')}</option>
                                {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        ) : (
                            <div className="flex items-center gap-2">
                                <BuildingOfficeIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span className={`text-xs font-medium ${currentRow.church.name === '---' ? 'text-slate-400 italic' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {currentRow.church.name === '---' ? t('common.unassigned') : currentRow.church.name}
                                </span>
                            </div>
                        )}
                    </td>
                </>
            )}

            <td className="px-4 py-2.5 text-center align-top">
                {isEditing ? (
                    <select value={currentRow.status} onChange={e => onEditChange('status', e.target.value)} className={selectClass}>
                        <option value="IDENTIFICADO">{t('table.status.identified')}</option>
                        <option value="NÃO IDENTIFICADO">{t('table.status.unidentified')}</option>
                    </select>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5">
                        <StatusBadge />
                        {currentRow.divergence && (
                            <button
                                onClick={() => openDivergenceModal(currentRow)}
                                className="p-0.5 rounded-full bg-yellow-100 text-yellow-600 hover:bg-yellow-200 transition-colors shadow-sm animate-pulse"
                                aria-label="Revisar divergência"
                            >
                                <ExclamationTriangleIcon className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                )}
            </td>

            <td className="px-4 py-2.5 text-center align-top">
                <div className={`flex items-center justify-center space-x-1 transition-opacity duration-200 ${isEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {isEditing ? (
                        <>
                            <button onClick={onSave} className="p-1 rounded-full text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition-colors shadow-sm" title={t('common.save')}><FloppyDiskIcon className="w-3.5 h-3.5" /></button>
                            <button onClick={onCancel} className="p-1 rounded-full text-slate-500 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm" title={t('common.cancel')}><XCircleIcon className="w-3.5 h-3.5" /></button>
                        </>
                    ) : (
                        <>
                            <button onClick={handleEditClick} className="p-1 rounded-full text-slate-400 hover:text-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title={t('common.edit')}>
                                <PencilIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => onDelete(result)}
                                className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                aria-label={t('common.delete')}
                            >
                                <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
});

export const EditableReportTable: React.FC<EditableReportTableProps> = memo(({ data, onRowChange, reportType, sortConfig, onSort }) => {
    const { t, language } = useTranslation();
    const { showToast } = useUI();
    const { churches, openManualMatchModal, openDeleteConfirmation, openDivergenceModal, customIgnoreKeywords } = useContext(AppContext);
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [draftRow, setDraftRow] = useState<MatchResult | null>(null);
    
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
            name: `a linha "${cleanTransactionDescriptionForDisplay(result.transaction.description, customIgnoreKeywords)}"`,
            meta: { reportType }
        });
    }, [openDeleteConfirmation, reportType, customIgnoreKeywords]);

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
            <div className="overflow-x-auto custom-scrollbar relative">
                <table className={`min-w-[800px] w-full text-left text-slate-600 dark:text-slate-300 ${reportType === 'income' ? 'print-income-table' : 'print-expense-table'}`}>
                    <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 backdrop-blur-md sticky top-0 z-20">
                        <tr>
                            {reportType === 'income' ? (
                                <>
                                    <SortableHeader sortKey="transaction.date" title={t('table.date')} sortConfig={sortConfig} onSort={onSort} className="w-[12%]" />
                                    <SortableHeader sortKey="church.name" title={t('table.church')} sortConfig={sortConfig} onSort={onSort} className="w-[20%]" />
                                    <SortableHeader sortKey="contributor.name" title="Contribuinte / Descrição" sortConfig={sortConfig} onSort={onSort} className="w-[30%]" />
                                    <SortableHeader sortKey="similarity" title="Simil." sortConfig={sortConfig} onSort={onSort} className="w-[8%] text-center" />
                                    <SortableHeader sortKey="contributor.amount" title="Valor" sortConfig={sortConfig} onSort={onSort} className="w-[15%] text-right" />
                                    <SortableHeader sortKey="status" title={t('table.status')} sortConfig={sortConfig} onSort={onSort} className="w-[8%] text-center" />
                                    <th scope="col" className="w-[7%] px-4 py-2.5 text-center"></th>
                                </>
                            ) : (
                                <>
                                    <SortableHeader sortKey="transaction.date" title={t('table.date')} sortConfig={sortConfig} onSort={onSort} className="w-[15%]" />
                                    <SortableHeader sortKey="transaction.description" title={t('table.supplier')} sortConfig={sortConfig} onSort={onSort} className="w-[40%]" />
                                    <SortableHeader sortKey="transaction.amount" title={t('table.amount')} sortConfig={sortConfig} onSort={onSort} className="w-[15%] text-right" />
                                    <SortableHeader sortKey="church.name" title={t('table.costCenter')} sortConfig={sortConfig} onSort={onSort} className="w-[15%]" />
                                    <SortableHeader sortKey="status" title={t('table.status')} sortConfig={sortConfig} onSort={onSort} className="w-[8%] text-center" />
                                    <th scope="col" className="w-[7%] px-4 py-2.5 text-center"></th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
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
                                customIgnoreKeywords={customIgnoreKeywords}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-800">
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                <span className="text-slate-700 dark:text-slate-200">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="text-slate-700 dark:text-slate-200">{Math.min(currentPage * ITEMS_PER_PAGE, data.length)}</span> de <span className="text-slate-900 dark:text-white">{data.length}</span>
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-full shadow-sm" aria-label="Pagination">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center px-3 py-1 rounded-l-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase"
                                >
                                    <ChevronLeftIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                                    Ant
                                </button>
                                <span className="relative inline-flex items-center px-3 py-1 border-t border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-[10px] font-black text-brand-blue dark:text-blue-400 min-w-[2rem] justify-center">
                                    {currentPage}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="relative inline-flex items-center px-3 py-1 rounded-r-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase"
                                >
                                    Prox
                                    <ChevronRightIcon className="h-3 w-3 ml-1" aria-hidden="true" />
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
