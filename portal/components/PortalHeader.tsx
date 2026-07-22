import React from 'react';
import { PortalChurch } from '../types/portal';

interface PortalHeaderProps {
    church?: PortalChurch | null;
    onNavigate?: (route: string) => void;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({ church, onNavigate }) => {
    return (
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                <button 
                    onClick={() => onNavigate?.('home')}
                    className="flex items-center gap-3 text-left group focus:outline-none"
                    type="button"
                >
                    <img 
                        src="/logo.png?v=15" 
                        alt="IgGestor Logo" 
                        className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
                    />
                    <div className="flex flex-col">
                        <span className="text-sm font-black tracking-tight text-slate-800 dark:text-white uppercase">
                            IgGestor
                        </span>
                        <span className="text-[10px] font-bold tracking-widest text-brand-blue dark:text-blue-400 uppercase">
                            Portal do Contribuinte
                        </span>
                    </div>
                </button>

                {church ? (
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px] sm:max-w-[200px]">
                            {church.name}
                        </span>
                    </div>
                ) : (
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 tracking-wider">
                        Acesso Público
                    </span>
                )}
            </div>
        </header>
    );
};
