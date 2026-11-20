import React from 'react';
import { CheckCircleIcon, BrainIcon, PlayCircleIcon } from '../../Icons';

interface ChoiceStepProps {
    onManual: () => void;
    onTeach: () => void;
    onExecute: () => void;
    onRefresh: () => void;
    activeMacro: any;
}

export const ChoiceStep: React.FC<ChoiceStepProps> = ({ 
    onManual, onTeach, onExecute, onRefresh, activeMacro 
}) => (
    <div className="flex flex-col gap-2.5">
        <button 
            onClick={onManual}
            className="flex items-center gap-3 p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 rounded-xl hover:border-emerald-500 transition-colors text-left group cursor-pointer"
        >
            <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-xs shrink-0">
                <CheckCircleIcon className="w-5 h-5" />
            </div>
            <div>
                <h4 className="font-semibold text-emerald-800 dark:text-emerald-300 text-xs">1. Lançamento Manual</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Confirmar todos os itens sem usar automação.</p>
            </div>
        </button>

        <button 
            onClick={onTeach}
            className="flex items-center gap-3 p-3 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 rounded-xl hover:border-orange-500 transition-colors text-left group cursor-pointer"
        >
            <div className="p-2 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg text-orange-600 dark:text-orange-400 shrink-0">
                <BrainIcon className="w-5 h-5" />
            </div>
            <div>
                <h4 className="font-semibold text-slate-900 dark:text-white text-xs">2. Ensinar Novo</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Grave as ações manuais para a IA aprender.</p>
            </div>
        </button>

        <div className="relative group">
            <button 
                onClick={onExecute}
                disabled={!activeMacro}
                className={`w-full flex items-center gap-3 p-3 border rounded-xl transition-colors text-left ${!activeMacro ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 hover:border-orange-500 cursor-pointer'}`}
            >
                <div className={`p-2 rounded-lg transition-colors shrink-0 ${!activeMacro ? 'bg-slate-200 dark:bg-slate-800 text-slate-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'}`}>
                    <PlayCircleIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 pr-10">
                    <h4 className="font-semibold text-slate-900 dark:text-white text-xs">
                        {activeMacro ? `3. Iniciar Lançamento IA` : '3. Sem Percurso'}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        {activeMacro ? `Lançar todos os itens via IA.` : 'Ensine a IA antes de poder executar.'}
                    </p>
                </div>
            </button>
            {!activeMacro && (
                <button 
                    onClick={onRefresh}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-[10px] font-semibold hover:bg-orange-600 hover:text-white transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                    Atu.
                </button>
            )}
        </div>
    </div>
);