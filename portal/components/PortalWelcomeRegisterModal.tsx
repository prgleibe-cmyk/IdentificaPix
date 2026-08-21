import React, { useState, useEffect } from 'react';
import { PortalChurch, ContributorMockProfile } from '../types/portal';
import { Smartphone, CheckCircle2, Sparkles, X, ArrowRight, Building2, ShieldCheck, Heart } from 'lucide-react';
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

    return (
        <>
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[2.5rem] max-w-md w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden my-auto animate-scale-in text-slate-800 dark:text-slate-100">
                    
                    {/* Ambient celebratory lights */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />

                    {/* Close button */}
                    <button
                        onClick={onClose}
                        type="button"
                        className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Church Icon & Badge Header */}
                    <div className="flex flex-col items-center text-center pt-2">
                        <div className="relative mb-4">
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-1 shadow-xl shadow-emerald-500/25 flex items-center justify-center">
                                {church?.logoUrl ? (
                                    <img
                                        src={church.logoUrl}
                                        alt={churchName}
                                        className="w-full h-full object-cover rounded-[1.3rem] bg-white"
                                    />
                                ) : (
                                    <div className="w-full h-full rounded-[1.3rem] bg-white dark:bg-slate-800 flex items-center justify-center text-emerald-600">
                                        <Building2 className="w-9 h-9" />
                                    </div>
                                )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full shadow-md">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 mb-2 border border-emerald-200 dark:border-emerald-800">
                            <Sparkles className="w-3 h-3 text-emerald-500" />
                            Cadastro Concluído com Sucesso
                        </span>

                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            A Paz do Senhor, {firstName}! 🙏
                        </h3>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                            Seja bem-vindo(a) ao Portal Oficial da <span className="text-slate-800 dark:text-slate-200 font-black">{churchName}</span>
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
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={handleInstallAppClick}
                            className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-600/25 cursor-pointer uppercase tracking-wider"
                        >
                            <Smartphone className="w-4 h-4" />
                            <span>Baixar / Instalar App da Igreja</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
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
                    deferredPrompt={deferredPrompt}
                    onClose={() => {
                        setShowPwaModal(false);
                        onClose();
                    }}
                />
            )}
        </>
    );
};
