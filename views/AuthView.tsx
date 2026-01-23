import React from 'react';
import { GoogleIcon } from '../components/Icons';
import { AuthBackground } from '../components/auth/AuthBackground';
import { AuthHero } from '../components/auth/AuthHero';
import { AuthForm } from '../components/auth/AuthForm';
import { useAuthController } from '../hooks/useAuthController';

export const AuthView: React.FC = () => {
    const auth = useAuthController();
  
    return (
        <div className="h-[100dvh] w-full flex flex-col bg-[#051024] relative overflow-hidden font-sans selection:bg-blue-500/30">
            <AuthBackground />

            <div className="flex-1 w-full overflow-y-auto z-10 relative custom-scrollbar">
                <div className="w-full max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 p-6 lg:p-12 items-center gap-12 lg:gap-0 min-h-full">
                    
                    <AuthHero />

                    <div className="flex justify-center lg:justify-end lg:pr-12 pb-8 lg:pb-0">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-[400px] p-8 relative overflow-hidden border border-slate-100/50">
                            
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">
                                    {auth.isLogin ? 'Bem-vindo' : 'Criar Conta'}
                                </h2>
                                <p className="text-slate-500 text-sm font-medium">
                                    {auth.isLogin ? 'Faça login para continuar.' : 'Preencha os dados abaixo.'}
                                </p>
                            </div>

                            <button
                                onClick={auth.handleGoogleLogin}
                                type="button"
                                disabled={auth.loading}
                                className="w-full flex items-center justify-center gap-3 py-3.5 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full font-bold text-xs uppercase tracking-wide transition-all shadow-sm mb-6 active:scale-[0.98]"
                            >
                                <GoogleIcon className="w-5 h-5" />
                                <span>Entrar com Google</span>
                            </button>

                            <div className="relative flex py-2 items-center mb-6">
                                <div className="flex-grow border-t border-slate-100"></div>
                                <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Ou Email</span>
                                <div className="flex-grow border-t border-slate-100"></div>
                            </div>

                            <AuthForm 
                                {...auth}
                                onSubmit={auth.handleAuth}
                                onToggleMode={auth.toggleMode}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};