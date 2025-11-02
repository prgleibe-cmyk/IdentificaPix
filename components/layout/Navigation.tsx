import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { ViewType } from '../../types';
import {
  HomeIcon,
  SearchIcon,
  UploadIcon,
  PlusCircleIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  DocumentDuplicateIcon,
} from '../Icons';

// Sub-componente: item individual da navegação
const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-700 text-white'
        : 'text-slate-500 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

// Componente principal de navegação
export const Navigation: React.FC = () => {
  const app = useContext(AppContext);
  const { t } = useTranslation();

  if (!app) return null; // Evita erro caso o contexto ainda não esteja disponível

  const { activeView, setActiveView } = app;

  const navItems: { view: ViewType; labelKey: string; icon: React.ReactNode }[] = [
    { view: 'dashboard', labelKey: 'nav.dashboard', icon: <HomeIcon className="w-5 h-5" /> },
    { view: 'upload', labelKey: 'nav.upload', icon: <UploadIcon className="w-5 h-5" /> },
    { view: 'cadastro', labelKey: 'nav.register', icon: <PlusCircleIcon className="w-5 h-5" /> },
    { view: 'reports', labelKey: 'nav.reports', icon: <ChartBarIcon className="w-5 h-5" /> },
    { view: 'savedReports', labelKey: 'nav.savedReports', icon: <DocumentDuplicateIcon className="w-5 h-5" /> },
    { view: 'search', labelKey: 'nav.search', icon: <SearchIcon className="w-5 h-5" /> },
    { view: 'settings', labelKey: 'nav.settings', icon: <Cog6ToothIcon className="w-5 h-5" /> },
  ];

  return (
    <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center space-x-1 sm:space-x-2 overflow-x-auto">
      {navItems.map((item) => (
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