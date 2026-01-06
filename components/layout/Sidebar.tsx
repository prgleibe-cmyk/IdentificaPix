
import React, { useState, useMemo, useContext } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { ViewType } from '../../types';
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
    CheckBadgeIcon,
    ExclamationTriangleIcon,
    WhatsAppIcon,
    PresentationChartLineIcon,
    DocumentDuplicateIcon,
    ArrowPathIcon
} from '../Icons';

export const Sidebar: React.FC = () => {
    const { activeView, setActiveView } = useUI();
    const { t } = useTranslation();
    const { signOut, user, subscription, systemSettings, loading: authLoading } = useAuth();
    const { openPaymentModal, isSyncing } = useContext(AppContext);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const isAdmin = user?.email?.toLowerCase().trim() === 'identificapix@gmail.com';

    const navItems = useMemo(() => {
        const items: { view: ViewType, labelKey: any, icon: React.ReactNode, special?: boolean }[] = [
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
        <aside className={`relative h-screen flex flex-col transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) z-50 ${isCollapsed ? 'w-24' : 'w-72'} bg-[#020610] text-white border-r border-white/5 shadow-2xl`}>
            <div className="relative z-10 flex flex-col h-full">
                
                {/* 3D LOGO CONTAINER - Compactado verticalmente (py-6) */}
                <div className={`flex flex-col items-center justify-center py-6 transition-all duration-500 ${isCollapsed ? 'px-2' : 'px-6'}`}>
                    <div 
                        className="relative group cursor-pointer perspective-[1000px] z-50" 
                        onClick={() => !isCollapsed && setActiveView('dashboard')}
                        style={{ perspective: '1000px' }}
                    >
                        {/* Outer Glow Halo */}
                        <div className="absolute -inset-6 bg-blue-500/20 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        
                        {/* The 3D Block Container */}
                        <div className="relative transform-style-3d rotate-x-6 rotate-y-12 group-hover:rotate-x-0 group-hover:rotate-y-0 transition-transform duration-500 ease-out">
                            
                            {/* Glass Surface */}
                            <div className="
                                relative bg-gradient-to-br from-white/10 via-white/5 to-transparent 
                                p-4 rounded-2xl border border-white/20 
                                backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)_inset]
                                group-hover:shadow-[0_20px_50px_rgba(59,130,246,0.3),0_0_0_1px_rgba(255,255,255,0.3)_inset]
                                transition-all duration-500
                            ">
                                <LogoIcon className="w-12 h-12 text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]" />
                                
                                {/* Shine Reflection */}
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            </div>
                        </div>
                    </div>
                    
                    {!isCollapsed && (
                        <div className="mt-4 text-center transform translate-z-0">
                            <span className="font-display font-black text-2xl tracking-tight text-white block leading-none drop-shadow-md">
                                Identifica<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Pix</span>
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-bold mt-1.5 block">Enterprise System</span>
                        </div>
                    )}
                </div>

                {/* Navegação - Compactada (space-y-1) */}
                <nav className="flex-1 px-4 space-y-1 py-1 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => (
                        <button
                            key={item.view}
                            onClick={() => setActiveView(item.view)}
                            className={`relative w-full flex items-center px-4 py-2.5 rounded-full transition-all duration-300 group mb-0.5 ${isCollapsed ? 'justify-center' : 'gap-3'} ${activeView === item.view ? 'bg-white/10 text-white shadow-lg shadow-black/20 border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            title={isCollapsed ? t(item.labelKey) : ''}
                        >
                            {React.cloneElement(item.icon as React.ReactElement<any>, { className: `w-5 h-5 transition-transform duration-300 ${activeView === item.view ? 'scale-110 text-brand-teal' : 'group-hover:scale-110'}` })}
                            {!isCollapsed && <span className="text-xs font-bold tracking-wide truncate">{t(item.labelKey)}</span>}
                            
                            {activeView === item.view && !isCollapsed && (
                                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-brand-teal shadow-[0_0_8px_rgba(79,230,208,0.8)]"></div>
                            )}
                        </button>
                    ))}
                </nav>

                <div className={`mt-auto border-t border-white/5 bg-[#050B14] p-4 flex flex-col gap-3`}>
                    
                    {/* Indicador de Sync */}
                    {isSyncing && (
                        <div className={`flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full animate-pulse ${isCollapsed ? 'mx-auto' : ''}`}>
                            <ArrowPathIcon className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                            {!isCollapsed && <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Sincronizando...</span>}
                        </div>
                    )}

                    <div className={`flex ${isCollapsed ? 'flex-col gap-3' : 'gap-2'}`}>
                        {/* Botão de Suporte WhatsApp */}
                        <button 
                            onClick={() => window.open(`https://wa.me/${systemSettings.supportNumber}`, '_blank')} 
                            className={`flex items-center justify-center rounded-full text-slate-400 hover:text-emerald-400 bg-white/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors shadow-sm ${isCollapsed ? 'p-2.5 w-10 h-10 mx-auto' : 'flex-1 py-2.5 gap-2'}`}
                            title="Suporte WhatsApp"
                        >
                            <WhatsAppIcon className="w-4 h-4" />
                            {!isCollapsed && <span className="text-[10px] font-bold uppercase tracking-wide">Suporte</span>}
                        </button>
                        
                        {/* Botão de Status/Pagamento */}
                        <button 
                            onClick={openPaymentModal} 
                            className={`flex items-center justify-center rounded-full transition-all border shadow-lg ${isCollapsed ? 'p-2.5 w-10 h-10 mx-auto' : 'flex-1 py-2.5 gap-2'} ${getStatusStyle()}`}
                            title={isCollapsed ? `${subscription.daysRemaining} dias restantes` : ''}
                        >
                            <StatusIcon className="w-4 h-4" />
                            {!isCollapsed && <span className="text-[10px] font-black uppercase tracking-wider">{subscription.daysRemaining} dias</span>}
                        </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <div 
                            className={`flex items-center gap-3 min-w-0 group cursor-pointer ${isCollapsed ? 'mx-auto' : ''}`} 
                            onClick={() => !isCollapsed && setActiveView('settings')}
                        >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-blue to-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-lg border border-white/10 group-hover:ring-2 group-hover:ring-brand-blue/50 transition-all">
                                {user?.email?.charAt(0).toUpperCase()}
                            </div>
                            {!isCollapsed && (
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-white truncate max-w-[120px] group-hover:text-brand-blue transition-colors">Minha Conta</span>
                                    <span className="text-[10px] text-slate-500 truncate max-w-[120px] font-medium">{user?.email}</span>
                                </div>
                            )}
                        </div>
                        
                        <button 
                            type="button"
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className={`p-2.5 rounded-full text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ${isCollapsed ? 'mx-auto mt-2' : 'ml-auto shrink-0'} ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}
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

            <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-3 top-10 bg-[#020610] border border-slate-700 text-slate-400 hover:text-white p-1.5 rounded-full shadow-xl z-50 hover:scale-110 transition-transform">
                {isCollapsed ? <ChevronRightIcon className="w-3 h-3 stroke-[3]" /> : <ChevronLeftIcon className="w-3 h-3 stroke-[3]" />}
            </button>
        </aside>
    );
};
