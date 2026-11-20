import React, { useEffect, useState } from 'react';
import { PortalChurch, ContributorMockProfile } from '../types/portal';
import { HeartHandshake, FileText, UserCheck, Menu, X, LogOut, BookmarkPlus, Smartphone, Download } from 'lucide-react';
import { PortalPwaInstallModal } from './PortalPwaInstallModal';

interface PortalHeaderProps {
    church?: PortalChurch | null;
    currentRoute?: string;
    onNavigate?: (route: string) => void;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({ church, currentRoute = 'home', onNavigate }) => {
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

    const isOfferActive = currentRoute === 'home' || currentRoute === 'church' || currentRoute === 'identify' || currentRoute === 'register';
    const isPledgesActive = currentRoute === 'pledges';
    const isReportsActive = currentRoute === 'reports';

    return (
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-15 flex items-center justify-between gap-4">
                {/* Logo & Brand */}
                <button 
                    onClick={() => onNavigate?.('home')}
                    className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer max-w-[220px] sm:max-w-none shrink-0"
                    type="button"
                >
                    <img 
                        src={logoSrc} 
                        alt={`${brandName} Logo`} 
                        loading="eager" 
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="h-8 w-8 object-contain p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white shadow-2xs shrink-0"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = "/logo.png?v=15";
                        }}
                    />
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate max-w-[140px] sm:max-w-[240px]">
                            {brandName}
                        </span>
                        <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400 truncate leading-tight">
                            Portal do Contribuinte
                        </span>
                    </div>
                </button>

                {/* Desktop Navigation Links — Standard #8 Segmented Capsule */}
                <nav className="hidden lg:flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                    <button
                        type="button"
                        onClick={() => onNavigate?.('home')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            isOfferActive
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
                        <span>Fazer Oferta</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onNavigate?.('pledges')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            isPledgesActive
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <BookmarkPlus className="w-3.5 h-3.5 shrink-0" />
                        <span>Carnês &amp; Propósitos</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onNavigate?.('reports')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            isReportsActive
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span>Minhas Contribuições</span>
                    </button>
                </nav>

                {/* Baixar App PWA & Profile */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Baixar App Button */}
                    <button
                        type="button"
                        onClick={handleDownloadApp}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs whitespace-nowrap transition-colors cursor-pointer"
                        title="Baixar aplicativo no celular"
                    >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">Baixar App</span>
                    </button>

                    {contributor && (
                        <div className="hidden sm:flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800 py-1 px-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
                            <div className="w-6 h-6 rounded-md bg-orange-600 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
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
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
                                {contributor.name.split(' ')[0]}
                            </span>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="text-slate-400 hover:text-rose-500 p-0.5 transition-colors cursor-pointer"
                                title="Sair / Desconectar"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Mobile Menu Toggle */}
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="lg:hidden p-2 text-slate-600 dark:text-slate-300 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        aria-label="Abrir menu"
                    >
                        {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation Drawer */}
            {mobileMenuOpen && (
                <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-1.5">
                    <button
                        type="button"
                        onClick={() => { onNavigate?.('home'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isOfferActive
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        <HeartHandshake className="w-4 h-4 shrink-0" />
                        <span>Fazer Oferta / Contribuição</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { onNavigate?.('pledges'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isPledgesActive
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        <BookmarkPlus className="w-4 h-4 shrink-0" />
                        <span>Carnês &amp; Propósitos de Fé</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { onNavigate?.('reports'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isReportsActive
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        <FileText className="w-4 h-4 shrink-0" />
                        <span>Minhas Contribuições (Relatório)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { handleDownloadApp(); setMobileMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
                    >
                        <Smartphone className="w-4 h-4 shrink-0" />
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

