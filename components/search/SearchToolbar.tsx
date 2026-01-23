
import React from 'react';
import { AdjustmentsHorizontalIcon, PrinterIcon, FloppyDiskIcon } from '../Icons';
import { useTranslation } from '../../contexts/I18nContext';

interface SearchToolbarProps {
    title: string;
    activeFilterCount: number;
    onOpenFilters: () => void;
    onPrint: () => void;
    onSave: () => void;
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
        default: { base: 'text-slate-300 hover:text-white', active: 'text-white' },
        primary: { base: 'text-blue-400 hover:text-blue-300', active: 'text-blue-300 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' }, 
        success: { base: 'text-emerald-400 hover:text-emerald-300', active: 'text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' }, 
        danger: { base: 'text-rose-400 hover:text-rose-300', active: 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]' }, 
        warning: { base: 'text-amber-400 hover:text-amber-300', active: 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' }, 
        info: { base: 'text-cyan-400 hover:text-cyan-300', active: 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]' }, 
        violet: { base: 'text-violet-400 hover:text-violet-300', active: 'text-violet-300 drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]' }, 
    };

    const colors = colorMap[variant] || colorMap.default;
    const currentClass = isActive ? `${colors.active} font-black scale-105` : `${colors.base} font-bold hover:scale-105`;

    return (
        <>
            <button 
                onClick={onClick}
                className={`relative flex-1 flex items-center justify-center gap-2 px-4 h-full text-[10px] uppercase transition-all duration-300 outline-none group ${currentClass}`}
            >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
                <span className="hidden sm:inline">{label}</span>
                {badgeCount !== undefined && badgeCount > 0 && (
                    <span className="ml-1 bg-red-500 px-1.5 py-0.5 rounded-full text-[9px] leading-none text-white font-bold">
                        {badgeCount}
                    </span>
                )}
            </button>
            {!isLast && <div className="w-px h-3 bg-white/10 self-center"></div>}
        </>
    );
};

export const SearchToolbar: React.FC<SearchToolbarProps> = ({ 
    title, 
    activeFilterCount, 
    onOpenFilters, 
    onPrint, 
    onSave 
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-1 mt-1 min-h-[40px]">
            <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none whitespace-nowrap">{title}</h2>
            
            <div className="flex items-center h-9 bg-gradient-to-r from-blue-600 via-[#051024] to-blue-600 rounded-full shadow-lg border border-white/20 overflow-hidden p-0.5">
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
                 />
                 <UnifiedButton 
                    onClick={onSave}
                    icon={FloppyDiskIcon}
                    label={t('common.save')}
                    isLast={true}
                    variant="success"
                 />
            </div>
        </div>
    );
};
