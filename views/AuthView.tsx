import React, { useState, useRef } from 'react';
import { GoogleIcon, DocumentTextIcon } from '../components/Icons';
import { AuthBackground } from '../components/auth/AuthBackground';
import { AuthHero } from '../components/auth/AuthHero';
import { AuthForm } from '../components/auth/AuthForm';
import { ContractTermsModal } from '../components/modals/ContractTermsModal';
import { useAuthController } from '../hooks/useAuthController';
import { ArrowDown } from 'lucide-react';

export const AuthView: React.FC = () => {
    const auth = useAuthController();
    const [isTermsOpen, setIsTermsOpen] = useState(false);
    const formContainerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleScrollToForm = () => {
        if (formContainerRef.current) {
            formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };
  
    return (
        <div className="h-[100dvh] w-full flex flex-col bg-gradient-to-b from-[#E6EFEA] via-[#D8E8DF] to-[#CADFD4] dark:from-[#0B1411] dark:to-[#050D0A] text-slate-800 dark:text-slate-200 relative overflow-hidden font-sans selection:bg-orange-500/30">
            <AuthBackground />

            {/* Scrollable Container with explicit touch support */}
            <div 
                ref={scrollContainerRef}
                id="auth-scroll-container"
                className="flex-1 w-full overflow-y-auto z-10 relative custom-scrollbar overscroll-y-contain"
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            >
                <div className="w-full max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 p-4 sm:p-6 md:p-8 lg:p-12 items-center gap-6 md:gap-8 lg:gap-12 min-h-full">
                    
                    {/* Left Column: Hero */}
                    <AuthHero onScrollToForm={handleScrollToForm} />

                    {/* Right Column: Credentials Form */}
                    <div 
                        ref={formContainerRef} 
                        id="credentials-form"
                        className="flex flex-col items-center md:items-end md:pr-4 lg:pr-12 pb-12 md:pb-0 scroll-mt-6"
                    >
                        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-[420px] p-6 sm:p-8 relative overflow-hidden border border-slate-100/50">
                            <div className="text-center mb-5 sm:mb-6">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-1 sm:mb-2 tracking-tight">
                                    {auth.isRecoveryMode ? 'Recuperar Senha' : (auth.isLogin ? 'Bem-vindo' : 'Criar Conta')}
                                </h2>
                                <p className="text-slate-500 text-xs sm:text-sm font-medium">
                                    {auth.isRecoveryMode ? 'Informe seu email para receber o link de recuperação.' : (auth.isLogin ? 'Faça login para continuar.' : 'Preencha os dados abaixo.')}
                                </p>
                            </div>

                            {!auth.isRecoveryMode && (
                                <>
                                    <button
                                        onClick={auth.handleGoogleLogin}
                                        type="button"
                                        disabled={auth.loading}
                                        className="w-full flex items-center justify-center gap-3 py-3 sm:py-3.5 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm mb-4 sm:mb-6 active:scale-[0.99] hover:shadow-md cursor-pointer"
                                    >
                                        <GoogleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                        <span>Entrar com Google</span>
                                    </button>

                                    <div className="relative flex py-1 sm:py-2 items-center mb-4 sm:mb-6">
                                        <div className="flex-grow border-t border-slate-100"></div>
                                        <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Ou Email</span>
                                        <div className="flex-grow border-t border-slate-100"></div>
                                    </div>
                                </>
                            )}

                            <AuthForm 
                                {...auth}
                                onSubmit={auth.handleAuth}
                                onToggleMode={auth.toggleMode}
                            />
                        </div>

                        {/* Link to Contract & Terms */}
                        <div className="mt-3 sm:mt-4 text-center w-full max-w-[420px]">
                            <button
                                type="button"
                                onClick={() => setIsTermsOpen(true)}
                                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors cursor-pointer"
                            >
                                <DocumentTextIcon className="w-3.5 h-3.5 text-brand-blue" />
                                <span>Termos de Licença e Uso do Sistema</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ContractTermsModal
                isOpen={isTermsOpen}
                onClose={() => setIsTermsOpen(false)}
            />
        </div>
    );
};
