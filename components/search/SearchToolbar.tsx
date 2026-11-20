
import React from 'react';
import { AdjustmentsHorizontalIcon, PrinterIcon, FloppyDiskIcon } from '../Icons';
import { useTranslation } from '../../contexts/I18nContext';

interface SearchToolbarProps {
    title: string;
    activeFilterCount: number;
    onOpenFilters: () => void;
    onPrint: () => void;
    onSave: () => void;
    role?: string;
}

const UnifiedButton = ({ 
    onClick, 
    icon: Icon, 
    label, 
    badgeCount,
    isActive,
    isLast,
    variant = 'default'
}: { 
    onClick: () => void, 
    icon: any, 
    label: string, 
    badgeCount?: number,
    isActive?: boolean,
    isLast?: boolean,
    variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'violet'
}) => {
    const colorMap = {
        default: { base: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800', active: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' },
        primary: { base: 'text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:text-orange-600 dark:hover:text-orange-400', active: 'bg-orange-600 text-white' }, 
        success: { base: 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30', active: 'bg-emerald-600 text-white' }, 
        danger: { base: 'text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30', active: 'bg-rose-600 text-white' }, 
        warning: { base: 'text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30', active: 'bg-amber-600 text-white' }, 
        info: { base: 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800', active: 'bg-slate-900 text-white' }, 
        violet: { base: 'text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30', active: 'bg-violet-600 text-white' }, 
    };

    const colors = colorMap[variant] || colorMap.default;
    const currentClass = isActive ? `${colors.active} font-semibold` : `${colors.base} font-semibold`;

    return (
        <>
            <button 
                type="button"
                onClick={onClick}
                className={`relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors outline-none cursor-pointer ${currentClass}`}
            >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
                {badgeCount !== undefined && badgeCount > 0 && (
                    <span className="ml-0.5 bg-orange-600 text-white px-1.5 py-0.5 rounded-md text-[10px] leading-none font-bold tabular-nums">
                        {badgeCount}
                    </span>
                )}
            </button>
            {!isLast && <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 self-center"></div>}
        </>
    );
};

export const SearchToolbar: React.FC<SearchToolbarProps> = ({ 
    title, 
    activeFilterCount, 
    onOpenFilters, 
    onPrint, 
    onSave,
    role
}) => {
    const { t } = useTranslation();
    const isOwner = role === 'owner';

    return (
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-1 mt-1 min-h-[40px]">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none whitespace-nowrap">{title}</h2>
            
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 p-1">
                 <UnifiedButton 
                    onClick={onOpenFilters}
                    icon={AdjustmentsHorizontalIcon}
                    label={t('search.filters')}
                    badgeCount={activeFilterCount}
                    variant="primary"
                 />
                 <UnifiedButton 
                    onClick={onPrint}
                    icon={PrinterIcon}
                    label={t('common.print')}
                    variant="info"
                    isLast={!isOwner}
                 />
                 {isOwner && (
                    <UnifiedButton 
                        onClick={onSave}
                        icon={FloppyDiskIcon}
                        label={t('common.save')}
                        isLast={true}
                        variant="success"
                    />
                 )}
            </div>
        </div>
    );
};
