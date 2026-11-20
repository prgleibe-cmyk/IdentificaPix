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
                    <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-xl text-white border border-slate-800 shadow-xs relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-1.5 mb-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">IA em Operação</span>
                            </div>
                            <h4 className="text-xs font-bold tracking-tight mb-1 truncate">
                                {currentItem?.contributor?.name || currentItem?.transaction.description}
                            </h4>
                            <p className="text-lg font-bold text-emerald-400 font-mono tabular-nums tracking-tight leading-none">
                                {formatCurrency(currentItem?.transaction.amount || 0, language)}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 py-1">
                        <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-semibold text-xs">
                            <PlayCircleIcon className="w-4 h-4 animate-spin" /> IA processando...
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-600 animate-progress"></div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-4 animate-scale-in">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center mx-auto mb-3 border border-emerald-200/80 dark:border-emerald-900/50">
                        <CheckBadgeIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Lote Concluído</h3>
                    <button 
                        onClick={onClose}
                        className="mt-5 w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                        Fechar Janela
                    </button>
                </div>
            )}

            <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                    <span>Progresso do Lote</span>
                    <span className="tabular-nums">{progress}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                        className="bg-emerald-600 h-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};