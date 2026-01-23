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
    let activeClass = "";
    let iconClass = "";
    
    switch (colorTheme) {
        case 'blue': 
            activeClass = "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30"; 
            iconClass = isActive ? "text-white" : "text-blue-500"; 
            break;
        case 'emerald': 
            activeClass = "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30"; 
            iconClass = isActive ? "text-white" : "text-emerald-500"; 
            break;
        case 'violet': 
            activeClass = "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-purple-500/30"; 
            iconClass = isActive ? "text-white" : "text-violet-500"; 
            break;
        case 'amber': 
            activeClass = "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/30"; 
            iconClass = isActive ? "text-white" : "text-amber-500"; 
            break;
        default: 
            activeClass = "bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-md"; 
            iconClass = isActive ? "text-white" : "text-slate-500"; 
            break;
    }

    return (
        <button 
            onClick={() => onClick(id)} 
            className={`
                relative flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-300 text-[10px] font-bold uppercase tracking-wide
                ${isActive 
                    ? `${activeClass} transform scale-105 z-10 border-transparent` 
                    : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }
            `}
        >
            <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
            <span>{label}</span>
        </button>
    );
};