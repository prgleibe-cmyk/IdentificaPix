

import React from 'react';
import { useUI } from '../../contexts/UIContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useAuth } from '../../contexts/AuthContext';
import { ViewType } from '../../types';
import { HomeIcon, SearchIcon, UploadIcon, PlusCircleIcon, ChartBarIcon, Cog6ToothIcon, ShieldCheckIcon } from '../Icons';

// Sub-component for individual navigation items
interface NavItemProps {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
    isSpecial?: boolean; // For Admin or special actions
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick, isSpecial = false }) => {
    
    // Admin button styling - Sóbrio e diferenciado
    if (isSpecial) {
        return (
            <button
                onClick={onClick}
                className={`
                    relative flex-shrink-0 flex items-center justify-center px-5 py-2.5 text-xs font-bold rounded-full 
                    transition-all duration-200 outline-none select-none whitespace-nowrap mx-1
                    ${isActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-amber-500 hover:bg-amber-500/10 hover:text-amber-400'
                    }
                `}
            >
                <span className="relative z-10 flex items-center gap-2">
                    {React.cloneElement(icon as React.ReactElement<any>, { className: "w-4 h-4 stroke-[2]" })}
                    <span>{label}</span>
                </span>
            </button>
        );
    }

    // Standard styling with SaaS Premium look FOR DARK HEADER
    return (
        <button
            onClick={onClick}
            className={`
                relative flex-shrink-0 flex items-center justify-center px-4 py-2.5 text-xs font-bold rounded-full 
                transition-all duration-200 outline-none select-none whitespace-nowrap mx-0.5
                ${isActive
                    ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30 transform scale-[1.02] border border-brand-blue/50'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }
            `}
        >
            <span className="relative z-10 flex items-center gap-2">
                {React.cloneElement(icon as React.ReactElement<any>, { className: isActive ? "w-4 h-4 stroke-[2]" : "w-4 h-4 stroke-[1.5]" })}
                <span className="tracking-wide">{label}</span>
            </span>
        </button>
    );
};

// Main Navigation component
export const Navigation: React.FC = () => {
    const { activeView, setActiveView } = useUI();
    const { user } = useAuth();
    const { t } = useTranslation();

    // Robust check: Lowercase comparison to avoid mismatch
    const isAdmin = user?.email?.toLowerCase().trim() === 'identificapix@gmail.com'; 

    const navItems: { view: ViewType, labelKey: any, icon: React.ReactNode, special?: boolean }[] = [
        { view: 'dashboard', labelKey: 'nav.dashboard', icon: <HomeIcon className="w-4 h-4"/> },
        { view: 'upload', labelKey: 'nav.upload', icon: <UploadIcon className="w-4 h-4"/> },
        { view: 'cadastro', labelKey: 'nav.register', icon: <PlusCircleIcon className="w-4 h-4"/> },
        { view: 'reports', labelKey: 'nav.reports', icon: <ChartBarIcon className="w-4 h-4"/> },
        { view: 'settings', labelKey: 'nav.settings', icon: <Cog6ToothIcon className="w-4 h-4"/> },
    ];

    if (isAdmin) {
        navItems.push({ 
            view: 'admin', 
            labelKey: 'Admin', 
            icon: <ShieldCheckIcon className="w-4 h-4"/>,
            special: true 
        });
    }

    // Container ajustado para fundo escuro com bordas super arredondadas
    return (
        <nav className="flex items-center p-1.5 bg-black/20 rounded-full border border-white/5 backdrop-blur-sm">
            {navItems.map(item => (
                <NavItem 
                    key={item.view}
                    icon={item.icon}
                    label={item.view === 'admin' ? 'Admin' : t(item.labelKey)}
                    isActive={activeView === item.view}
                    onClick={() => setActiveView(item.view)}
                    isSpecial={item.special}
                />
            ))}
        </nav>
    );
};