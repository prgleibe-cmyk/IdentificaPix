
import React, { useState, useMemo, useContext } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { ViewType, Language } from '../../types';
import { 
    LogoIcon, 
    HomeIcon, 
    SearchIcon, 
    UploadIcon, 
    PlusCircleIcon, 
    ChartBarIcon, 
    Cog6ToothIcon, 
    ArrowLeftOnRectangleIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ShieldCheckIcon,
    SparklesIcon,
    MoonIcon,
    SunIcon,
    CheckBadgeIcon,
    ExclamationTriangleIcon,
    WhatsAppIcon,
    PresentationChartLineIcon
} from '../Icons';

export const Sidebar: React.FC = () => {
    const { activeView, setActiveView, theme, toggleTheme } = useUI();
    const { t, language, setLanguage } = useTranslation();
    const { signOut, user, subscription, systemSettings } = useAuth();
    const { openPaymentModal } = useContext(AppContext);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Robust check: Lowercase comparison
    const isAdmin = user?.email?.toLowerCase().trim() === 'identificapix@gmail.com';

    const navItems = useMemo(() => {
        const items: { view: ViewType, labelKey: any, icon: React.ReactNode, special?: boolean }[] = [
            { view: 'dashboard', labelKey: 'nav.dashboard', icon: <HomeIcon className="w-5 h-5"/> },
            { view: 'upload', labelKey: 'nav.upload', icon: <UploadIcon className="w-5 h-5"/> },
            { view: 'cadastro', labelKey: 'nav.register', icon: <PlusCircleIcon className="w-5 h-5"/> },
            { view: 'reports', labelKey: 'nav.reports', icon: <ChartBarIcon className="w-5 h-5"/> },
            { view: 'smart_analysis', labelKey: 'nav.smart_analysis', icon: <PresentationChartLineIcon className="w-5 h-5"/> },
            { view: 'settings', labelKey: 'nav.settings', icon: <Cog6ToothIcon className="w-5 h-5"/> },
        ];

        if (isAdmin) {
            items.push({ 
                view: 'admin', 
                labelKey: 'Admin', 
                icon: <ShieldCheckIcon className="w-5 h-5"/>,
                special: true 
            });
        }
        return items;
    }, [isAdmin]);

    // Subscription Logic
    const { daysRemaining, isExpired, plan } = subscription;
    
    const handleLanguageCycle = () => {
        const langs: Language[] = ['pt', 'en', 'es'];
        const currentIndex = langs.indexOf(language);
        const nextIndex = (currentIndex + 1) % langs.length;
        setLanguage(langs[nextIndex]);
    };

    // Helper to get status color styles
    const getStatusStyle = () => {
        if (isExpired) return 'border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20';
        if (plan === 'lifetime') return 'border-purple-500/30 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20';
        if (daysRemaining <= 5) return 'border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20';
        return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20';
    };

    const StatusIcon = isExpired ? ExclamationTriangleIcon : (plan === 'lifetime' ? CheckBadgeIcon : SparklesIcon);

    return (
        <aside 
            className={`
                relative h-screen flex flex-col transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) z-50
                ${isCollapsed ? 'w-20' : 'w-64'} 
                bg-[#020610] text-white border-r border-white/5 shadow-2xl
            `}
        >
            {/* Content Container */}
            <div className="relative z-10 flex flex-col h-full">
                
                {/* Header / Logo */}
                <div className={`flex flex-col items-center justify-center py-6 transition-all duration-500 ${isCollapsed ? 'px-2' : 'px-6'}`}>
                    <div className="relative group cursor-pointer mb-2">
                        <div className="relative bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-md shadow-xl group-hover:scale-105 transition-transform duration-300">
                            <LogoIcon className="w-6 h-6 text-brand-teal" />
                        </div>
                    </div>
                    
                    <div className={`flex flex-col items-center text-center overflow-hidden transition-all duration-500 ${isCollapsed ? 'h-0 opacity-0' : 'h-auto opacity-100'}`}>
                        <span className="font-display font-bold text-base tracking-tight text-white leading-none">IdentificaPix</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 space-y-1 py-2 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        const isActive = activeView === item.view;
                        return (
                            <button
                                key={item.view}
                                onClick={() => setActiveView(item.view)}
                                className={`
                                    relative w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group mb-1
                                    ${isCollapsed ? 'justify-center' : 'gap-3'}
                                    ${isActive 
                                        ? 'bg-white/10 text-white shadow-inner' 
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }
                                `}
                                title={isCollapsed ? (item.view === 'admin' ? 'Admin' : t(item.labelKey)) : ''}
                            >
                                <span className={`relative z-10 transition-transform duration-200 ${isActive ? 'text-brand-blue drop-shadow-sm' : 'group-hover:scale-110'}`}>
                                    {React.cloneElement(item.icon as React.ReactElement<any>, { className: "w-4 h-4" })}
                                </span>
                                
                                <span className={`
                                    relative z-10 text-xs font-bold tracking-wide truncate transition-all duration-200
                                    ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}
                                `}>
                                    {item.view === 'admin' ? 'Admin' : t(item.labelKey)}
                                </span>
                            </button>
                        );
                    })}
                </nav>

                {/* Footer Section */}
                <div className={`mt-auto border-t border-white/5 bg-[#050B14] transition-all duration-300 flex flex-col ${isCollapsed ? 'p-2 gap-3' : 'p-4 gap-4'}`}>
                    
                    {/* Unified Tools Row */}
                    <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3' : 'gap-2'}`}>
                        
                        {/* Theme Toggle */}
                        <button 
                            onClick={toggleTheme} 
                            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors bg-white/5 border border-white/5"
                            title="Alternar Tema"
                        >
                            {theme === 'light' ? <MoonIcon className="w-3.5 h-3.5" /> : <SunIcon className="w-3.5 h-3.5" />}
                        </button>

                        {/* Language Toggle */}
                        <button 
                            onClick={handleLanguageCycle} 
                            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors uppercase text-[9px] font-bold w-8 h-8 text-center bg-white/5 border border-white/5"
                            title="Alterar Idioma"
                        >
                            {language}
                        </button>

                        {/* Support Button (WhatsApp) - Green Outline Added */}
                        <button 
                            onClick={() => window.open(`https://wa.me/${systemSettings?.supportNumber || '5511999999999'}`, '_blank')}
                            className="p-2 rounded-full text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all bg-white/5 border border-emerald-500/30 shadow-sm shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:border-emerald-500/50"
                            title="Suporte WhatsApp"
                        >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                        </button>

                        {/* Plan Pill Button - Expands on Desktop, Icon on Collapsed */}
                        <button 
                            onClick={openPaymentModal}
                            className={`
                                flex items-center justify-center transition-all duration-300 border
                                ${isCollapsed 
                                    ? `p-2 rounded-full ${getStatusStyle()}` 
                                    : `ml-auto h-8 px-3 rounded-full gap-2 ${getStatusStyle()}`
                                }
                            `}
                            title={plan === 'lifetime' ? 'Plano Vitalício' : `Renovar (${daysRemaining} dias)`}
                        >
                            <StatusIcon className={`${isCollapsed ? 'w-4 h-4' : 'w-3 h-3'}`} />
                            
                            {!isCollapsed && (
                                <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                                    {plan === 'lifetime' ? 'Vitalício' : isExpired ? 'Renovar' : `${daysRemaining} dias`}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* User Profile */}
                    <div className={`flex items-center rounded-xl transition-all duration-300 pt-1 border-t border-white/5 ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between gap-2'}`}>
                        <div className="flex items-center gap-3 min-w-0 group cursor-pointer" onClick={() => !isCollapsed && setActiveView('settings')}>
                            <div 
                                className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-blue to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg border border-white/10 group-hover:ring-2 group-hover:ring-brand-blue/50 transition-all"
                                title={user?.email || 'User'}
                            >
                                {user?.email?.charAt(0).toUpperCase()}
                            </div>
                            
                            {!isCollapsed && (
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-white truncate max-w-[100px] block group-hover:text-brand-blue transition-colors">Minha Conta</span>
                                    <span className="text-[9px] text-slate-500 truncate max-w-[100px] block">{user?.email}</span>
                                </div>
                            )}
                        </div>
                        
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                signOut();
                            }}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Sair"
                        >
                            <ArrowLeftOnRectangleIcon className="w-5 h-5 stroke-[2]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Collapse Toggle */}
            <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-12 bg-[#020610] border border-slate-700 text-slate-400 hover:text-white p-1 rounded-full shadow-lg shadow-black/50 transition-all z-50 hover:scale-110"
            >
                {isCollapsed ? <ChevronRightIcon className="w-3 h-3 stroke-[3]" /> : <ChevronLeftIcon className="w-3 h-3 stroke-[3]" />}
            </button>
        </aside>
    );
};
