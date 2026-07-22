import React from 'react';

export const PortalFooter: React.FC = () => {
    return (
        <footer className="mt-auto border-t border-slate-200/80 dark:border-slate-800/80 py-6 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="max-w-4xl mx-auto px-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    IgGestor &copy; {new Date().getFullYear()} &bull; Ambiente Seguro de Contribuições
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                    Tecnologia e Gestão Eclesiástica Inteligente
                </p>
            </div>
        </footer>
    );
};
