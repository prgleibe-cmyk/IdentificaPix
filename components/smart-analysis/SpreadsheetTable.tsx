
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
        <thead className="bg-slate-50/90 dark:bg-slate-800/80 sticky top-0 z-10 border-b border-slate-200/90 dark:border-slate-800">
            <tr>
                {columns.map(col => (
                    <th key={col.id} className={`px-5 py-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide group ${['income','expense','balance'].includes(col.id) ? 'text-right' : col.id === 'index' ? 'text-center w-16' : ''}`}>
                        <div className={`flex items-center gap-1.5 ${['income','expense','balance'].includes(col.id) ? 'justify-end' : col.id === 'index' ? 'justify-center' : 'justify-start'}`}>
                            {col.removable ? <input type="text" value={col.label} onChange={(e) => onUpdateColumnLabel(col.id, e.target.value)} className="bg-transparent outline-none w-24 text-center border-b border-transparent focus:border-orange-500" /> : <span className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors" onClick={() => onSort(col.id)}>{col.label}</span>}
                            <button onClick={() => onSort(col.id)} className={`transition-colors cursor-pointer ${sortConfig?.key === col.id ? 'text-orange-600 dark:text-orange-400' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}>{sortConfig?.key === col.id && sortConfig.direction === 'desc' ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronUpIcon className="w-3 h-3" />}</button>
                            {col.removable && <button onClick={() => onRemoveColumn(col.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><XMarkIcon className="w-3 h-3" /></button>}
                        </div>
                    </th>
                ))}
                <th className="w-10"></th>
            </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {rows.length > 0 ? rows.map((row, idx) => (
                <tr key={row.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    {columns.map(col => (
                        <td key={col.id} className={`px-5 py-2 ${['income','expense','balance'].includes(col.id) ? 'text-right' : ''}`}>
                            {col.id === 'index' ? <span className="text-xs font-semibold text-slate-500 tabular-nums">{idx+1}</span> :
                                col.id === 'balance' ? <span className="text-xs font-bold text-slate-900 dark:text-white font-mono tabular-nums">{formatCurrency(row.income - row.expense)}</span> :
                                col.type === 'currency' ? (
                                <div className="flex items-center justify-end gap-2 group/cell">
                                    <button onClick={() => onOpenSumModal(row.id, col.id, row[col.id] as number)} className="opacity-0 group-hover/cell:opacity-100 p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-orange-600 transition-colors cursor-pointer" title="Somar valor"><PlusCircleIcon className="w-3.5 h-3.5" /></button>
                                    <input type="text" value={analysisProcessor.formatBRLInput(row[col.id] as number)} onChange={(e) => onUpdateRow(row.id, col.id, analysisProcessor.parseBRLInput(e.target.value))} className={`w-28 bg-transparent font-semibold text-xs text-right focus:outline-none font-mono tabular-nums ${col.id === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} />
                                </div>
                                ) : <input value={row[col.id] || ''} onChange={(e) => onUpdateRow(row.id, col.id, col.type === 'number' ? e.target.value.replace(/\D/g, '') : e.target.value)} className={`w-full bg-transparent font-semibold text-slate-700 dark:text-slate-200 text-xs focus:outline-none ${col.id === 'qty' ? 'text-center tabular-nums' : 'uppercase break-words'}`} placeholder={col.label.toUpperCase()} />}
                        </td>
                    ))}
                    <td className="px-2 py-2 text-center"><button onClick={() => onDeleteRow(row.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"><TrashIcon className="w-4 h-4" /></button></td>
                </tr>
            )) : null}
        </tbody>
        <tfoot className="bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200/90 dark:border-slate-700 font-semibold text-xs">
            <tr className="text-slate-800 dark:text-white">
                {columns.map(col => (
                    <td key={col.id} className={`px-5 py-2.5 tabular-nums ${['income','expense','balance','qty'].includes(col.id) ? 'text-right font-mono font-bold' : ''}`}>
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
