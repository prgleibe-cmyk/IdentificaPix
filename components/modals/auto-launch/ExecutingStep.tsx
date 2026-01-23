import React from 'react';
import { PlayCircleIcon, CheckBadgeIcon } from '../../Icons';
import { formatCurrency } from '../../../utils/formatters';
import { Language } from '../../../types';

interface ExecutingStepProps {
    isFinished: boolean;
    currentItem: any;
    currentIndex: number;
    total: number;
    onClose: () => void;
    language: Language;
}

export const ExecutingStep: React.FC<ExecutingStepProps> = ({ 
    isFinished, currentItem, currentIndex, total, onClose, language 
}) => {
    const progress = Math.round((currentIndex / total) * 100);

    return (
        <div className="space-y-4">
            {!isFinished ? (
                <div className="flex flex-col gap-3 animate-fade-in">
                    <div className="bg-slate-900 p-4 rounded-xl text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-blue/10 rounded-full blur-3xl"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-1.5 mb-2">
                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">IA em Operação</span>
                            </div>
                            <h4 className="text-[11px] font-black tracking-tight mb-1 truncate uppercase">
                                {currentItem?.contributor?.name || currentItem?.transaction.description}
                            </h4>
                            <p className="text-lg font-black text-emerald-400 font-mono tracking-tighter leading-none">
                                {formatCurrency(currentItem?.transaction.amount || 0, language)}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 py-1">
                        <div className="flex items-center gap-1.5 text-brand-blue font-black text-[9px] uppercase tracking-widest animate-pulse">
                            <PlayCircleIcon className="w-3.5 h-3.5" /> IA processando...
                        </div>
                        <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-blue animate-progress"></div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-4 animate-scale-in">
                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-800">
                        <CheckBadgeIcon className="w-7 h-7 text-emerald-500" />
                    </div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Lote Concluído</h3>
                    <button 
                        onClick={onClose}
                        className="mt-6 w-full py-3 bg-brand-blue hover:bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                    >
                        Fechar Janela
                    </button>
                </div>
            )}

            <div className="space-y-1.5">
                <div className="flex justify-between text-[7px] font-black uppercase text-slate-400 tracking-widest">
                    <span>Progresso do Lote</span>
                    <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div 
                        className="bg-emerald-500 h-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};