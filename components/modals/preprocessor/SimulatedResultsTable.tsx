
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
    // Só mostra o carregamento total se a lista estiver realmente vazia e não houver cache de dump.
    if (isSimulating && transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-white dark:bg-slate-900 animate-fade-in">
                <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-900/50 flex items-center justify-center mb-4">
                    <ArrowPathIcon className="w-6 h-6 text-orange-600 dark:text-orange-400 animate-spin" />
                </div>
                <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">Processando Documento</h5>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Aguarde enquanto o sistema analisa e extrai as transações do seu extrato de forma determinística e segura.
                </p>
            </div>
        );
    }

    if (transactions.length === 0 && !isSimulating) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-white dark:bg-slate-900">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 flex items-center justify-center mb-4">
                    <TableCellsIcon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                </div>
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Aguardando Dados</h5>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Carregue um arquivo para visualizar as linhas e iniciar o treinamento do modelo.
                </p>
            </div>
        );
    }

    return (
        <div className="relative h-full">
            {/* Barra de progresso discreta no topo durante re-simulação com dados na tela */}
            {isSimulating && (
                <div className="absolute top-0 inset-x-0 h-1 z-30 overflow-hidden bg-orange-100/60 dark:bg-orange-950/40">
                    <div className="h-full bg-orange-600 animate-progress w-1/3"></div>
                </div>
            )}
            
            <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50/95 dark:bg-slate-800/90 z-10 border-b border-slate-200/90 dark:border-slate-800">
                    <tr>
                        <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 w-24 uppercase tracking-wider">Data</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Descrição Extraída</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 w-24 uppercase tracking-wider">Tipo</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 w-24 uppercase tracking-wider">Forma</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 text-right w-28 uppercase tracking-wider">Valor</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 text-center w-16 uppercase tracking-wider">Ação</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {transactions.map((tx, idx) => {
                        const isEditing = editingRowIndex === idx;
                        const isPending = tx.status === 'pending';
                        const isInvalid = !tx.isValid && tx.status === 'error'; 
                        const isIgnored = tx.status === 'ignored';
                        
                        if (isEditing && editingRowData) {
                            return (
                                <tr key={tx.id} className="bg-orange-50/60 dark:bg-orange-950/20">
                                    <td className="p-2">
                                        <input type="text" value={editingRowData.date || ''} onChange={(e) => onUpdateEditingData({...editingRowData, date: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-orange-500 outline-none rounded-md px-2 py-1 text-xs font-medium tabular-nums" />
                                    </td>
                                    <td className="p-2">
                                        <input type="text" value={editingRowData.description || ''} onChange={(e) => onUpdateEditingData({...editingRowData, description: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-orange-500 outline-none rounded-md px-2 py-1 text-xs font-medium" />
                                    </td>
                                    <td className="p-2">
                                        <input type="text" value={editingRowData.contributionType || ''} onChange={(e) => onUpdateEditingData({...editingRowData, contributionType: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-orange-500 outline-none rounded-md px-2 py-1 text-xs font-medium" />
                                    </td>
                                    <td className="p-2">
                                        <input type="text" value={editingRowData.paymentMethod || ''} onChange={(e) => onUpdateEditingData({...editingRowData, paymentMethod: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-orange-500 outline-none rounded-md px-2 py-1 text-xs font-medium" />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={editingRowData.amount} 
                                            onChange={(e) => onUpdateEditingData({...editingRowData, amount: parseFloat(e.target.value) || 0})} 
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-orange-500 outline-none rounded-md px-2 py-1 text-xs text-right font-semibold tabular-nums" 
                                        />
                                    </td>
                                    <td className="p-2 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={onSaveRow} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md transition-colors"><CheckCircleIcon className="w-4 h-4" /></button>
                                            <button onClick={onCancelEdit} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }

                        return (
                            <tr key={tx.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group ${isIgnored ? 'opacity-35 bg-slate-100 dark:bg-slate-900 pointer-events-none grayscale' : isInvalid ? 'opacity-70 bg-red-50/30 dark:bg-red-950/20' : isPending ? 'bg-amber-50/30 dark:bg-amber-950/15' : ''}`}>
                                <td className="px-3 py-2.5 tabular-nums text-xs text-slate-600 dark:text-slate-300">
                                    {tx.date && tx.date.includes('-') ? tx.date.split('-').reverse().join('/') : (tx.date || '---')}
                                </td>
                                <td className="px-3 py-2.5">
                                    <div className={`font-semibold truncate max-w-[300px] ${isInvalid ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                        {tx.description}
                                    </div>
                                </td>
                                <td className="px-3 py-2.5">
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase text-[11px] font-semibold">
                                        {tx.contributionType || 'OUTROS'}
                                    </span>
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 uppercase text-[11px] font-medium">{tx.paymentMethod || 'OUTROS'}</td>
                                <td className={`px-3 py-2.5 text-right tabular-nums text-xs font-semibold ${tx.amount < 0 ? 'text-red-600 dark:text-red-400' : tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                    {formatToBRL(tx.amount)}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                    {!isIgnored && (
                                        <button onClick={() => onStartEdit(tx, idx)} className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                            <PencilIcon className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
