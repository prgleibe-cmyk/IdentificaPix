
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
    <div
        className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
        <form onSubmit={onConfirmSum} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-elevated border border-slate-200/90 dark:border-slate-800 w-full max-w-xs animate-scale-in">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><PlusCircleIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" /> Adicionar Valor</h4>
                <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"><XMarkIcon className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-xl text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide">Valor Atual</p>
                    <p className="text-lg font-mono font-bold text-slate-800 dark:text-slate-100 tabular-nums mt-0.5">{formatCurrency(sumModal.currentValue)}</p>
                </div>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">+</span>
                    <input autoFocus type="text" value={analysisProcessor.formatBRLInput(analysisProcessor.parseBRLInput(sumValue))} onChange={(e) => onSumValueChange(e.target.value)} className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors tabular-nums" placeholder="0,00" />
                </div>
                <button type="submit" className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors cursor-pointer">Confirmar Soma</button>
            </div>
        </form>
    </div>
);
