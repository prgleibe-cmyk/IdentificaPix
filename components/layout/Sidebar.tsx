import React, { useState, useMemo, useContext, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { ViewType, Transaction, MatchResult, ReconciliationStatus } from '../../types';
const logoImg = '/logo.png?v=15';
import { 
    HomeIcon, 
    UploadIcon, 
    PlusCircleIcon, 
    ChartBarIcon, 
    Cog6ToothIcon, 
    ArrowLeftOnRectangleIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CheckBadgeIcon,
    ExclamationTriangleIcon,
    WhatsAppIcon,
    PresentationChartLineIcon,
    DocumentDuplicateIcon,
    TableCellsIcon,
    CloudArrowUpIcon,
    UserIcon,
    CreditCardIcon
} from '../Icons';

export const Sidebar: React.FC = () => {
    const { activeView, setActiveView } = useUI();
    const { t } = useTranslation();
    const { signOut, user, subscription, systemSettings } = useAuth();
    const { openPaymentModal, setMatchResults, setBulkIdentificationTxs, bulkIdentificationTxs, churches } = useContext(AppContext);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    const isAdmin = user?.email?.toLowerCase().trim() === 'identificapix@gmail.com';

    // Fechar menu mobile ao mudar de view
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [activeView]);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleManualLaunch = (type: 'entrada' | 'saida') => {
        const existingGhost = bulkIdentificationTxs?.find((tx: any) => tx.id.startsWith('ghost-manual-'));
        if (existingGhost) {
            setActiveView('novo_lancamento');
            return;
        }

        const amountFloat = 0;
        const description = type === 'entrada' ? 'Lançamento Manual Entrada' : 'Lançamento Manual Saída';

        const manualTxId = `ghost-manual-${Date.now()}`;
        const newTx: Transaction = {
            id: manualTxId,
            date: new Date().toISOString().split('T')[0],
            description: description,
            rawDescription: description,
            amount: amountFloat,
            isConfirmed: false
        };

        const defaultChurch = churches[0] || { id: '', name: 'Sem Igreja', address: '', logoUrl: '' };

        const newMatchResult: MatchResult = {
            transaction: newTx,
            contributor: null,
            status: ReconciliationStatus.PENDING,
            church: defaultChurch,
            isConfirmed: false,
            updatedAt: new Date().toISOString()
        };

        setMatchResults((prev: any) => [...prev, newMatchResult]);
        setBulkIdentificationTxs([newTx]);
        setActiveView('novo_lancamento');
    };

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
    };

    const isSecondaryUser = (subscription.ownerId && subscription.ownerId !== user?.id) &&
        subscription.role !== 'owner' &&
        subscription.role !== 'admin' &&
        subscription.role !== 'principal';

    const navItems = useMemo(() => {
        const items: { view: ViewType, labelKey: string, icon: React.ReactNode, special?: boolean }[] = [];

        // Lançar Dados (upload) apenas para o proprietário (Owner)
        if (!isSecondaryUser) {
            items.push({ view: 'upload', labelKey: 'nav.upload', icon: <UploadIcon className="w-5 h-5"/> });
        }

        // Cadastro apenas para o proprietário (Owner)
        if (subscription.role === 'owner') {
            items.push({ view: 'cadastro', labelKey: 'nav.register', icon: <PlusCircleIcon className="w-5 h-5"/> });
        }

        items.push(
            { view: 'reports', labelKey: 'nav.reports', icon: <ChartBarIcon className="w-5 h-5"/> },
            { view: 'savedReports', labelKey: 'nav.savedReports', icon: <DocumentDuplicateIcon className="w-5 h-5"/> },
            { view: 'smart_analysis', labelKey: 'nav.smart_analysis', icon: <PresentationChartLineIcon className="w-5 h-5"/> },
            { view: 'financial', labelKey: 'nav.financial', icon: <CreditCardIcon className="w-5 h-5"/> },
        );

        // Configurações apenas para o proprietário (Owner)
        if (!isSecondaryUser) {
            items.push({ view: 'settings', labelKey: 'nav.settings', icon: <Cog6ToothIcon className="w-5 h-5"/> });
        }

        if (isAdmin) items.push({ view: 'admin', labelKey: 'Admin', icon: <UserIcon className="w-5 h-5"/>, special: true });
        return items;
    }, [isAdmin, subscription.role, isSecondaryUser]);

    const getStatusStyle = () => {
        if (subscription.isExpired) return 'border-red-200 text-red-700 bg-red-50 dark:border-red-500/20 dark:text-red-300 dark:bg-red-500/10 hover:bg-red-500/20';
        if (subscription.plan === 'lifetime') return 'border-purple-200 text-purple-700 bg-purple-50 dark:border-purple-500/20 dark:text-purple-300 dark:bg-purple-500/10 hover:bg-purple-500/20';
        if (subscription.daysRemaining <= 5) return 'border-amber-200 text-amber-700 bg-amber-50 dark:border-amber-500/20 dark:text-amber-300 dark:bg-amber-500/10 hover:bg-amber-500/20';
        return 'border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-500/20 dark:text-emerald-300 dark:bg-emerald-500/10 hover:bg-emerald-500/20';
    };

    const StatusIcon = subscription.isExpired ? ExclamationTriangleIcon : (subscription.plan === 'lifetime' ? CheckBadgeIcon : CheckBadgeIcon);

    const handleLogout = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try { await signOut(); } finally { setIsLoggingOut(false); }
    };

    // --- USER_MANAGEMENT_BLOCK ---
    const showUsersButton = subscription.role === 'owner' && !isSecondaryUser;
    const handleUsersClick = () => {
        setActiveView('users');
    };
    // -----------------------------

    return (
        <>
            {/* Mobile Header */}
            <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#F8FAFC] dark:bg-[#0B0F17] border-b border-slate-200/80 dark:border-white/5 flex items-center justify-between px-4 z-[60] shadow-sm">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveView('dashboard')}>
                    <img src={logoImg} className="h-8 w-auto object-contain" alt="Logo" />
                    <span className="font-display font-black text-lg tracking-tight text-slate-800 dark:text-white">
                        Ig<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-amber-600">Gestor</span>
                    </span>
                </div>
                <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                    {isMobileMenuOpen ? (
                        <ChevronLeftIcon className="w-6 h-6" />
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                        </svg>
                    )}
                </button>
            </header>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] animate-fade-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside className={`fixed md:relative inset-y-0 left-0 h-[100dvh] flex flex-col transition-all duration-500 z-[80] ${isCollapsed ? 'w-24' : 'w-72'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} bg-gradient-to-b from-[#E6EFEA] via-[#D8E8DF] to-[#CADFD4] dark:from-[#0B1411] dark:to-[#050D0A] text-slate-800 dark:text-slate-200 border-r border-emerald-200/50 dark:border-white/5 shadow-2xl shadow-emerald-950/5 overflow-hidden`}>
                
                <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.05]">
                    <ChartBarIcon className="absolute -top-12 -right-12 w-64 h-64 text-emerald-600 dark:text-emerald-400 transform rotate-12" />
                    <TableCellsIcon className="absolute top-[30%] -left-16 w-56 h-56 text-emerald-600 dark:text-emerald-400 transform -rotate-12" />
                </div>

                <div className="relative z-10 flex flex-col h-full">
                    
                    <div className={`flex flex-col items-center justify-center pt-4 pb-2 transition-all duration-500 ${isCollapsed ? 'px-2' : 'px-6'}`}>
                        <div className="relative group cursor-pointer perspective-[1000px] z-50" onClick={() => !isCollapsed && setActiveView('dashboard')}>
                            <div className="absolute -inset-10 bg-amber-500/10 rounded-full blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <div className="relative transform-style-3d rotate-x-6 rotate-y-12 group-hover:rotate-x-0 group-hover:rotate-y-0 transition-transform duration-500 ease-out">
                                <img 
                                    src={logoImg} 
                                    className={`${isCollapsed ? 'h-16' : 'h-32 md:h-52'} w-auto object-contain transition-all duration-500 drop-shadow-[0_15px_30px_rgba(0,0,0,0.12)]`} 
                                    alt="Logo" 
                                />
                            </div>
                        </div>
                        {!isCollapsed && (
                            <div className="mt-1 text-center">
                                <span className="font-display font-black text-2xl tracking-tight text-slate-800 dark:text-white block leading-none">
                                    Ig<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">Gestor</span>
                                </span>
                            </div>
                        )}
                    </div>

                    <nav className="flex-1 px-4 space-y-1.5 py-2 overflow-y-auto custom-scrollbar relative z-20 min-h-0">
                        {/* Botão Dashboard */}
                        <button
                            type="button"
                            onClick={() => setActiveView('dashboard')}
                            className={`relative w-full flex items-center px-4 py-2.5 rounded-xl transition-all duration-300 group mb-0.5 ${isCollapsed ? 'justify-center' : 'gap-3'} ${
                                activeView === 'dashboard' 
                                    ? 'bg-gradient-to-r from-orange-500/12 to-amber-500/8 text-orange-700 dark:text-orange-400 border border-orange-500/25 font-bold shadow-[0_4px_12px_rgba(249,115,22,0.04)]' 
                                    : 'text-slate-600 dark:text-emerald-100/70 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-500/5 dark:hover:bg-white/5 border border-transparent'
                            }`}
                        >
                            <HomeIcon className={`w-5 h-5 transition-transform ${activeView === 'dashboard' ? 'scale-110 text-orange-600 dark:text-orange-400' : 'group-hover:scale-110'}`} />
                            {!isCollapsed && <span className="text-xs font-bold tracking-wide truncate">{t('nav.dashboard')}</span>}
                            {activeView === 'dashboard' && !isCollapsed && (
                                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
                            )}
                        </button>

                        {/* Botão Novo Lançamento (harmonizado, sem cor azul) */}
                        <button
                            type="button"
                            onClick={() => handleManualLaunch('entrada')}
                            className={`relative w-full flex items-center px-4 py-2.5 rounded-xl transition-all duration-300 group mb-0.5 ${isCollapsed ? 'justify-center' : 'gap-3'} ${
                                activeView === 'novo_lancamento' 
                                    ? 'bg-gradient-to-r from-orange-500/12 to-amber-500/8 text-orange-700 dark:text-orange-400 border border-orange-500/25 font-bold shadow-[0_4px_12px_rgba(249,115,22,0.04)]' 
                                    : 'text-slate-600 dark:text-emerald-100/70 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-500/5 dark:hover:bg-white/5 border border-transparent'
                            }`}
                            title="Novo Lançamento"
                            id="btn-novo-lancamento"
                        >
                            <PlusCircleIcon className={`w-5 h-5 transition-transform ${activeView === 'novo_lancamento' ? 'scale-110 text-orange-600 dark:text-orange-400' : 'group-hover:scale-110'}`} />
                            {!isCollapsed && <span className="text-xs font-bold tracking-wide truncate">Novo Lançamento</span>}
                            {activeView === 'novo_lancamento' && !isCollapsed && (
                                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
                            )}
                        </button>

                        {navItems.map((item) => (
                            <button
                                key={item.view}
                                onClick={() => setActiveView(item.view)}
                                className={`relative w-full flex items-center px-4 py-2.5 rounded-xl transition-all duration-300 group mb-0.5 ${isCollapsed ? 'justify-center' : 'gap-3'} ${
                                    activeView === item.view 
                                        ? 'bg-gradient-to-r from-orange-500/12 to-amber-500/8 text-orange-700 dark:text-orange-400 border border-orange-500/25 font-bold shadow-[0_4px_12px_rgba(249,115,22,0.04)]' 
                                        : 'text-slate-600 dark:text-emerald-100/70 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-500/5 dark:hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                {React.cloneElement(item.icon as React.ReactElement<any>, { className: `w-5 h-5 transition-transform ${activeView === item.view ? 'scale-110 text-orange-600 dark:text-orange-400' : 'group-hover:scale-110'}` })}
                                {!isCollapsed && <span className="text-xs font-bold tracking-wide truncate">{item.labelKey.includes('.') ? t(item.labelKey as any) : item.labelKey}</span>}
                                {activeView === item.view && !isCollapsed && (
                                    <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
                                )}
                            </button>
                        ))}

                        {/* USER_MANAGEMENT_BLOCK */}
                        {showUsersButton && (
                            <button
                                onClick={handleUsersClick}
                                className={`relative w-full flex items-center px-4 py-2.5 rounded-xl transition-all duration-300 group mb-0.5 ${isCollapsed ? 'justify-center' : 'gap-3'} ${
                                    activeView === 'users' 
                                        ? 'bg-gradient-to-r from-orange-500/12 to-amber-500/8 text-orange-700 dark:text-orange-400 border border-orange-500/25 font-bold shadow-[0_4px_12px_rgba(249,115,22,0.04)]' 
                                        : 'text-slate-600 dark:text-emerald-100/70 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-500/5 dark:hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                <UserIcon className={`w-5 h-5 transition-transform ${activeView === 'users' ? 'scale-110 text-orange-600 dark:text-orange-400' : 'group-hover:scale-110'}`} />
                                {!isCollapsed && <span className="text-xs font-bold tracking-wide truncate">Usuários</span>}
                                {activeView === 'users' && !isCollapsed && (
                                    <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
                                )}
                            </button>
                        )}
                    </nav>

                    <div className="mt-auto border-t border-emerald-200/60 dark:border-white/5 bg-[#C2D6CD]/95 dark:bg-[#070D0B]/95 backdrop-blur-md p-4 flex flex-col gap-3 relative z-20">
                        
                        {deferredPrompt && (
                            <button 
                                onClick={handleInstallApp}
                                className={`flex items-center justify-center rounded-xl text-orange-700 dark:text-orange-400 hover:text-white bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500 transition-all ${isCollapsed ? 'p-2.5 w-10 h-10 mx-auto' : 'w-full py-2.5 gap-2'}`}
                                title="Instalar IgGestor como App"
                            >
                                <CloudArrowUpIcon className="w-4 h-4" />
                                {!isCollapsed && <span className="text-[9px] font-black uppercase tracking-widest">Instalar App</span>}
                            </button>
                        )}

                        <div className="flex gap-2">
                            <button onClick={() => window.open(`https://wa.me/${systemSettings.supportNumber}`, '_blank')} className={`flex items-center justify-center rounded-xl text-slate-600 dark:text-emerald-100/70 hover:text-emerald-800 dark:hover:text-white bg-white/60 dark:bg-white/5 border border-emerald-200/50 dark:border-white/10 hover:bg-emerald-500/10 transition-colors ${isCollapsed ? 'p-2.5 w-10 h-10 mx-auto' : 'flex-1 py-2.5 gap-2'}`}>
                                <WhatsAppIcon className="w-4 h-4" />
                                {!isCollapsed && <span className="text-[10px] font-bold uppercase tracking-wide">Suporte</span>}
                            </button>
                            
                            <button 
                                onClick={isSecondaryUser ? undefined : openPaymentModal} 
                                className={`flex items-center justify-center rounded-xl transition-all border shadow-sm ${isCollapsed ? 'p-2.5 w-10 h-10 mx-auto' : 'flex-1 py-2.5 gap-2'} ${getStatusStyle()} ${isSecondaryUser ? 'cursor-default' : ''}`}
                            >
                                <StatusIcon className="w-4 h-4" />
                                {!isCollapsed && (
                                    <span className="text-[10px] font-black uppercase tracking-wider">
                                        {isSecondaryUser ? 'Gerenciado' : `${subscription.daysRemaining} dias`}
                                    </span>
                                )}
                            </button>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60 dark:border-white/5">
                            <div className={`flex items-center gap-3 min-w-0 group cursor-pointer ${isCollapsed ? 'mx-auto' : ''}`} onClick={() => !isCollapsed && setActiveView('settings')}>
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-xs font-black text-white shadow-md border border-white/20 group-hover:ring-2 group-hover:ring-orange-500/30 transition-all">
                                    {user?.email?.charAt(0).toUpperCase()}
                                </div>
                                {!isCollapsed && (
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[120px]">Minha Conta</span>
                                        <span className="text-[10px] text-slate-500 dark:text-emerald-100/50 truncate max-w-[120px] font-medium">{user?.email}</span>
                                    </div>
                                )}
                            </div>
                            <button type="button" onClick={handleLogout} disabled={isLoggingOut} className={`p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors ${isCollapsed ? 'mx-auto mt-2' : 'ml-auto shrink-0'} ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                {isLoggingOut ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <ArrowLeftOnRectangleIcon className="w-5 h-5 stroke-[2]" />}
                            </button>
                        </div>
                    </div>
                </div>

                <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden md:flex absolute -right-3 top-10 bg-[#CADFD4] dark:bg-[#091512] border border-emerald-300/40 dark:border-white/5 text-emerald-800 dark:text-emerald-200 hover:text-emerald-950 dark:hover:text-white p-1.5 rounded-full shadow-md z-50 hover:scale-110 transition-transform">
                    {isCollapsed ? <ChevronRightIcon className="w-3 h-3 stroke-[3]" /> : <ChevronLeftIcon className="w-3 h-3 stroke-[3]" />}
                </button>
            </aside>
        </>
    );
};