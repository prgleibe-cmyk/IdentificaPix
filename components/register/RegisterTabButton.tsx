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
    
    if (isActive) {
        iconColorClass = "text-white";
    } else {
        switch (colorTheme) {
            case 'blue':
                iconColorClass = "text-blue-500/80 dark:text-blue-400/80";
                break;
            case 'emerald':
                iconColorClass = "text-emerald-500/80 dark:text-emerald-400/80";
                break;
            case 'violet':
                iconColorClass = "text-violet-500/80 dark:text-violet-400/80";
                break;
            case 'amber':
                iconColorClass = "text-amber-500/80 dark:text-amber-400/80";
                break;
            default:
                iconColorClass = "text-slate-500 dark:text-slate-400";
                break;
        }
    }

    return (
        <button
            type="button"
            onClick={() => onClick(id)}
            className={`
                flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors duration-150 text-xs font-semibold whitespace-nowrap cursor-pointer select-none
                ${isActive
                    ? "bg-orange-600 text-white shadow-xs"
                    : "bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/50"
                }
            `}
        >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColorClass}`} />
            <span>{label}</span>
        </button>
    );
};