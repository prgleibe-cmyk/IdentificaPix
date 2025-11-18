import React from 'react';
import { useUI } from '../../contexts/UIContext';
import { useTranslation } from '../../contexts/I18nContext';
import { ViewType } from '../../types';
import { HomeIcon, SearchIcon, UploadIcon, PlusCircleIcon, ChartBarIcon, Cog6ToothIcon, DocumentDuplicateIcon } from '../Icons';

// Sub-component for individual navigation items
const NavItem: React.FC<{ icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void }> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-3 py-3 text-sm transition-colors border-b-2 ${
            isActive
                ? 'font-semibold text-white border-white'
                : 'font-medium text-white/70 border-transparent hover:text-white'
        }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

// Main Navigation component
export const Navigation: React.FC = () => {
    const { activeView, setActiveView } = useUI();
    const { t } = useTranslation();

    const navItems: { view: ViewType, labelKey: any, icon: React.ReactNode }[] = [
        { view: 'dashboard', labelKey: 'nav.dashboard', icon: <HomeIcon className="w-5 h-5"/> },
        { view: 'upload', labelKey: 'nav.upload', icon: <UploadIcon className="w-5 h-5"/> },
        { view: 'cadastro', labelKey: 'nav.register', icon: <PlusCircleIcon className="w-5 h-5"/> },
        { view: 'reports', labelKey: 'nav.reports', icon: <ChartBarIcon className="w-5 h-5"/> },
        { view: 'search', labelKey: 'nav.search', icon: <SearchIcon className="w-5 h-5"/> },
        { view: 'savedReports', labelKey: 'nav.savedReports', icon: <DocumentDuplicateIcon className="w-5 h-5"/> },
        { view: 'settings', labelKey: 'nav.settings', icon: <Cog6ToothIcon className="w-5 h-5"/> },
    ];

    return (
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center space-x-1 sm:space-x-2 overflow-x-auto">
            {navItems.map(item => (
                <NavItem 
                    key={item.view}
                    icon={item.icon}
                    label={t(item.labelKey)}
                    isActive={activeView === item.view}
                    onClick={() => setActiveView(item.view)}
                />
            ))}
        </nav>
    );
};