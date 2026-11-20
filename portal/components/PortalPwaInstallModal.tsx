import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PortalChurch } from '../types/portal';
import { Smartphone, Download, Share2, PlusSquare, X, Check, ShieldCheck, ExternalLink, Sparkles } from 'lucide-react';

interface PortalPwaInstallModalProps {
    church?: PortalChurch | null;
    deferredPrompt: any;
    onClose: () => void;
}

export const PortalPwaInstallModal: React.FC<PortalPwaInstallModalProps> = ({
    church,
    deferredPrompt,
    onClose
}) => {
    const [installed, setInstalled] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [isInIframe, setIsInIframe] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [activePrompt, setActivePrompt] = useState<any>(
        deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null)
    );

    useEffect(() => {
        const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : '';
        setIsIos(/iphone|ipad|ipod/.test(userAgent));
        try {
            setIsInIframe(window.self !== window.top);
            setIsStandalone(
                window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as any).standalone === true
            );
        } catch (_) {}

        // Listen for beforeinstallprompt in case it fires while modal is mounted
        const handlePrompt = (e: Event) => {
            e.preventDefault();
            (window as any).deferredPwaPrompt = e;
            setActivePrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handlePrompt);
        return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
    }, []);

    // Sincroniza se deferredPrompt mudar por props
    useEffect(() => {
        if (deferredPrompt) {
            setActivePrompt(deferredPrompt);
        } else if ((window as any).deferredPwaPrompt) {
            setActivePrompt((window as any).deferredPwaPrompt);
        }
    }, [deferredPrompt]);

    const handleDirectInstall = async () => {
        const promptToUse = activePrompt || (window as any).deferredPwaPrompt;
        if (!promptToUse) return;
        try {
            promptToUse.prompt();
            const { outcome } = await promptToUse.userChoice;
            if (outcome === 'accepted') {
                (window as any).deferredPwaPrompt = null;
                setActivePrompt(null);
                setInstalled(true);
                setTimeout(() => onClose(), 2500);
            }
        } catch (err) {
            console.error('[PWA Modal] Erro ao disparar prompt nativo:', err);
        }
    };

    const handleOpenInBrowser = () => {
        const churchId = church?.id;
        const targetUrl = churchId 
            ? `${window.location.origin}/portal?church=${encodeURIComponent(churchId)}`
            : `${window.location.origin}/portal`;
        window.open(targetUrl, '_blank');
    };

    const appName = church?.name || 'Portal do Contribuinte';
    const appLogo = (church?.logoUrl && church.logoUrl.trim()) ? church.logoUrl.trim() : '/pwa/icon-512.png?v=15';

    const modalContent = (
        <div
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-elevated relative overflow-hidden my-auto animate-scale-in text-slate-800 dark:text-slate-100"
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    type="button"
                    className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    aria-label="Fechar"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* App Icon & Name Preview Header */}
                <div className="flex flex-col items-center text-center pt-2 pb-4">
                    <div className="relative mb-3">
                        <div className="w-20 h-20 rounded-2xl bg-white p-2.5 shadow-sm border border-slate-200/90 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                            <img
                                src={appLogo}
                                alt={appName}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain p-0.5 rounded-xl"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/pwa/icon-512.png?v=15';
                                }}
                            />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1 rounded-full shadow-xs">
                            <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                        {appName}
                    </h3>
                    <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mt-0.5">
                        App Oficial do Portal do Contribuinte
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                        Instale o aplicativo da congregação no seu celular para acessar rapidamente suas ofertas, carnês e comprovantes com um toque!
                    </p>
                </div>

                {/* Installed Success View or Already Standalone */}
                {installed || isStandalone ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center my-4 space-y-2 animate-fade-in">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
                            <Check className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                            {isStandalone ? 'Aplicativo em Execução!' : 'Aplicativo Adicionado!'}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                            {isStandalone 
                                ? `Você já está usando o app da ${appName} em modo aplicativo no seu dispositivo.` 
                                : `O ícone com a logo da ${appName} foi adicionado à tela inicial do seu celular.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4 my-2">
                        {/* Direct One-Click Install Button (when prompt is captured) */}
                        {activePrompt ? (
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={handleDirectInstall}
                                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Instalar Aplicativo Agora</span>
                                </button>
                                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                                    Toque acima e confirme na janela do navegador para adicionar à tela inicial.
                                </p>
                            </div>
                        ) : null}

                        {/* If in iframe preview, provide 1-click button to open in top-level browser where PWA install is 100% unlocked */}
                        {isInIframe && !activePrompt && (
                            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 text-slate-800 dark:text-slate-200 text-xs space-y-2.5">
                                <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
                                    <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
                                    <span>Baixar App no Navegador</span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                    Como você está visualizando dentro do painel ou janela incorporada, toque no botão abaixo para abrir diretamente no navegador e instalar com 1 toque:
                                </p>
                                <button
                                    type="button"
                                    onClick={handleOpenInBrowser}
                                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 transition-all uppercase tracking-wider"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    <span>Abrir no Navegador e Baixar</span>
                                </button>
                            </div>
                        )}

                        {/* Step-by-Step Instruction Guide for Mobile / Safari / Chrome */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">
                                <Smartphone className="w-4 h-4 text-brand-orange" />
                                <span>Como instalar no celular manualmente:</span>
                            </div>

                            {isIos ? (
                                <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-brand-orange/10 text-brand-orange font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                                        <span>
                                            No Safari, toque no ícone de <strong className="text-slate-800 dark:text-white inline-flex items-center gap-1">Compartilhar <Share2 className="w-3.5 h-3.5 text-blue-500" /></strong> na barra do navegador.
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-brand-orange/10 text-brand-orange font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                                        <span>
                                            Role as opções e toque em <strong className="text-slate-800 dark:text-white inline-flex items-center gap-1">Adicionar à Tela de Início <PlusSquare className="w-3.5 h-3.5 text-emerald-500" /></strong>.
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-brand-orange/10 text-brand-orange font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                                        <span>
                                            Toque em <strong className="text-slate-800 dark:text-white">Adicionar</strong>. O app com a logo oficial da igreja aparecerá na sua tela inicial!
                                        </span>
                                    </li>
                                </ol>
                            ) : (
                                <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-brand-blue/10 text-brand-blue font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                                        <span>
                                            Toque no menu do navegador <strong className="text-slate-800 dark:text-white">(três pontinhos no canto superior)</strong>.
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-brand-blue/10 text-brand-blue font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                                        <span>
                                            Selecione <strong className="text-slate-800 dark:text-white inline-flex items-center gap-1">Instalar aplicativo <Download className="w-3.5 h-3.5 text-emerald-500" /></strong> ou <strong>Adicionar à Tela inicial</strong>.
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-brand-blue/10 text-brand-blue font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                                        <span>
                                            Confirme a instalação para adicionar o app com a logo da {appName}.
                                        </span>
                                    </li>
                                </ol>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                        Entendi / Fechar
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }

    return modalContent;
};
