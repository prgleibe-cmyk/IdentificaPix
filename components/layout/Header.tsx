import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { 
    LogoIcon, 
    GlobeAltIcon, 
    MoonIcon, 
    SunIcon, 
    ArrowLeftOnRectangleIcon,
    SearchIcon, 
    ArrowsRightLeftIcon, 
    DollarSignIcon, 
    ChartBarIcon, 
    UploadIcon, 
    CheckCircleIcon 
} from '../Icons';
import { Navigation } from './Navigation';

export const Header: React.FC = () => {
    const { theme, toggleTheme } = useUI();
    const { t, setLanguage } = useTranslation();
    const { user, signOut } = useAuth();
    const [isLangMenuOpen, setLangMenuOpen] = useState(false);

    return (
        <header className="bg-blue-700 dark:bg-blue-900 text-white sticky top-0 z-20 print:hidden shadow-md relative">
             {/* Background Icon Texture with smaller icons - overflow hidden moved here */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                 <SearchIcon className="absolute -top-4 -left-8 w-14 h-14 transform -rotate-12 text-white/10" />
                 <ArrowsRightLeftIcon className="absolute -bottom-12 right-2 w-20 h-20 transform rotate-6 text-white/10" />
                 <DollarSignIcon className="absolute top-1/2 left-1/4 w-10 h-10 transform -translate-y-1/2 rotate-12 text-white/10" />
                 <ChartBarIcon className="absolute top-8 right-1/3 w-12 h-12 transform -rotate-12 text-white/10" />
                 <UploadIcon className="absolute bottom-4 left-1/3 w-14 h-14 transform rotate-3 text-white/10" />
                 <CheckCircleIcon className="absolute top-0 right-10 w-10 h-10 transform rotate-12 text-white/10" />
            </div>

            <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo and Title */}
                    <div className="flex items-center space-x-3">
                        <LogoIcon className="w-8 h-8" />
                        <div>
                            <h1 className="text-lg font-bold">{t('app.title')}</h1>
                            <p className="text-xs text-white/80">{t('app.subtitle')}</p>
                        </div>
                    </div>

                    {/* Header Actions */}
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <div className="relative">
                            <button onClick={() => setLangMenuOpen(p => !p)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                                <GlobeAltIcon className="w-6 h-6" />
                            </button>
                            {isLangMenuOpen && (
                                <div className="absolute right-0 mt-2 w-36 bg-slate-800/95 backdrop-blur-md rounded-md shadow-xl z-50 border border-white/10" onMouseLeave={() => setLangMenuOpen(false)}>
                                    <button type="button" onClick={() => { setLanguage('pt'); setLangMenuOpen(false); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 cursor-pointer first:rounded-t-md">🇧🇷 Português</button>
                                    <button type="button" onClick={() => { setLanguage('en'); setLangMenuOpen(false); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 cursor-pointer">🇺🇸 English</button>
                                    <button type="button" onClick={() => { setLanguage('es'); setLangMenuOpen(false); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 cursor-pointer last:rounded-b-md">🇪🇸 Español</button>
                                </div>
                            )}
                        </div>
                        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                            {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
                        </button>
                        <div className="w-px h-6 bg-white/20 hidden sm:block"></div>
                        
                        {user && (
                             <div className="flex items-center space-x-2">
                                <span className="hidden sm:inline text-sm text-white/90">
                                    {user.email}
                                </span>
                                <button onClick={signOut} className="p-2 rounded-full hover:bg-white/10 transition-colors" aria-label="Sair">
                                    <ArrowLeftOnRectangleIcon className="w-6 h-6" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Navigation */}
                <div className="border-t border-white/20 -mx-4 sm:-mx-6 lg:-mx-8">
                   <Navigation />
                </div>
            </div>
        </header>
    );
};