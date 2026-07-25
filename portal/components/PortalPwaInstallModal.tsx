import React, { useState, useEffect } from 'react';
import { PortalChurch } from '../types/portal';
import { Smartphone, Download, Share2, PlusSquare, X, Check, ArrowRight, ShieldCheck } from 'lucide-react';

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

    useEffect(() => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        setIsIos(/iphone|ipad|ipod/.test(userAgent));
    }, []);

    const handleDirectInstall = async () => {
        if (!deferredPrompt) return;
        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setInstalled(true);
                setTimeout(() => onClose(), 2500);
            }
        } catch (err) {
            console.error('Erro ao instalar PWA:', err);
        }
    };

    const appName = church?.name || 'IgGestor';
    const appLogo = church?.logoUrl || '/pwa/icon-512.png';

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden my-auto animate-scale-in text-slate-800 dark:text-slate-100">
                {/* Background ambient glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    type="button"
                    className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* App Icon & Name Preview Header */}
                <div className="flex flex-col items-center text-center pt-2 pb-4">
                    <div className="relative mb-3 group">
                        <div className="w-20 h-20 rounded-2xl bg-white p-1.5 shadow-xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105">
                            <img
                                src={appLogo}
                                alt={appName}
                                className="w-full h-full object-cover rounded-xl"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/pwa/icon-512.png';
                                }}
                            />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                            <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                    </div>

                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                        {appName}
                    </h3>
                    <p className="text-xs font-bold text-brand-blue dark:text-blue-400 uppercase tracking-wider mt-0.5">
                        App do Portal do Contribuinte
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
                        Instale o atalho direto no seu celular para acessar rapidamente suas ofertas, carnês e comprovantes com um toque!
                    </p>
                </div>

                {/* Installed Success View */}
                {installed ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center my-4 space-y-2 animate-fade-in">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
                            <Check className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                            Aplicativo Adicionado!
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                            O ícone com a logo da {appName} já foi adicionado na tela inicial do seu dispositivo.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4 my-2">
                        {/* Direct One-Click Install Button (if browser supports beforeinstallprompt) */}
                        {deferredPrompt ? (
                            <button
                                type="button"
                                onClick={handleDirectInstall}
                                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/25 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                <Download className="w-4 h-4" />
                                <span>Instalar Aplicativo Agora</span>
                            </button>
                        ) : null}

                        {/* Step-by-Step Instruction Guide for Mobile / Safari / Chrome */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">
                                <Smartphone className="w-4 h-4 text-brand-orange" />
                                <span>Como baixar na tela do celular:</span>
                            </div>

                            {isIos ? (
                                <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-brand-orange/10 text-brand-orange font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                                        <span>
                                            No Safari, toque no ícone de <strong className="text-slate-800 dark:text-white inline-flex items-center gap-1">Compartilhar <Share2 className="w-3.5 h-3.5 text-blue-500" /></strong> no rodapé da tela.
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-brand-orange/10 text-brand-orange font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                                        <span>
                                            Role a lista e selecione <strong className="text-slate-800 dark:text-white inline-flex items-center gap-1">Adicionar à Tela de Início <PlusSquare className="w-3.5 h-3.5 text-emerald-500" /></strong>.
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-brand-orange/10 text-brand-orange font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                                        <span>
                                            Toque em <strong className="text-slate-800 dark:text-white">Adicionar</strong> no canto superior. Pronto!
                                        </span>
                                    </li>
                                </ol>
                            ) : (
                                <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-brand-blue/10 text-brand-blue font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                                        <span>
                                            Toque no menu do seu navegador <strong className="text-slate-800 dark:text-white">(três pontinhos no canto superior)</strong>.
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
                                            Confirme para criar o atalho com a logo oficial da congregação.
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
                        className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase tracking-wider"
                    >
                        Entendi / Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};
