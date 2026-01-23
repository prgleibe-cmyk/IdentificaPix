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
            className="flex items-center gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-xl hover:border-emerald-500 hover:shadow-sm transition-all text-left group"
        >
            <div className="p-2 bg-emerald-500 text-white rounded-lg group-hover:scale-110 transition-transform shadow-sm">
                <CheckCircleIcon className="w-5 h-5" />
            </div>
            <div>
                <h4 className="font-black text-emerald-800 dark:text-emerald-400 uppercase text-[10px]">1. Lançamento Manual</h4>
                <p className="text-[8px] text-slate-500 leading-tight">Confirmar todos os itens sem usar automação.</p>
            </div>
        </button>

        <button 
            onClick={onTeach}
            className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-brand-blue hover:shadow-sm transition-all text-left group"
        >
            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600 group-hover:scale-110 transition-transform">
                <BrainIcon className="w-5 h-5" />
            </div>
            <div>
                <h4 className="font-black text-slate-800 dark:text-white uppercase text-[10px]">2. Ensinar Novo</h4>
                <p className="text-[8px] text-slate-500 leading-tight">Grave as ações manuais para a IA aprender.</p>
            </div>
        </button>

        <div className="relative group">
            <button 
                onClick={onExecute}
                disabled={!activeMacro}
                className={`w-full flex items-center gap-3 p-3 border rounded-xl transition-all text-left ${!activeMacro ? 'opacity-40 grayscale cursor-not-allowed bg-slate-50 border-slate-100' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 hover:border-amber-500 hover:shadow-sm'}`}
            >
                <div className={`p-2 rounded-lg transition-colors ${!activeMacro ? 'bg-slate-200 text-slate-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}`}>
                    <PlayCircleIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <h4 className="font-black text-slate-800 dark:text-white uppercase text-[10px]">
                        {activeMacro ? `3. Iniciar Lançamento IA` : '3. Sem Percurso'}
                    </h4>
                    <p className="text-[8px] text-slate-500 leading-tight">
                        {activeMacro ? `Lançar todos os itens via IA.` : 'Ensine a IA antes de poder executar.'}
                    </p>
                </div>
            </button>
            {!activeMacro && (
                <button 
                    onClick={onRefresh}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-brand-blue hover:text-white transition-all border border-slate-200 dark:border-slate-600"
                >
                    Atu.
                </button>
            )}
        </div>
    </div>
);