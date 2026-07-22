import React from 'react';
import { PortalButton } from './PortalButton';

interface PortalEmptyStateProps {
    title: string;
    description: string;
    icon?: React.ReactNode;
    actionLabel?: string;
    onAction?: () => void;
}

export const PortalEmptyState: React.FC<PortalEmptyStateProps> = ({
    title,
    description,
    icon,
    actionLabel,
    onAction
}) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-white/60 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            {icon && (
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mb-4">
                    {icon}
                </div>
            )}
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
                {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                {description}
            </p>
            {actionLabel && onAction && (
                <PortalButton variant="outline" size="sm" onClick={onAction}>
                    {actionLabel}
                </PortalButton>
            )}
        </div>
    );
};
