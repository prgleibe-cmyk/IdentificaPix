import React from 'react';
import { LogoIcon, CheckBadgeIcon } from '../Icons';

export const AuthHero: React.FC = () => {
    return (
        <div className="flex flex-col justify-center max-w-xl lg:pl-12 space-y-12 py-8 lg:py-0">
            {/* Logo Section */}
            <div className="flex items-center gap-8 perspective-[1000px]">
                <div className="relative group animate-pulse-soft">
                    <div className="absolute inset-0 bg-cyan-500/30 rounded-full blur-[60px] animate-pulse"></div>
                    <div className="relative w-32 h-32 bg-gradient-to-br from-white/10 via-white/5 to-transparent rounded-[2rem] border border-white/20 backdrop-blur-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] flex items-center justify-center transform rotate-y-12 rotate-x-12 group-hover:rotate-0 transition-transform duration-700">
                        <LogoIcon className="w-20 h-20 text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]" />
                        <div className="absolute top-0 left-0 w-full h-full rounded-[2rem] bg-gradient-to-br from-white/30 to-transparent opacity-50 pointer-events-none"></div>
                    </div>
                </div>
                <div>
                    <h1 className="text-5xl font-black text-white tracking-tighter leading-none mb-1 drop-shadow-xl">IdentificaPix</h1>
                    <span className="text-sm uppercase tracking-[0.4em] text-cyan-400 font-bold block ml-1">Enterprise System</span>
                </div>
            </div>

            <div className="space-y-8">
                <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full w-fit">
                    <CheckBadgeIcon className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-bold tracking-widest text-white uppercase">Tecnologia Certificada</span>
                </div>
                
                <h2 className="text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight">
                    Finanças com <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Precisão</span><br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Absoluta.</span>
                </h2>
                
                <div className="border-l-4 border-blue-500 pl-6">
                    <p className="text-lg text-slate-400 leading-relaxed">
                        Tecnologia de ponta para gestão de dízimos e ofertas. Conciliação bancária automatizada para igrejas modernas.
                    </p>
                </div>

                <div className="flex items-center gap-4 pt-2">
                    <div className="flex -space-x-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`w-10 h-10 rounded-full border-2 border-[#051024] bg-gradient-to-br ${i === 1 ? 'from-pink-500 to-rose-500' : i === 2 ? 'from-blue-500 to-cyan-500' : i === 3 ? 'from-amber-500 to-orange-500' : 'from-purple-500 to-indigo-500'} shadow-lg`}></div>
                        ))}
                    </div>
                    <div>
                        <p className="text-white font-bold text-base leading-none mb-1">Confiança Total</p>
                        <p className="text-emerald-400 text-xs font-medium uppercase tracking-wide">Líderes de todo o Brasil</p>
                    </div>
                </div>
            </div>
            
            <div className="hidden lg:block pt-8">
                <p className="text-slate-600 text-xs font-medium">© 2025 IdentificaPix Enterprise. Segurança garantida.</p>
            </div>
        </div>
    );
};