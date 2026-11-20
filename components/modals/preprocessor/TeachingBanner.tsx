
import React from 'react';
import { BrainIcon, ArrowPathIcon, BoltIcon } from '../../Icons';

interface TeachingBannerProps {
    isVisible: boolean;
    isProcessing: boolean;
    onApply: () => void;
}

export const TeachingBanner: React.FC<TeachingBannerProps> = ({
    isVisible,
    isProcessing,
    onApply
}) => {
    if (!isVisible) return null;

    return (
        <div className="px-4 py-3 bg-orange-50/70 dark:bg-orange-950/25 border-b border-orange-200/80 dark:border-orange-900/40 flex items-center justify-between gap-3 animate-fade-in shrink-0">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-orange-200/70 dark:border-orange-900/50 shadow-xs">
                    <BrainIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                    <p className="text-xs text-orange-800 dark:text-orange-300 font-semibold">Modo Ensino Ativo</p>
                    <p className="text-[11px] text-orange-700/80 dark:text-orange-400/80 font-medium">Corrigiu uma linha? Clique em aplicar para a IA aprender este novo padrão.</p>
                </div>
            </div>
            <button 
                onClick={onApply} 
                disabled={isProcessing}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
            >
                {isProcessing ? (
                    <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <BoltIcon className="w-3.5 h-3.5" />
                )}
                <span>Aplicar Padrão</span>
            </button>
        </div>
    );
};
