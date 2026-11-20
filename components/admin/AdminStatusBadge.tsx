
import React from 'react';
import { useTranslation } from '../../contexts/I18nContext';

export const AdminStatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const { t } = useTranslation();

    const styles: Record<string, string> = {
        active: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
        trial: 'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/50',
        expired: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50',
        lifetime: 'bg-orange-50 text-orange-700 border-orange-200/80 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50',
        approved: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
        pending: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
        rejected: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50',
    };
    
    const defaultStyle = 'bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    const currentStyle = styles[status] || defaultStyle;

    const getLabel = (s: string) => {
        const key = `admin.status.${s}`;
        const translation = t(key as any);
        // Fallback if translation is missing (returns key)
        return translation !== key ? translation : s;
    };

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${currentStyle}`}>
            {getLabel(status)}
        </span>
    );
};
