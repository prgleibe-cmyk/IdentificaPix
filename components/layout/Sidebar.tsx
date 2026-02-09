
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { ViewType } from '../../types';
import { 
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
    CheckBadgeIcon,
    ExclamationTriangleIcon,
    WhatsAppIcon,
    PresentationChartLineIcon,
    DocumentDuplicateIcon,
    TableCellsIcon,
    CloudArrowUpIcon
} from '../Icons';

export const Sidebar: React.FC = () => {
    const { activeView, setActiveView } = useUI();
    const { t } = useTranslation();
    const { signOut, user, subscription, systemSettings } = useAuth();
    const { openPaymentModal } = useContext(AppContext);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    const isAdmin = user?.email?.toLowerCase().trim() === 'identificapix@gmail.com';

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
    };

    const navItems = useMemo(() => {
        const items: { view: ViewType, labelKey: string, icon: React.ReactNode, special?: boolean }[] = [
            { view: 'dashboard', labelKey: 'nav.dashboard', icon: <HomeIcon className="w-5 h-5"/> },
            { view: 'upload', labelKey: 'nav.upload', icon: <UploadIcon className="w-5 h-5"/> },
            { view: 'cadastro', labelKey: 'nav.register', icon: <PlusCircleIcon className="w-5 h-5"/> },
            { view: 'reports', labelKey: 'nav.reports', icon: <ChartBarIcon className="w-5 h-5"/> },
            { view: 'savedReports', labelKey: 'nav.savedReports', icon: <DocumentDuplicateIcon className="w-5 h-5"/> },
            { view: 'smart_analysis', labelKey: 'nav.smart_analysis', icon: <PresentationChartLineIcon className="w-5 h-5"/> },
            { view: 'settings', labelKey: 'nav.settings', icon: <Cog6ToothIcon className="w-5 h-5"/> },
        ];
        if (isAdmin) items.push({ view: 'admin', labelKey: 'Admin', icon: <ShieldCheckIcon className="w-5 h-5"/>, special: true });
        return items;
    }, [isAdmin]);

    const getStatusStyle = () => {
        if (subscription.isExpired) return 'border-red-500/30 text-red-400 bg-red-500/10';
        if (subscription.plan === 'lifetime') return 'border-purple-500/30 text-purple-400 bg-purple-500/10';
        if (subscription.daysRemaining <= 5) return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
        return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
    };

    const StatusIcon = subscription.isExpired ? ExclamationTriangleIcon : (subscription.plan === 'lifetime' ? CheckBadgeIcon : SparklesIcon);

    const handleLogout = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try { await signOut(); } finally { setIsLoggingOut(false); }
    };

    return (
        <aside className={`relative h-screen flex flex-col transition-all duration-500 z-50 ${isCollapsed ? 'w-24' : 'w-72'} bg-[#0F172A] text-white border-r border-white/5 shadow-2xl overflow-hidden`}>
            
            <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]">
                <ChartBarIcon className="absolute -top-12 -right-12 w-64 h-64 text-white transform rotate-12" />
                <TableCellsIcon className="absolute top-[30%] -left-16 w-56 h-56 text-white transform -rotate-12" />
            </div>

            <div className="relative z-10 flex flex-col h-full">
                
                <div className={`flex flex-col items-center justify-center py-8 transition-all duration-500 ${isCollapsed ? 'px-2' : 'px-6'}`}>
                    <div className="relative group cursor-pointer perspective-[1000px] z-50" onClick={() => !isCollapsed && setActiveView('dashboard')}>
                        <div className="absolute -inset-10 bg-blue-500/20 rounded-full blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        <div className="relative transform-style-3d rotate-x-6 rotate-y-12 group-hover:rotate-x-0 group-hover:rotate-y-0 transition-transform duration-500 ease-out">
                            <div className="relative bg-gradient-to-br from-white/20 via-white/5 to-transparent p-4 rounded-[2.5rem] border border-white/20 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
                                <img src="/pwa/icon-512.png" className={`${isCollapsed ? 'h-10' : 'h-20'} w-auto object-contain transition-all duration-500 drop-shadow-2xl`} alt="Logo" />
                                <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-tr from-white/10 to-transparent opacity-40 pointer-events-none"></div>
                            </div>
                        </div>
                    </div>
                    {!isCollapsed && (
                        <div className="mt-6 text-center">
                            <span className="font-display font-black text-2xl tracking-tight text-white block leading-none">
                                Identifica<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Pix</span>
                            </span>
                        </div>
                    )}
                </div>

                <nav className="flex-1 px-4 space-y-1 py-1 overflow-y-auto custom-scrollbar relative z-20">
                    {navItems.map((item) => (
                        <button
                            key={item.view}
                            onClick={() => setActiveView(item.view)}
                            className={`relative w-full flex items-center px-4 py-2.5 rounded-full transition-all duration-300 group mb-0.5 ${isCollapsed ? 'justify-center' : 'gap-3'} ${activeView === item.view ? 'bg-white/10 text-white shadow-lg border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            {React.cloneElement(item.icon as React.ReactElement<any>, { className: `w-5 h-5 transition-transform ${activeView === item.view ? 'scale-110 text-brand-teal' : 'group-hover:scale-110'}` })}
                            {!isCollapsed && <span className="text-xs font-bold tracking-wide truncate">{item.labelKey.includes('.') ? t(item.labelKey as any) : item.labelKey}</span>}
                            {activeView === item.view && !isCollapsed && (
                                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-brand-teal shadow-[0_0_8px_rgba(79,230,208,0.8)]"></div>
                            )}
                        </button>
                    ))}
                </nav>

                <div className={`mt-auto border-t border-white/5 bg-[#0F172A]/80 backdrop-blur-md p-4 flex flex-col gap-3 relative z-20`}>
                    
                    {deferredPrompt && (
                        <button 
                            onClick={handleInstallApp}
                            className={`flex items-center justify-center rounded-full text-brand-teal hover:text-white bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500 transition-all animate-pulse ${isCollapsed ? 'p-2.5 w-10 h-10 mx-auto' : 'w-full py-2.5 gap-2'}`}
                            title="Instalar IdentificaPix como App"
                        >
                            <CloudArrowUpIcon className="w-4 h-4" />
                            {!isCollapsed && <span className="text-[9px] font-black uppercase tracking-widest">Instalar App</span>}
                        </button>
                    )}

                    <div className="flex gap-2">
                        <button onClick={() => window.open(`https://wa.me/${systemSettings.supportNumber}`, '_blank')} className={`flex items-center justify-center rounded-full text-slate-400 hover:text-emerald-400 bg-white/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors ${isCollapsed ? 'p-2.5 w-10 h-10 mx-auto' : 'flex-1 py-2.5 gap-2'}`}>
                            <WhatsAppIcon className="w-4 h-4" />
                            {!isCollapsed && <span className="text-[10px] font-bold uppercase tracking-wide">Suporte</span>}
                        </button>
                        
                        <button onClick={openPaymentModal} className={`flex items-center justify-center rounded-full transition-all border shadow-lg ${isCollapsed ? 'p-2.5 w-10 h-10 mx-auto' : 'flex-1 py-2.5 gap-2'} ${getStatusStyle()}`}>
                            <StatusIcon className="w-4 h-4" />
                            {!isCollapsed && <span className="text-[10px] font-black uppercase tracking-wider">{subscription.daysRemaining} dias</span>}
                        </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <div className={`flex items-center gap-3 min-w-0 group cursor-pointer ${isCollapsed ? 'mx-auto' : ''}`} onClick={() => !isCollapsed && setActiveView('settings')}>
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-blue to-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-lg border border-white/10 group-hover:ring-2 group-hover:ring-brand-blue/50 transition-all">
                                {user?.email?.charAt(0).toUpperCase()}
                            </div>
                            {!isCollapsed && (
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-white truncate max-w-[120px]">Minha Conta</span>
                                    <span className="text-[10px] text-slate-500 truncate max-w-[120px] font-medium">{user?.email}</span>
                                </div>
                            )}
                        </div>
                        
                        <button type="button" onClick={handleLogout} disabled={isLoggingOut} className={`p-2.5 rounded-full text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ${isCollapsed ? 'mx-auto mt-2' : 'ml-auto shrink-0'} ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {isLoggingOut ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <ArrowLeftOnRectangleIcon className="w-5 h-5 stroke-[2]" />}
                        </button>
                    </div>
                </div>
            </div>

            <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-3 top-10 bg-[#0F172A] border border-slate-700 text-slate-400 hover:text-white p-1.5 rounded-full shadow-xl z-50 hover:scale-110 transition-transform">
                {isCollapsed ? <ChevronRightIcon className="w-3 h-3 stroke-[3]" /> : <ChevronLeftIcon className="w-3 h-3 stroke-[3]" />}
            </button>
        </aside>
    );
};
