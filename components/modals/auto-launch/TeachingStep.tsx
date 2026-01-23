import React from 'react';
import { BrainIcon, ShieldCheckIcon } from '../../Icons';

interface TeachingStepProps {
    onStop: () => void;
}

export const TeachingStep: React.FC<TeachingStepProps> = ({ onStop }) => (
    <div className="text-center py-2 space-y-4">
        <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 bg-purple-500/20 rounded-full animate-ping"></div>
            <div className="relative bg-purple-600 text-white p-3 rounded-full shadow-xl">
                <BrainIcon className="w-6 h-6" />
            </div>
        </div>
        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">Gravando Percurso...</h4>
        <button 
            onClick={onStop} 
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
        >
            <ShieldCheckIcon className="w-3.5 h-3.5" /> Salvar Aprendizado
        </button>
    </div>
);