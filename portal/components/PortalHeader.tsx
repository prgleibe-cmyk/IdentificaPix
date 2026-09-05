import React, { useEffect, useState } from 'react';
import { PortalChurch, ContributorMockProfile } from '../types/portal';
import { HeartHandshake, FileText, UserCheck, Menu, X, LogOut, BookmarkPlus, Smartphone, Download } from 'lucide-react';
import { PortalPwaInstallModal } from './PortalPwaInstallModal';

interface PortalHeaderProps {
    church?: PortalChurch | null;
    onNavigate?: (route: string) => void;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({ church, onNavigate }) => {
    const [contributor, setContributor] = useState<ContributorMockProfile | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(() => (window as any).deferredPwaPrompt || null);
    const [showInstallModal, setShowInstallModal] = useState(false);

    useEffect(() => {
        if ((window as any).deferredPwaPrompt) {
            setDeferredPrompt((window as any).deferredPwaPrompt);
        }
        const handler = (e: Event) => {
            e.preventDefault();
            (window as any).deferredPwaPrompt = e;
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleDownloadApp = async () => {
        const isStandalone = typeof window !== 'undefined' && (
            window.matchMedia('(display-mode: standalone)').matches || 
            (window.navigator as any).standalone === true
        );
        if (isStandalone) {
            setShowInstallModal(true);
            return;
        }

        const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null);
        if (promptEvent) {
            try {
                promptEvent.prompt();
                const { outcome } = await promptEvent.userChoice;
                if (outcome === 'accepted') {
                    (window as any).deferredPwaPrompt = null;
                    setDeferredPrompt(null);
                    return;
                }
            } catch (err) {
                console.error('[PortalHeader] Erro ao acionar prompt PWA:', err);
                setShowInstallModal(true);
                return;
            }
        }
        setShowInstallModal(true);
    };

    useEffect(() => {
        const updateContributor = () => {
            try {
                const raw = localStorage.getItem('iggestor_portal_contributor');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && (parsed.name || parsed.id)) {
                        setContributor(parsed);
                        return;
                    }
                }
            } catch (_) {}
            setContributor(null);
        };

        updateContributor();
        window.addEventListener('storage', updateContributor);
        window.addEventListener('contributor_updated', updateContributor);
        return () => {
            window.removeEventListener('storage', updateContributor);
            window.removeEventListener('contributor_updated', updateContributor);
        };
    }, []);

    const handleLogout = () => {
        try {
            localStorage.removeItem('iggestor_portal_contributor');
        } catch (_) {}
        setContributor(null);
        if (onNavigate) onNavigate('identify');
    };

    const logoSrc = church?.logoUrl ? church.logoUrl : "/logo.png?v=15";
    const brandName = church?.name ? church.name : "IgGestor";

    return (
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
                {/* Logo & Brand */}
                <button 
                    onClick={() => onNavigate?.('home')}
                    className="flex items-center gap-3 text-left group focus:outline-none cursor-pointer max-w-[220px] sm:max-w-none"
                    type="button"
                >
                    <img 
                        src={logoSrc} 
                        alt={`${brandName} Logo`} 
                        loading="eager"
                        decoding="async"
                        className="h-8 w-8 sm:h-9 sm:w-9 object-cover rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white shadow-2xs transition-transform group-hover:scale-105 shrink-0"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = "/logo.png?v=15";
                        }}
                    />
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-black tracking-tight text-slate-800 dark:text-white uppercase truncate max-w-[140px] sm:max-w-[280px]">
                            {brandName}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-bold tracking-widest text-brand-blue dark:text-blue-400 uppercase truncate">
                            Portal do Contribuinte
                        </span>
                    </div>
                </button>

                {/* Desktop Navigation Links */}
                <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                    <button
                        onClick={() => onNavigate?.('home')}
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-2xs cursor-pointer"
                    >
                        <HeartHandshake className="w-4 h-4 text-brand-orange" />
                        <span>Fazer Oferta</span>
                    </button>

                    <button
                        onClick={() => onNavigate?.('pledges')}
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-2xs cursor-pointer"
                    >
                        <BookmarkPlus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>Carnês & Propósitos</span>
                    </button>

                    <button
                        onClick={() => onNavigate?.('reports')}
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-2xs cursor-pointer"
                    >
                        <FileText className="w-4 h-4 text-brand-blue" />
                        <span>Minhas Contribuições</span>
                    </button>
                </nav>

                {/* Baixar App PWA & Profile / Church Status */}
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Baixar App Button */}
                    <button
                        type="button"
                        onClick={handleDownloadApp}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 transition-all cursor-pointer transform hover:scale-105"
                        title="Baixar aplicativo no celular"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Baixar App</span>
                    </button>

                    <div className="hidden sm:flex items-center">
                        {contributor ? (
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 py-1 px-2.5 rounded-full border border-slate-200/80 dark:border-slate-700">
                                <div className="w-6 h-6 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                    {(contributor.photo_url || contributor.avatarUrl || contributor.photo) ? (
                                        <img 
                                            src={contributor.photo_url || contributor.avatarUrl || contributor.photo} 
                                            alt={contributor.name || 'Contribuinte'} 
                                            className="w-full h-full object-cover" 
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        contributor.name ? contributor.name.charAt(0).toUpperCase() : 'C'
                                    )}
                                </div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
                                    {contributor.name.split(' ')[0]}
                                </span>
                                <button
                                    onClick={handleLogout}
                                    className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                                    title="Sair / Desconectar"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : church ? (
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px] lg:max-w-[180px]">
                                    {church.name}
                                </span>
                            </div>
                        ) : (
                            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 tracking-wider">
                                Acesso Público
                            </span>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="lg:hidden p-2 text-slate-600 dark:text-slate-300 rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer"
                    >
                        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation Drawer */}
            {mobileMenuOpen && (
                <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-2">
                    <button
                        onClick={() => { onNavigate?.('home'); setMobileMenuOpen(false); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        <HeartHandshake className="w-4 h-4 text-brand-orange" />
                        <span>Fazer Oferta / Contribuição</span>
                    </button>

                    <button
                        onClick={() => { onNavigate?.('pledges'); setMobileMenuOpen(false); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        <BookmarkPlus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>Carnês & Propósitos de Fé</span>
                    </button>

                    <button
                        onClick={() => { onNavigate?.('reports'); setMobileMenuOpen(false); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        <FileText className="w-4 h-4 text-brand-blue" />
                        <span>Minhas Contribuições (Relatório)</span>
                    </button>

                    <button
                        onClick={() => { handleDownloadApp(); setMobileMenuOpen(false); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-sm cursor-pointer"
                    >
                        <Smartphone className="w-4 h-4" />
                        <span>Baixar Aplicativo no Celular</span>
                    </button>

                    {contributor ? (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                    {(contributor.photo_url || contributor.avatarUrl || contributor.photo) ? (
                                        <img 
                                            src={contributor.photo_url || contributor.avatarUrl || contributor.photo} 
                                            alt={contributor.name || 'Contribuinte'} 
                                            className="w-full h-full object-cover" 
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        contributor.name ? contributor.name.charAt(0).toUpperCase() : 'C'
                                    )}
                                </div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {contributor.name}
                                </span>
                            </div>
                            <button
                                onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                                className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 rounded-lg"
                            >
                                Sair
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => { onNavigate?.('identify'); setMobileMenuOpen(false); }}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                            <UserCheck className="w-4 h-4 text-emerald-600" />
                            <span>Identificar Contribuinte</span>
                        </button>
                    )}
                </div>
            )}

            {/* PWA Install Modal */}
            {showInstallModal && (
                <PortalPwaInstallModal
                    church={church}
                    deferredPrompt={deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null)}
                    onClose={() => setShowInstallModal(false)}
                />
            )}
        </header>
    );
};

