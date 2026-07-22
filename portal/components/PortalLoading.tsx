import React from 'react';

interface PortalLoadingProps {
    message?: string;
}

export const PortalLoading: React.FC<PortalLoadingProps> = ({ 
    message = 'Carregando informações do portal...' 
}) => {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="relative w-12 h-12 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700"></div>
                <div className="absolute inset-0 rounded-full border-4 border-brand-blue border-t-transparent animate-spin"></div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 animate-pulse">
                {message}
            </p>
        </div>
    );
};
