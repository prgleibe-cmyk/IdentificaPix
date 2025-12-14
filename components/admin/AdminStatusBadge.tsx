
import React from 'react';
import { useTranslation } from '../../contexts/I18nContext';

export const AdminStatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const { t } = useTranslation();

    const styles: Record<string, string> = {
        active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        trial: 'bg-blue-100 text-blue-700 border-blue-200',
        expired: 'bg-red-100 text-red-700 border-red-200',
        lifetime: 'bg-purple-100 text-purple-700 border-purple-200',
        approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        rejected: 'bg-red-100 text-red-700 border-red-200',
    };
    
    const defaultStyle = 'bg-slate-100 text-slate-600 border-slate-200';
    const currentStyle = styles[status] || defaultStyle;

    const getLabel = (s: string) => {
        const key = `admin.status.${s}`;
        const translation = t(key as any);
        // Fallback if translation is missing (returns key)
        return translation !== key ? translation : s;
    };

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${currentStyle}`}>
            {getLabel(status)}
        </span>
    );
};
