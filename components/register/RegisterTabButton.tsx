import React from 'react';

interface RegisterTabButtonProps {
    id: string;
    label: string;
    icon: React.ElementType;
    colorTheme: 'blue' | 'emerald' | 'violet' | 'amber' | 'slate';
    isActive: boolean;
    onClick: (id: any) => void;
}

/**
 * Styled tab button for RegisterView navigation.
 * Implements IdentificaPix color themes and active states.
 */
export const RegisterTabButton: React.FC<RegisterTabButtonProps> = ({ 
    id, 
    label, 
    icon: Icon, 
    colorTheme, 
    isActive, 
    onClick 
}) => {
    let iconColorClass = "";
    
    switch (colorTheme) {
        case 'blue':
            iconColorClass = isActive ? "text-blue-600 dark:text-blue-400" : "text-blue-500/80 dark:text-blue-400/80";
            break;
        case 'emerald':
            iconColorClass = isActive ? "text-emerald-600 dark:text-emerald-400" : "text-emerald-500/80 dark:text-emerald-400/80";
            break;
        case 'violet':
            iconColorClass = isActive ? "text-violet-600 dark:text-violet-400" : "text-violet-500/80 dark:text-violet-400/80";
            break;
        case 'amber':
            iconColorClass = isActive ? "text-orange-600 dark:text-orange-400" : "text-amber-500/80 dark:text-amber-400/80";
            break;
        default:
            iconColorClass = isActive ? "text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400";
            break;
    }

    return (
        <button
            type="button"
            onClick={() => onClick(id)}
            className={`
                flex-shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all duration-150 text-xs font-semibold whitespace-nowrap cursor-pointer select-none
                ${isActive
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/90 dark:border-slate-700"
                    : "bg-transparent text-slate-600 dark:text-slate-400 border border-transparent hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/50"
                }
            `}
        >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColorClass}`} />
            <span>{label}</span>
        </button>
    );
};