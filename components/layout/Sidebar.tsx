
import React, { useState, useMemo, useContext } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { ViewType, Language } from '../../types';
import { 
    LogoIcon, 
    HomeIcon, 
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
    const { signOut, user, subscription, systemSettings, loading: authLoading } = useAuth();
    const { openPaymentModal } = useContext(AppContext);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

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
        if (isAdmin) items.push({ view: 'admin', labelKey: 'Admin', icon: <ShieldCheckIcon className="w-5 h-5"/>, special: true });
        return items;
    }, [isAdmin]);

    const handleLanguageCycle = () => {
        const langs: Language[] = ['pt', 'en', 'es'];
        const next = langs[(langs.indexOf(language) + 1) % langs.length];
        setLanguage(next);
    };

    const getStatusStyle = () => {
        if (subscription.isExpired) return 'border-red-500/30 text-red-400 bg-red-500/10';
        if (subscription.plan === 'lifetime') return 'border-purple-500/30 text-purple-400 bg-purple-500/10';
        if (subscription.daysRemaining <= 5) return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
        return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
    };

    const StatusIcon = subscription.isExpired ? ExclamationTriangleIcon : (subscription.plan === 'lifetime' ? CheckBadgeIcon : SparklesIcon);

    const handleLogout = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLoggingOut) return;
        
        setIsLoggingOut(true);
        try {
            await signOut();
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <aside className={`relative h-screen flex flex-col transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) z-50 ${isCollapsed ? 'w-20' : 'w-64'} bg-[#020610] text-white border-r border-white/5 shadow-2xl`}>
            <div className="relative z-10 flex flex-col h-full">
                <div className={`flex flex-col items-center justify-center py-6 transition-all duration-500 ${isCollapsed ? 'px-2' : 'px-6'}`}>
                    <div className="relative bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-md shadow-xl mb-2">
                        <LogoIcon className="w-6 h-6 text-brand-teal" />
                    </div>
                    {!isCollapsed && <span className="font-display font-bold text-base tracking-tight text-white">IdentificaPix</span>}
                </div>

                <nav className="flex-1 px-3 space-y-1 py-2 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => (
                        <button
                            key={item.view}
                            onClick={() => setActiveView(item.view)}
                            className={`relative w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group mb-1 ${isCollapsed ? 'justify-center' : 'gap-3'} ${activeView === item.view ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            title={isCollapsed ? t(item.labelKey) : ''}
                        >
                            {React.cloneElement(item.icon as React.ReactElement<any>, { className: "w-4 h-4" })}
                            {!isCollapsed && <span className="text-xs font-bold tracking-wide truncate">{t(item.labelKey)}</span>}
                        </button>
                    ))}
                </nav>

                <div className={`mt-auto border-t border-white/5 bg-[#050B14] p-4 flex flex-col gap-4`}>
                    <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3' : 'gap-2'}`}>
                        <button onClick={toggleTheme} className="p-2 rounded-full text-slate-400 hover:text-white bg-white/5 border border-white/5 shadow-sm">
                            {theme === 'light' ? <MoonIcon className="w-3.5 h-3.5" /> : <SunIcon className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={handleLanguageCycle} className="p-2 rounded-full text-slate-400 hover:text-white uppercase text-[9px] font-bold w-8 h-8 text-center bg-white/5 border border-white/5 shadow-sm">
                            {language}
                        </button>
                        <button onClick={() => window.open(`https://wa.me/${systemSettings.supportNumber}`, '_blank')} className="p-2 rounded-full text-slate-400 hover:text-emerald-400 bg-white/5 border border-emerald-500/30 shadow-sm">
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={openPaymentModal} className={`flex items-center justify-center rounded-full transition-all border ${isCollapsed ? 'p-2' : 'ml-auto h-8 px-3 gap-2'} ${getStatusStyle()}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {!isCollapsed && <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">{subscription.daysRemaining}d</span>}
                        </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <div 
                            className={`flex items-center gap-3 min-w-0 group cursor-pointer ${isCollapsed ? 'mx-auto' : ''}`} 
                            onClick={() => !isCollapsed && setActiveView('settings')}
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-blue to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg border border-white/10 group-hover:ring-2 group-hover:ring-brand-blue/50 transition-all">
                                {user?.email?.charAt(0).toUpperCase()}
                            </div>
                            {!isCollapsed && (
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-white truncate max-w-[100px] group-hover:text-brand-blue transition-colors">Perfil</span>
                                    <span className="text-[9px] text-slate-500 truncate max-w-[100px]">{user?.email}</span>
                                </div>
                            )}
                        </div>
                        
                        <button 
                            type="button"
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className={`p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ${isCollapsed ? 'mx-auto mt-2' : 'ml-auto shrink-0'} ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Sair da Conta"
                        >
                            {isLoggingOut ? (
                                <svg className="animate-spin h-5 w-5 text-slate-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <ArrowLeftOnRectangleIcon className="w-5 h-5 stroke-[2]" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-3 top-12 bg-[#020610] border border-slate-700 text-slate-400 hover:text-white p-1 rounded-full shadow-lg z-50">
                {isCollapsed ? <ChevronRightIcon className="w-3 h-3 stroke-[3]" /> : <ChevronLeftIcon className="w-3 h-3 stroke-[3]" />}
            </button>
        </aside>
    );
};
