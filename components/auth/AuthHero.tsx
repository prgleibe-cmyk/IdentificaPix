import React from 'react';
import { CheckBadgeIcon } from '../Icons';
import { ArrowDown, ShieldCheck } from 'lucide-react';
const logoImg = '/logo.png?v=15';

interface AuthHeroProps {
    onScrollToForm?: () => void;
}

export const AuthHero: React.FC<AuthHeroProps> = ({ onScrollToForm }) => {
    return (
        <div className="flex flex-col justify-center max-w-xl md:pl-4 lg:pl-12 space-y-6 md:space-y-8 lg:space-y-10 py-4 md:py-0">
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
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-200/50 backdrop-blur-sm border border-slate-300/40 rounded-xl w-fit">
                    <CheckBadgeIcon className="w-4 h-4 text-emerald-600" />
                    <span className="text-[10px] font-bold tracking-widest text-slate-700 uppercase">Tecnologia Certificada</span>
                </div>
                
                <h2 className="text-3xl sm:text-4xl md:text-3xl lg:text-5xl font-black text-slate-800 leading-[1.15] tracking-tight">
                    Finanças com <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-amber-600">Precisão</span>{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-700 to-emerald-600">Absoluta.</span>
                </h2>
                
                <div className="border-l-3 sm:border-l-4 border-brand-blue pl-4 sm:pl-6">
                    <p className="text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed font-medium">
                        Plataforma inteligente de conciliação bancária, controle de contribuições, despesas e relatórios em tempo real.
                    </p>
                </div>

                <div className="flex items-center gap-3 pt-1">
                    <div className="flex -space-x-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-white bg-gradient-to-br ${i === 1 ? 'from-pink-500 to-rose-500' : i === 2 ? 'from-brand-blue to-amber-500' : i === 3 ? 'from-amber-500 to-orange-500' : 'from-purple-500 to-slate-500'} shadow-md`}></div>
                        ))}
                    </div>
                    <div>
                        <p className="text-slate-800 font-bold text-xs sm:text-sm leading-none mb-0.5">Confiança Total</p>
                        <p className="text-emerald-600 text-[10px] sm:text-xs font-medium uppercase tracking-wide">Líderes de todo o Brasil</p>
                    </div>
                </div>

                {/* Mobile / Tablet Quick Scroll Button */}
                {onScrollToForm && (
                    <div className="block md:hidden pt-2">
                        <button
                            type="button"
                            onClick={onScrollToForm}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-brand-blue to-amber-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-brand-blue/20 active:scale-95 transition-all"
                        >
                            <span>Ir para o Login / Credenciais</span>
                            <ArrowDown className="w-4 h-4 animate-bounce" />
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
