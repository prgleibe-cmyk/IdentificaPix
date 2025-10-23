import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';
import { AppContext } from '../../contexts/AppContext';
import { LogoIcon, GlobeAltIcon, MoonIcon, SunIcon, ArrowLeftOnRectangleIcon } from '../Icons';
import { Navigation } from './Navigation';

export const Header: React.FC = () => {
    const { theme, toggleTheme } = React.useContext(AppContext);
    const { t, setLanguage } = useTranslation();
    const { user, signOut } = useAuth();
    const [isLangMenuOpen, setLangMenuOpen] = useState(false);

    return (
        <header className="bg-white dark:bg-slate-800 sticky top-0 z-20 border-b border-slate-200 dark:border-slate-700 print:hidden">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo and Title */}
                    <div className="flex items-center space-x-3">
                        <LogoIcon className="w-8 h-8 text-slate-900 dark:text-slate-100" />
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t('app.title')}</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('app.subtitle')}</p>
                        </div>
                    </div>

                    {/* Header Actions */}
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <div className="relative">
                            <button onClick={() => setLangMenuOpen(p => !p)} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                <GlobeAltIcon className="w-6 h-6" />
                            </button>
                            {isLangMenuOpen && (
                                <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-slate-700 rounded-md shadow-lg z-10 border dark:border-slate-600" onMouseLeave={() => setLangMenuOpen(false)}>
                                    <button type="button" onClick={() => { setLanguage('pt'); setLangMenuOpen(false); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">🇧🇷 Português</button>
                                    <button type="button" onClick={() => { setLanguage('en'); setLangMenuOpen(false); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">🇺🇸 English</button>
                                    <button type="button" onClick={() => { setLanguage('es'); setLangMenuOpen(false); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">🇪🇸 Español</button>
                                </div>
                            )}
                        </div>
                        <button onClick={toggleTheme} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
                        </button>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                        
                        {user && (
                             <div className="flex items-center space-x-2">
                                <span className="hidden sm:inline text-sm text-slate-600 dark:text-slate-300">
                                    {user.email}
                                </span>
                                <button onClick={signOut} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Sair">
                                    <ArrowLeftOnRectangleIcon className="w-6 h-6" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Navigation */}
                <div className="border-t border-slate-200 dark:border-slate-700 -mx-4 sm:-mx-6 lg:-mx-8">
                   <Navigation />
                </div>
            </div>
        </header>
    );
};