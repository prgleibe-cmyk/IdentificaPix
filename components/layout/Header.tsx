
import React, { useState, useContext } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { 
    LogoIcon, 
    GlobeAltIcon, 
    MoonIcon, 
    SunIcon, 
    ArrowLeftOnRectangleIcon,
    CalendarIcon
} from '../Icons';
import { Navigation } from './Navigation';

export const Header: React.FC = () => {
    const { theme, toggleTheme } = useUI();
    const { t, setLanguage } = useTranslation();
    const { user, signOut, subscription } = useAuth();
    const { openPaymentModal } = useContext(AppContext);
    const [isLangMenuOpen, setLangMenuOpen] = useState(false);

    // Badge Logic
    const getSubscriptionBadge = () => {
        if (!user) return null;

        const { daysRemaining, isExpired, plan } = subscription;
        
        let bgColor = 'bg-emerald-500';
        let label = `${daysRemaining} dias`;

        if (isExpired) {
            bgColor = 'bg-red-500';
            label = 'Expirado';
        } else if (daysRemaining <= 3) {
            bgColor = 'bg-amber-500';
        }

        return (
            <div className="hidden sm:flex items-center space-x-2 bg-black/20 rounded-lg px-2.5 py-1 border border-white/10 backdrop-blur-md" title="Tempo de uso restante">
                <div className={`w-1.5 h-1.5 rounded-full ${bgColor} animate-pulse`}></div>
                <div className="flex flex-col leading-none">
                    <span className="text-[9px] uppercase font-bold text-white/60 tracking-wider">
                        {plan === 'trial' ? 'Trial' : 'Pro'}
                    </span>
                    <span className="text-[10px] font-bold text-white tracking-wide">
                        {label}
                    </span>
                </div>
                <button 
                    onClick={openPaymentModal}
                    className="ml-1 px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold uppercase tracking-wider rounded transition-colors border border-white/10"
                >
                    Renovar
                </button>
            </div>
        );
    };

    return (
        <header className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 shadow-lg sticky top-0 z-50 print:hidden transition-all duration-300 border-b border-white/10">
            {/* Overlay texture for depth */}
            <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUpIi8+PC9zdmc+')] [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="flex items-center justify-between h-16">
                    {/* Left: Logo and Title */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="p-1.5 bg-white/10 rounded-lg shadow-lg ring-1 ring-white/20 backdrop-blur-sm">
                            <LogoIcon className="w-5 h-5 text-white" />
                        </div>
                        {/* Title visible on XL+ */}
                        <div className="hidden xl:block">
                            <h1 className="text-lg font-black text-white leading-none tracking-tight drop-shadow-md">
                                {t('app.title')}
                            </h1>
                        </div>
                    </div>

                    {/* Center: Navigation (Desktop) - Aligned Left/Start */}
                    <div className="hidden lg:flex flex-1 justify-start min-w-0 ml-6 xl:ml-10 mr-4">
                        <div className="overflow-x-auto no-scrollbar py-1 px-2 mask-linear-fade max-w-full">
                            <Navigation />
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center justify-end gap-2 flex-shrink-0">
                        
                        {/* Subscription Counter */}
                        {getSubscriptionBadge()}

                        <div className="w-px h-6 bg-white/20 hidden sm:block mx-1"></div>

                        {/* Language Selector */}
                        <div className="relative">
                            <button 
                                onClick={() => setLangMenuOpen(p => !p)} 
                                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus:outline-none transition-all duration-200"
                                aria-label="Alterar idioma"
                            >
                                <GlobeAltIcon className="w-4 h-4" />
                            </button>
                            {isLangMenuOpen && (
                                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden transform origin-top-right transition-all animate-fade-in-down z-50">
                                    <div className="py-1">
                                        <button onClick={() => { setLanguage('pt'); setLangMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-white transition-colors font-medium">Português</button>
                                        <button onClick={() => { setLanguage('en'); setLangMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-white transition-colors font-medium">English</button>
                                        <button onClick={() => { setLanguage('es'); setLangMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-white transition-colors font-medium">Español</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Theme Toggle */}
                        <button 
                            onClick={toggleTheme} 
                            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus:outline-none transition-all duration-200"
                            aria-label="Alternar tema"
                        >
                            {theme === 'light' ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
                        </button>

                        <div className="w-px h-6 bg-white/20 hidden sm:block mx-1"></div>
                        
                        {user && (
                             <div className="flex items-center gap-2">
                                {/* Email hidden on LG, visible on XL+ */}
                                <div className="hidden xl:flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-white tracking-wide bg-white/10 border border-white/10 px-2 py-0.5 rounded-full shadow-sm max-w-[120px] truncate">
                                        {user.email}
                                    </span>
                                </div>
                                <button 
                                    onClick={signOut} 
                                    className="p-2 rounded-lg text-white/80 hover:text-red-200 hover:bg-red-500/20 focus:outline-none transition-all duration-200" 
                                    aria-label="Sair"
                                >
                                    <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile Navigation (Visible only on small screens) */}
                <div className="lg:hidden pb-3 border-t border-white/10 pt-2">
                   <div className="flex justify-center overflow-x-auto no-scrollbar px-2">
                        <Navigation />
                   </div>
                </div>
            </div>
        </header>
    );
};
