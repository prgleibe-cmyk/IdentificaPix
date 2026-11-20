import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PortalChurch, ContributorMockProfile } from '../types/portal';
import { Smartphone, CheckCircle2, X, ArrowRight, Building2 } from 'lucide-react';
import { PortalPwaInstallModal } from './PortalPwaInstallModal';

interface PortalWelcomeRegisterModalProps {
    church?: PortalChurch | null;
    onClose: () => void;
}

export const PortalWelcomeRegisterModal: React.FC<PortalWelcomeRegisterModalProps> = ({
    church,
    onClose
}) => {
    const [contributor, setContributor] = useState<ContributorMockProfile | null>(null);
    const [showPwaModal, setShowPwaModal] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(() => (window as any).deferredPwaPrompt || null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('iggestor_portal_contributor');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.name || parsed.id)) {
                    setContributor(parsed);
                }
            }
        } catch (_) {}

        if ((window as any).deferredPwaPrompt) {
            setDeferredPrompt((window as any).deferredPwaPrompt);
        }
    }, []);

    const handleInstallAppClick = () => {
        const promptEvent = deferredPrompt || (window as any).deferredPwaPrompt;
        if (promptEvent) {
            try {
                promptEvent.prompt();
                promptEvent.userChoice.then((choiceResult: any) => {
                    if (choiceResult.outcome === 'accepted') {
                        (window as any).deferredPwaPrompt = null;
                        setDeferredPrompt(null);
                        onClose();
                    }
                });
            } catch (err) {
                console.error('Erro no prompt do app:', err);
                setShowPwaModal(true);
            }
        } else {
            setShowPwaModal(true);
        }
    };

    const churchName = church?.name || 'Igreja Local';
    const memberName = contributor?.name || contributor?.canonical_name || 'Irmão(ã)';
    const firstName = memberName.split(' ')[0];

    const modalContent = (
        <>
            <div
                onClick={onClose}
                className="fixed inset-0 z-[90] bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-elevated relative overflow-hidden my-auto animate-scale-in text-slate-800 dark:text-slate-100"
                >
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        type="button"
                        className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Fechar"
                        aria-label="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Church Icon & Badge Header */}
                    <div className="flex flex-col items-center text-center pt-2">
                        <div className="relative mb-3.5">
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 p-2 shadow-xs flex items-center justify-center">
                                {church?.logoUrl ? (
                                    <img
                                        src={church.logoUrl}
                                        alt={churchName}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-contain rounded-xl"
                                    />
                                ) : (
                                    <Building2 className="w-7 h-7 text-orange-600 dark:text-orange-400" />
                                )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1 rounded-full shadow-xs">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                        </div>

                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                            Cadastro Concluído com Sucesso
                        </p>

                        <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                            A Paz do Senhor, {firstName}!
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                            Seja bem-vindo(a) ao Portal Oficial da <span className="text-slate-800 dark:text-slate-200 font-semibold">{churchName}</span>
                        </p>
                    </div>

                    {/* Member Details Card */}
                    <div className="my-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold">Membro:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">{memberName}</span>
                        </div>
                        {contributor?.cpf && (
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 dark:text-slate-400 font-semibold">CPF:</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{contributor.cpf}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold">Congregação:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{churchName}</span>
                        </div>
                    </div>

                    {/* App Install Prompt Box */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-blue-50/50 dark:from-slate-800 dark:to-slate-800/40 border border-emerald-200/80 dark:border-slate-700 space-y-2 text-center mb-6">
                        <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                            <Smartphone className="w-4 h-4" />
                            <span>Tenha o Portal na Palma da Mão</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                            Adicione o aplicativo da igreja na tela inicial do seu celular para registrar ofertas e dízimos via Pix com apenas 1 toque!
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2.5">
                        <button
                            type="button"
                            onClick={handleInstallAppClick}
                            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                        >
                            <Smartphone className="w-4 h-4" />
                            <span>Baixar / Instalar App da Igreja</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        >
                            <span>Acessar Portal da Igreja</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {showPwaModal && (
                <PortalPwaInstallModal
                    church={church}
                    deferredPrompt={deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null)}
                    onClose={() => {
                        setShowPwaModal(false);
                        onClose();
                    }}
                />
            )}
        </>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }

    return modalContent;
};
