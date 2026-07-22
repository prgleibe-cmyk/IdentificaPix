import React from 'react';

interface PortalCardProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    className?: string;
    headerAction?: React.ReactNode;
}

export const PortalCard: React.FC<PortalCardProps> = ({
    children,
    title,
    subtitle,
    className = '',
    headerAction
}) => {
    return (
        <div className={`bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm p-6 sm:p-8 transition-all ${className}`}>
            {(title || subtitle || headerAction) && (
                <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                    <div>
                        {title && (
                            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                                {title}
                            </h2>
                        )}
                        {subtitle && (
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {headerAction && <div>{headerAction}</div>}
                </div>
            )}
            {children}
        </div>
    );
};
