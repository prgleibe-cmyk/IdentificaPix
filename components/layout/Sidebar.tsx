import React, { useState, useMemo, useContext, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { ViewType, Transaction, MatchResult, ReconciliationStatus } from '../../types';
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
    CloudArrowUpIcon,
    LinkIcon,
    UserIcon,
    XMarkIcon
} from '../Icons';

export const Sidebar: React.FC = () => {
    const { activeView, setActiveView } = useUI();
    const { t } = useTranslation();
    const { signOut, user, subscription, systemSettings } = useAuth();
    const { openPaymentModal, setMatchResults, setBulkIdentificationTxs, churches } = useContext(AppContext);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isNewLaunchModalOpen, setIsNewLaunchModalOpen] = useState(false);
    
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

    // Fechar modal de Novo Lançamento com a tecla Escape (idêntico ao Destinar Lote)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isNewLaunchModalOpen) {
                setIsNewLaunchModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isNewLaunchModalOpen]);

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
    };

    const handleManualLaunch = (type: 'entrada' | 'saida') => {
        const amountStr = window.prompt("Digite o valor da transação (Ex: 1500,00):");
        if (!amountStr) return;

        let amountFloat = parseFloat(amountStr.replace(/[^\d.-]/g, '').replace(',', '.'));
        if (isNaN(amountFloat) || amountFloat === 0) {
            alert("Por favor, digite um valor válido.");
            return;
        }

        if (type === 'saida') {
            amountFloat = -Math.abs(amountFloat);
        } else {
            amountFloat = Math.abs(amountFloat);
        }

        const description = window.prompt("Descrição do lançamento (Opcional):") || "Lançamento Manual";

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

        setIsNewLaunchModalOpen(false);
        setMatchResults((prev: any) => [...prev, newMatchResult]);
        setBulkIdentificationTxs([newTx]);
    };

    const isSecondaryUser = subscription.ownerId && subscription.ownerId !== user?.id;

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
        );

        // Configurações apenas para o proprietário (Owner)
        if (!isSecondaryUser) {
            items.push({ view: 'settings', labelKey: 'nav.settings', icon: <Cog6ToothIcon className="w-5 h-5"/> });
        }

        if (isAdmin) items.push({ view: 'admin', labelKey: 'Admin', icon: <ShieldCheckIcon className="w-5 h-5"/>, special: true });
        return items;
    }, [isAdmin, subscription.role, isSecondaryUser]);

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

    // --- USER_MANAGEMENT_BLOCK ---
    const showUsersButton = subscription.role === 'owner' && !isSecondaryUser;
    const handleUsersClick = () => {
        setActiveView('users');
    };
    // -----------------------------

    return (
        <>
            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0F172A] border-b border-white/5 flex items-center justify-between px-4 z-[60] shadow-lg">
                <div className="flex items-center gap-2" onClick={() => setActiveView('dashboard')}>
                    <img src="/logo.png" className="h-8 w-auto object-contain" alt="Logo" />
                    <span className="font-display font-black text-lg tracking-tight text-white">
                        Identifica<span className="text-cyan-400">Pix</span>
                    </span>
                </div>
                <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
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
                    className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] animate-fade-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside className={`fixed lg:relative inset-y-0 left-0 h-[100dvh] flex flex-col transition-all duration-500 z-[80] ${isCollapsed ? 'w-24' : 'w-72'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} bg-[#0F172A] text-white border-r border-white/5 shadow-2xl overflow-hidden`}>
                
                <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]">
                <ChartBarIcon className="absolute -top-12 -right-12 w-64 h-64 text-white transform rotate-12" />
                <TableCellsIcon className="absolute top-[30%] -left-16 w-56 h-56 text-white transform -rotate-12" />
            </div>

            <div className="relative z-10 flex flex-col h-full">
                
                <div className={`flex flex-col items-center justify-center pt-4 pb-2 transition-all duration-500 ${isCollapsed ? 'px-2' : 'px-6'}`}>
                    <div className="relative group cursor-pointer perspective-[1000px] z-50" onClick={() => !isCollapsed && setActiveView('dashboard')}>
                        <div className="absolute -inset-10 bg-blue-500/10 rounded-full blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        <div className="relative transform-style-3d rotate-x-6 rotate-y-12 group-hover:rotate-x-0 group-hover:rotate-y-0 transition-transform duration-500 ease-out">
                            <img 
                                src="/logo.png" 
                                className={`${isCollapsed ? 'h-16' : 'h-32 lg:h-52'} w-auto object-contain transition-all duration-500 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]`} 
                                alt="Logo" 
                            />
                        </div>
                    </div>
                    {!isCollapsed && (
                        <div className="mt-1 text-center">
                            <span className="font-display font-black text-2xl tracking-tight text-white block leading-none">
                                Identifica<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Pix</span>
                            </span>
                        </div>
                    )}
                </div>

                <nav className="flex-1 px-4 space-y-1 py-1 overflow-y-auto custom-scrollbar relative z-20 min-h-0">
                    {/* Botão Dashboard */}
                    <button
                        type="button"
                        onClick={() => setActiveView('dashboard')}
                        className={`relative w-full flex items-center px-4 py-2.5 rounded-full transition-all duration-300 group mb-0.5 ${isCollapsed ? 'justify-center' : 'gap-3'} ${activeView === 'dashboard' ? 'bg-white/10 text-white shadow-lg border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <HomeIcon className={`w-5 h-5 transition-transform ${activeView === 'dashboard' ? 'scale-110 text-brand-teal' : 'group-hover:scale-110'}`} />
                        {!isCollapsed && <span className="text-xs font-bold tracking-wide truncate">{t('nav.dashboard')}</span>}
                        {activeView === 'dashboard' && !isCollapsed && (
                            <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-brand-teal shadow-[0_0_8px_rgba(79,230,208,0.8)]"></div>
                        )}
                    </button>

                    {/* Botão Novo Lançamento (harmonizado, sem cor azul) */}
                    <button
                        type="button"
                        onClick={() => setIsNewLaunchModalOpen(true)}
                        className={`relative w-full flex items-center px-4 py-2.5 rounded-full transition-all duration-300 group mb-0.5 ${isCollapsed ? 'justify-center' : 'gap-3'} text-slate-400 hover:text-white hover:bg-white/5`}
                        title="Novo Lançamento"
                        id="btn-novo-lancamento"
                    >
                        <PlusCircleIcon className="w-5 h-5 transition-transform group-hover:scale-110" />
                        {!isCollapsed && <span className="text-xs font-bold tracking-wide truncate">Novo Lançamento</span>}
                    </button>
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

                    {/* USER_MANAGEMENT_BLOCK */}
                    {showUsersButton && (
                        <button
                            onClick={handleUsersClick}
                            className={`relative w-full flex items-center px-4 py-2.5 rounded-full transition-all duration-300 group mb-0.5 ${isCollapsed ? 'justify-center' : 'gap-3'} ${activeView === 'users' ? 'bg-white/10 text-white shadow-lg border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <UserIcon className={`w-5 h-5 transition-transform ${activeView === 'users' ? 'scale-110 text-brand-teal' : 'group-hover:scale-110'}`} />
                            {!isCollapsed && <span className="text-xs font-bold tracking-wide truncate">Usuários</span>}
                            {activeView === 'users' && !isCollapsed && (
                                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-brand-teal shadow-[0_0_8px_rgba(79,230,208,0.8)]"></div>
                            )}
                        </button>
                    )}
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
                        
                        <button 
                            onClick={isSecondaryUser ? undefined : openPaymentModal} 
                            className={`flex items-center justify-center rounded-full transition-all border shadow-lg ${isCollapsed ? 'p-2.5 w-10 h-10 mx-auto' : 'flex-1 py-2.5 gap-2'} ${getStatusStyle()} ${isSecondaryUser ? 'cursor-default' : ''}`}
                        >
                            <StatusIcon className="w-4 h-4" />
                            {!isCollapsed && (
                                <span className="text-[10px] font-black uppercase tracking-wider">
                                    {isSecondaryUser ? 'Gerenciado' : `${subscription.daysRemaining} dias`}
                                </span>
                            )}
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

            <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden lg:flex absolute -right-3 top-10 bg-[#0F172A] border border-slate-700 text-slate-400 hover:text-white p-1.5 rounded-full shadow-xl z-50 hover:scale-110 transition-transform">
                {isCollapsed ? <ChevronRightIcon className="w-3 h-3 stroke-[3]" /> : <ChevronLeftIcon className="w-3 h-3 stroke-[3]" />}
            </button>
        </aside>

        {isNewLaunchModalOpen && (
            <div 
                className="glass-overlay animate-fade-in z-[9999]" 
                id="new-launch-modal" 
                onClick={() => setIsNewLaunchModalOpen(false)}
            >
                <div 
                    className="glass-modal w-full max-w-lg flex flex-col animate-scale-in rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-white/10 bg-white dark:bg-[#0F172A]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header idêntico ao DESTINAR LOTE */}
                    <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-brand-blue text-white shadow-lg shadow-blue-500/20">
                                <PlusCircleIcon className="w-6 h-6 animate-scale-in" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                    Novo Lançamento
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Lançamento Manual</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[7px] font-black text-slate-400 uppercase border border-slate-200 dark:border-slate-800 px-1 rounded">Esc</span>
                            <button 
                                type="button" 
                                onClick={() => setIsNewLaunchModalOpen(false)} 
                                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors cursor-pointer"
                                id="close-launch-modal"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    <div className="p-8 space-y-6 flex-1">
                        <p className="text-xs text-slate-400 dark:text-slate-400 font-medium ml-1">
                            Selecione o tipo de transação que deseja lançar manualmente para alimentar o fluxo de conciliação.
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => handleManualLaunch('entrada')}
                                className="flex flex-col items-center justify-center p-8 rounded-[2rem] border-2 border-slate-100 dark:border-white/5 bg-slate-50 hover:bg-emerald-50/30 hover:border-emerald-500/35 dark:bg-black/10 dark:hover:bg-emerald-950/10 dark:hover:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 transition-all duration-300 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 group"
                                id="btn-entrada"
                            >
                                <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest">Entrada</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleManualLaunch('saida')}
                                className="flex flex-col items-center justify-center p-8 rounded-[2rem] border-2 border-slate-100 dark:border-white/5 bg-slate-50 hover:bg-rose-50/30 hover:border-rose-500/35 dark:bg-black/10 dark:hover:bg-rose-950/10 dark:hover:border-rose-500/30 text-rose-600 dark:text-rose-400 transition-all duration-300 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 group"
                                id="btn-saida"
                            >
                                <div className="w-14 h-14 rounded-full bg-rose-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-rose-500/20 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest">Saída</span>
                            </button>
                        </div>
                    </div>

                    {/* Footer idêntico ao DESTINAR LOTE */}
                    <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3 rounded-b-[2.5rem]">
                        <button 
                            type="button" 
                            onClick={() => setIsNewLaunchModalOpen(false)} 
                            className="px-6 py-3 text-[10px] font-black rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all uppercase tracking-widest cursor-pointer"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};