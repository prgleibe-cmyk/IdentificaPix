
import React from 'react';
import { PencilIcon, CheckCircleIcon, XMarkIcon, SparklesIcon, TableCellsIcon, ArrowPathIcon } from '../../Icons';

interface SimulatedResultsTableProps {
    transactions: any[];
    activeMapping: boolean;
    isTestMode: boolean;
    editingRowIndex: number | null;
    editingRowData: any | null;
    isSimulating?: boolean;
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
    isSimulating,
    onStartEdit,
    onSaveRow,
    onCancelEdit,
    onUpdateEditingData
}) => {
    if (isSimulating) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-white dark:bg-[#0F172A] animate-fade-in">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                    <ArrowPathIcon className="w-12 h-12 text-indigo-500 animate-spin relative z-10" />
                </div>
                <h5 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[0.2em] mb-2">IA Lendo Documento</h5>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto leading-relaxed font-bold">
                    Aguarde enquanto o Gemini extrai as transações do seu extrato visualmente.
                </p>
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-white dark:bg-[#0F172A]">
                <div className="relative mb-4">
                    <TableCellsIcon className="w-12 h-12 text-slate-200 relative z-10" />
                </div>
                <h5 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Aguardando Dados</h5>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto leading-relaxed">
                    Carregue um arquivo para visualizar as linhas e iniciar o treinamento do modelo.
                </p>
            </div>
        );
    }

    return (
        <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                <tr>
                    <th className="p-3 font-bold text-slate-500 dark:text-slate-400 w-24 uppercase tracking-tighter">Data</th>
                    <th className="p-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter">Descrição Extraída</th>
                    <th className="p-3 font-bold text-slate-500 dark:text-slate-400 w-24 uppercase tracking-tighter">Tipo</th>
                    <th className="p-3 font-bold text-slate-500 dark:text-slate-400 w-24 uppercase tracking-tighter">Forma</th>
                    <th className="p-3 font-bold text-slate-500 dark:text-slate-400 text-right w-28 uppercase tracking-tighter">Valor</th>
                    <th className="p-3 font-bold text-slate-500 dark:text-slate-400 text-center w-16 uppercase tracking-tighter">Ação</th>
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
                                    <input type="text" value={editingRowData.date || ''} onChange={(e) => onUpdateEditingData({...editingRowData, date: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs font-bold" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={editingRowData.description || ''} onChange={(e) => onUpdateEditingData({...editingRowData, description: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs font-bold" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={editingRowData.contributionType || ''} onChange={(e) => onUpdateEditingData({...editingRowData, contributionType: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs font-bold" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={editingRowData.paymentMethod || ''} onChange={(e) => onUpdateEditingData({...editingRowData, paymentMethod: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs font-bold" />
                                </td>
                                <td className="p-2">
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={editingRowData.amount} 
                                        onChange={(e) => onUpdateEditingData({...editingRowData, amount: parseFloat(e.target.value) || 0})} 
                                        className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs text-right font-black" 
                                    />
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
                        <tr key={tx.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${isIgnored ? 'opacity-30 bg-slate-100 dark:bg-slate-900 pointer-events-none grayscale' : isInvalid ? 'opacity-60 bg-red-50/20' : isPending ? 'bg-amber-50/20 dark:bg-amber-900/10' : ''}`}>
                            <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                                {tx.date && tx.date.includes('-') ? tx.date.split('-').reverse().join('/') : (tx.date || '---')}
                            </td>
                            <td className="p-3">
                                <div className={`font-bold truncate max-w-[300px] ${isInvalid ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'}`}>
                                    {tx.description}
                                </div>
                            </td>
                            <td className="p-3 text-slate-500 uppercase text-[10px] font-medium">{tx.contributionType || 'OUTROS'}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-black italic">{tx.paymentMethod || 'OUTROS'}</td>
                            <td className={`p-3 text-right font-mono font-black ${tx.amount < 0 ? 'text-red-500' : tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                {formatToBRL(tx.amount)}
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
