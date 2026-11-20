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
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 sm:p-6 transition-colors ${className}`}>
            {(title || subtitle || headerAction) && (
                <div className="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        {title && (
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                {title}
                            </h2>
                        )}
                        {subtitle && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
