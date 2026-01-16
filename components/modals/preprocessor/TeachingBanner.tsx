
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
        <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 border-b border-purple-100 dark:border-purple-800/50 flex items-center justify-between animate-fade-in shrink-0">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-purple-900/50 rounded-lg shadow-sm">
                    <BrainIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                    <p className="text-[10px] text-purple-700 dark:text-purple-300 font-bold uppercase tracking-wider">Modo Ensino Ativo</p>
                    <p className="text-[9px] text-purple-600/70 dark:text-purple-400/70 font-medium">Corrigiu uma linha? Clique em aplicar para a IA aprender este novo padrão.</p>
                </div>
            </div>
            <button 
                onClick={onApply} 
                disabled={isProcessing}
                className="px-5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-[10px] font-bold uppercase flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
                {isProcessing ? (
                    <ArrowPathIcon className="w-3 h-3 animate-spin" />
                ) : (
                    <BoltIcon className="w-3 h-3" />
                )}
                <span>Aplicar Padrão</span>
            </button>
        </div>
    );
};
