
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
    
    // Admin button styling
    if (isSpecial) {
        return (
            <button
                onClick={onClick}
                className={`
                    relative flex-shrink-0 flex items-center justify-center px-3 py-1.5 lg:px-4 lg:py-2 text-xs font-bold rounded-xl 
                    transition-all duration-300 outline-none select-none whitespace-nowrap
                    ${isActive
                        ? 'bg-amber-400 text-amber-900 shadow-md shadow-amber-500/30 scale-105'
                        : 'text-amber-200 hover:bg-amber-500/20 hover:text-amber-100'
                    }
                `}
            >
                <span className={`relative z-10 ${isActive ? 'scale-110' : ''}`}>
                    {icon}
                </span>
                <span className="relative z-10 tracking-wide ml-1.5">{label}</span>
            </button>
        );
    }

    // Standard styling for dark/vibrant header background
    // Optimized for density: tighter padding, smaller gap, text always visible
    return (
        <button
            onClick={onClick}
            className={`
                relative flex-shrink-0 flex items-center justify-center px-2.5 py-1.5 lg:px-3.5 lg:py-2 text-xs font-bold rounded-xl 
                transition-all duration-300 outline-none select-none whitespace-nowrap group
                ${isActive
                    ? 'bg-white text-indigo-700 shadow-md shadow-black/10 scale-105'
                    : 'text-white/70 hover:bg-white/10 hover:text-white hover:shadow-sm'
                }
            `}
        >
            <span className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                {icon}
            </span>
            <span className="relative z-10 tracking-wide ml-1.5">{label}</span>
        </button>
    );
};

// Main Navigation component
export const Navigation: React.FC = () => {
    const { activeView, setActiveView } = useUI();
    const { user } = useAuth();
    const { t } = useTranslation();

    // Permite acesso admin para qualquer usuário logado (para testes) ou para o email específico
    const isAdmin = !!user; 

    const navItems: { view: ViewType, labelKey: any, icon: React.ReactNode, special?: boolean }[] = [
        { view: 'dashboard', labelKey: 'nav.dashboard', icon: <HomeIcon className="w-4 h-4"/> },
        { view: 'upload', labelKey: 'nav.upload', icon: <UploadIcon className="w-4 h-4"/> },
        { view: 'cadastro', labelKey: 'nav.register', icon: <PlusCircleIcon className="w-4 h-4"/> },
        { view: 'reports', labelKey: 'nav.reports', icon: <ChartBarIcon className="w-4 h-4"/> },
        { view: 'search', labelKey: 'nav.search', icon: <SearchIcon className="w-4 h-4"/> },
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

    return (
        <nav className="flex items-center space-x-1 lg:space-x-1.5 px-1">
            {navItems.map(item => (
                <NavItem 
                    key={item.view}
                    icon={item.icon}
                    label={item.view === 'admin' ? 'Painel Admin' : t(item.labelKey)}
                    isActive={activeView === item.view}
                    onClick={() => setActiveView(item.view)}
                    isSpecial={item.special}
                />
            ))}
        </nav>
    );
};
