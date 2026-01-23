
import React from 'react';
import { PlusCircleIcon, XMarkIcon } from '../Icons';
import { analysisProcessor } from '../../services/analysisProcessor';
import { formatCurrency } from '../../utils/formatters';

interface SummationModalProps {
    sumModal: { isOpen: boolean, rowId: string, colId: string, currentValue: number };
    sumValue: string;
    onClose: () => void;
    onSumValueChange: (val: string) => void;
    onConfirmSum: (e: React.FormEvent) => void;
}

export const SummationModal: React.FC<SummationModalProps> = ({ 
    sumModal, sumValue, onClose, onSumValueChange, onConfirmSum 
}) => (
    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50 animate-fade-in">
        <form onSubmit={onConfirmSum} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-80 animate-scale-in">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2"><PlusCircleIcon className="w-4 h-4 text-brand-blue" /> Adicionar Valor</h4>
                <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Valor Atual</p>
                    <p className="text-xl font-mono font-black text-slate-700 dark:text-slate-300">{formatCurrency(sumModal.currentValue)}</p>
                </div>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">+</span>
                    <input autoFocus type="text" value={analysisProcessor.formatBRLInput(analysisProcessor.parseBRLInput(sumValue))} onChange={(e) => onSumValueChange(e.target.value)} className="w-full pl-8 pr-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-lg font-bold text-emerald-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="0,00" />
                </div>
                <button type="submit" className="w-full py-3 bg-brand-blue hover:bg-blue-600 text-white rounded-xl font-bold uppercase text-xs tracking-wide shadow-lg transition-all active:scale-95">Confirmar Soma</button>
            </div>
        </form>
    </div>
);
