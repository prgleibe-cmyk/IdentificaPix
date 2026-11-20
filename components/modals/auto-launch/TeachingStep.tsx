import React from 'react';
import { BrainIcon, ShieldCheckIcon } from '../../Icons';

interface TeachingStepProps {
    onStop: () => void;
}

export const TeachingStep: React.FC<TeachingStepProps> = ({ onStop }) => (
    <div className="text-center py-2 space-y-4">
        <div className="relative w-12 h-12 mx-auto">
            <div className="relative bg-orange-600 text-white p-3 rounded-xl shadow-xs">
                <BrainIcon className="w-6 h-6" />
            </div>
        </div>
        <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">Gravando Percurso...</h4>
        <button 
            onClick={onStop} 
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
            <ShieldCheckIcon className="w-4 h-4" /> Salvar Aprendizado
        </button>
    </div>
);