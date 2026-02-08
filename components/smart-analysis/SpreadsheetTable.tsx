
import React from 'react';
import { ChevronUpIcon, ChevronDownIcon, XMarkIcon, PlusCircleIcon, TrashIcon } from '../Icons';
import { ColumnDef, ManualRow } from '../../types';
import { analysisProcessor, SortConfig } from '../../services/analysisProcessor';
import { formatCurrency } from '../../utils/formatters';

interface SpreadsheetTableProps {
    columns: ColumnDef[];
    rows: ManualRow[];
    onSort: (colId: string) => void;
    sortConfig: SortConfig | null;
    onUpdateColumnLabel: (id: string, lbl: string) => void;
    onRemoveColumn: (colId: string) => void;
    onUpdateRow: (id: string, field: string, value: any) => void;
    onDeleteRow: (id: string) => void;
    onOpenSumModal: (rowId: string, colId: string, currentVal: number) => void;
    summaryData: any;
}

export const SpreadsheetTable: React.FC<SpreadsheetTableProps> = ({
    columns, rows, onSort, sortConfig, onUpdateColumnLabel, onRemoveColumn, 
    onUpdateRow, onDeleteRow, onOpenSumModal, summaryData
}) => (
    <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700">
            <tr>
                {columns.map(col => (
                    <th key={col.id} className={`px-6 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest group ${['income','expense','balance'].includes(col.id) ? 'text-right' : col.id === 'index' ? 'text-center w-16' : ''}`}>
                        <div className={`flex items-center gap-2 ${['income','expense','balance'].includes(col.id) ? 'justify-end' : col.id === 'index' ? 'justify-center' : 'justify-start'}`}>
                            {col.removable ? <input type="text" value={col.label} onChange={(e) => onUpdateColumnLabel(col.id, e.target.value)} className="bg-transparent outline-none w-24 text-center border-b border-transparent focus:border-brand-blue" /> : <span className="cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" onClick={() => onSort(col.id)}>{col.label}</span>}
                            <button onClick={() => onSort(col.id)} className={`transition-colors ${sortConfig?.key === col.id ? 'text-brand-blue' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}>{sortConfig?.key === col.id && sortConfig.direction === 'desc' ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronUpIcon className="w-3 h-3" />}</button>
                            {col.removable && <button onClick={() => onRemoveColumn(col.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><XMarkIcon className="w-3 h-3" /></button>}
                        </div>
                    </th>
                ))}
                <th className="w-10"></th>
            </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {rows.length > 0 ? rows.map((row, idx) => (
                <tr key={row.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    {columns.map(col => (
                        <td key={col.id} className={`px-6 py-1.5 ${['income','expense','balance'].includes(col.id) ? 'text-right' : ''}`}>
                            {col.id === 'index' ? <span className="text-xs font-bold text-slate-500">{idx+1}</span> :
                                col.id === 'balance' ? <span className="text-xs font-black text-slate-900 dark:text-white font-mono">{formatCurrency(row.income - row.expense)}</span> :
                                col.type === 'currency' ? (
                                <div className="flex items-center justify-end gap-2 group/cell">
                                    <button onClick={() => onOpenSumModal(row.id, col.id, row[col.id] as number)} className="opacity-0 group-hover/cell:opacity-100 p-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-brand-blue transition-all" title="Somar valor"><PlusCircleIcon className="w-3.5 h-3.5" /></button>
                                    <input type="text" value={analysisProcessor.formatBRLInput(row[col.id] as number)} onChange={(e) => onUpdateRow(row.id, col.id, analysisProcessor.parseBRLInput(e.target.value))} className={`w-28 bg-transparent font-bold text-xs text-right focus:outline-none font-mono ${col.id === 'income' ? 'text-emerald-600' : 'text-red-600'}`} />
                                </div>
                                ) : <input value={row[col.id] || ''} onChange={(e) => onUpdateRow(row.id, col.id, col.type === 'number' ? e.target.value.replace(/\D/g, '') : e.target.value)} className={`w-full bg-transparent font-bold text-slate-700 dark:text-slate-200 text-xs focus:outline-none ${col.id === 'qty' ? 'text-center' : 'uppercase break-words'}`} placeholder={col.label.toUpperCase()} />}
                        </td>
                    ))}
                    <td className="px-2 py-1.5 text-center"><button onClick={() => onDeleteRow(row.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><TrashIcon className="w-4 h-4" /></button></td>
                </tr>
            )) : null}
        </tbody>
        <tfoot className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-700 font-bold text-xs">
            <tr className="text-slate-800 dark:text-white">
                {columns.map(col => (
                    <td key={col.id} className={`px-6 py-2.5 ${['income','expense','balance','qty'].includes(col.id) ? 'text-right' : ''}`}>
                        {col.id === 'description' ? 'RESUMO GERAL:' : 
                            col.id === 'income' ? formatCurrency(summaryData.income) :
                            col.id === 'expense' ? formatCurrency(summaryData.expense) :
                            col.id === 'balance' ? formatCurrency(summaryData.income - summaryData.expense) :
                            col.id === 'qty' ? <div className="text-center">{summaryData.qty}</div> : ''}
                    </td>
                ))}
                <td className="px-2 py-2.5"></td>
            </tr>
        </tfoot>
    </table>
);
