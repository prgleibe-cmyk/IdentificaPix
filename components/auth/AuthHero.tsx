import React from 'react';
import { CheckBadgeIcon } from '../Icons';
import { ArrowDown, ShieldCheck } from 'lucide-react';
const logoImg = '/logo.png?v=15';

interface AuthHeroProps {
    onScrollToForm?: () => void;
}

export const AuthHero: React.FC<AuthHeroProps> = ({ onScrollToForm }) => {
    return (
        <div className="flex flex-col justify-center w-full max-w-xl mx-auto md:mx-0 md:pl-4 lg:pl-12 space-y-6 md:space-y-8 lg:space-y-10 py-4 md:py-0">
            {/* Logo Section */}
            <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 perspective-[1000px]">
                <div className="relative group animate-pulse-soft flex-shrink-0">
                    <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-[40px] lg:blur-[60px] animate-pulse"></div>
                    <img 
                        src={logoImg} 
                        className="h-24 sm:h-32 md:h-36 lg:h-48 w-auto object-contain drop-shadow-[0_15px_35px_rgba(0,0,0,0.12)] transform md:rotate-y-12 md:rotate-x-6 group-hover:rotate-0 transition-all duration-700 ease-out" 
                        alt="Logo IgGestor" 
                    />
                </div>
                <div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-800 tracking-tighter leading-none mb-1 drop-shadow-sm">
                        IgGestor
                    </h1>
                    <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-brand-blue font-bold block ml-0.5">
                        Gestão Financeira para Igrejas
                    </span>
                </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-full w-fit">
                    <CheckBadgeIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] font-semibold tracking-wider text-emerald-800 dark:text-emerald-300 uppercase">Tecnologia Certificada</span>
                </div>
                
                <h2 className="text-3xl sm:text-4xl md:text-3xl lg:text-5xl font-black text-slate-800 leading-[1.15] tracking-tight">
                    Finanças com <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-amber-600">Precisão</span>{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-700 to-emerald-600">Absoluta.</span>
                </h2>
                
                <div className="border-l-[3px] sm:border-l-4 border-orange-600 pl-4 sm:pl-6">
                    <p className="text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed font-normal">
                        Plataforma inteligente de conciliação bancária, controle de contribuições, despesas e relatórios em tempo real.
                    </p>
                </div>

                {/* Selo de Confiança & Autoridade Contábil */}
                <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center text-amber-500 gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                            <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                        ))}
                    </div>
                    <div className="border-l border-slate-300 dark:border-slate-700 pl-3">
                        <p className="text-slate-900 dark:text-white font-semibold text-xs leading-none mb-0.5">Homologado e Seguro</p>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] font-normal">Utilizado por igrejas e tesoureiros em todo o Brasil</p>
                    </div>
                </div>

                {/* Mobile / Tablet Quick Scroll Button (Sutil e Neutro, sem competir com o botão de Entrar) */}
                {onScrollToForm && (
                    <div className="block md:hidden pt-1 w-full max-w-[420px] mx-auto">
                        <button
                            type="button"
                            onClick={onScrollToForm}
                            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-white hover:text-slate-900 transition-all shadow-xs"
                        >
                            <span>Preencher dados de acesso</span>
                            <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                    </div>
                )}
            </div>
            
            <div className="hidden md:block pt-4">
                <p className="text-slate-400 text-xs font-medium">© 2026 IgGestor. Segurança garantida.</p>
            </div>
        </div>
    );
};
