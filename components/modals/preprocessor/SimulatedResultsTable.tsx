
import React from 'react';
import { PencilIcon, CheckCircleIcon, XMarkIcon, DocumentArrowDownIcon } from '../../Icons';

interface SimulatedResultsTableProps {
    transactions: any[];
    activeMapping: boolean;
    isTestMode: boolean;
    editingRowIndex: number | null;
    editingRowData: any | null;
    onStartEdit: (tx: any, idx: number) => void;
    onSaveRow: () => void;
    onCancelEdit: () => void;
    onUpdateEditingData: (data: any) => void;
}

const formatToBRL = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return 'R$ 0,00';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const SimulatedResultsTable: React.FC<SimulatedResultsTableProps> = ({
    transactions,
    activeMapping,
    isTestMode,
    editingRowIndex,
    editingRowData,
    onStartEdit,
    onSaveRow,
    onCancelEdit,
    onUpdateEditingData
}) => {
    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                <DocumentArrowDownIcon className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-bold text-slate-500 dark:text-slate-300">Aguardando simulação</p>
                <p className="text-xs mt-2 max-w-xs mx-auto opacity-70">
                    Configure o mapeamento e clique em "Simular".
                </p>
            </div>
        );
    }

    return (
        <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                <tr>
                    <th className="p-3 font-bold text-slate-500 dark:text-slate-400 w-24">Data</th>
                    <th className="p-3 font-bold text-slate-500 dark:text-slate-400">Descrição (Limpa)</th>
                    <th className="p-3 font-bold text-slate-500 dark:text-slate-400 w-24">Tipo</th>
                    <th className="p-3 font-bold text-slate-500 dark:text-slate-400 text-right w-28">Valor</th>
                    <th className="p-3 font-bold text-slate-500 dark:text-slate-400 text-center w-16">Ação</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {transactions.map((tx, idx) => {
                    const isEditing = editingRowIndex === idx;
                    const isPending = tx.status === 'pending';
                    const isInvalid = !tx.isValid && tx.status === 'error'; 
                    const isIgnored = tx.status === 'ignored';
                    
                    if (isEditing && editingRowData) {
                        return (
                            <tr key={tx.id} className="bg-blue-50 dark:bg-blue-900/20">
                                <td className="p-2">
                                    <input type="text" value={editingRowData.date} onChange={(e) => onUpdateEditingData({...editingRowData, date: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={editingRowData.cleanedDescription} onChange={(e) => onUpdateEditingData({...editingRowData, cleanedDescription: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={editingRowData.contributionType || ''} onChange={(e) => onUpdateEditingData({...editingRowData, contributionType: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={editingRowData.amount} onChange={(e) => onUpdateEditingData({...editingRowData, amount: parseFloat(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs text-right" />
                                </td>
                                <td className="p-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <button onClick={onSaveRow} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-colors"><CheckCircleIcon className="w-4 h-4" /></button>
                                        <button onClick={onCancelEdit} className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        );
                    }

                    return (
                        <tr key={tx.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${isIgnored ? 'opacity-30 bg-slate-100 dark:bg-slate-900 pointer-events-none grayscale' : isInvalid ? 'opacity-60 bg-red-50/20' : isPending ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                            <td className="p-3 font-mono text-slate-600 dark:text-slate-300 truncate max-w-[100px]" title={tx.date}>
                                {activeMapping && tx.isValid ? tx.date.split('-').reverse().join('/') : tx.date}
                            </td>
                            <td className="p-3">
                                <div className={`font-bold truncate max-w-[300px] ${isInvalid ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'} ${isIgnored ? 'line-through' : ''}`} title={tx.cleanedDescription}>
                                    {tx.cleanedDescription}
                                </div>
                                {isIgnored && <span className="text-[8px] uppercase font-bold text-slate-400">Ignorado</span>}
                                {isPending && <span className="text-[8px] uppercase font-bold text-amber-500">Pendente</span>}
                            </td>
                            <td className="p-3 text-slate-500 uppercase text-[10px]">{tx.contributionType || 'OUTROS'}</td>
                            <td className={`p-3 text-right font-mono font-bold ${tx.amount < 0 ? 'text-red-500' : tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                {activeMapping ? formatToBRL(tx.amount) : '-'}
                            </td>
                            <td className="p-3 text-center">
                                {!isIgnored && (
                                    <button onClick={() => onStartEdit(tx, idx)} className="p-1.5 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                        <PencilIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};
