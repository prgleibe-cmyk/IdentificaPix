import React from 'react';

export const PortalFooter: React.FC = () => {
    return (
        <footer className="mt-auto border-t border-slate-200/80 dark:border-slate-800/80 py-5 bg-white/80 dark:bg-slate-900/50">
            <div className="max-w-4xl mx-auto px-4 text-center space-y-0.5">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    IgGestor &copy; {new Date().getFullYear()} &middot; Ambiente Seguro de Contribuições
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Tecnologia e Gestão Eclesiástica Inteligente
                </p>
            </div>
        </footer>
    );
};
