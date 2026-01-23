import React from 'react';
import { UserIcon, EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, CheckBadgeIcon } from '../Icons';

interface AuthFormProps {
    isLogin: boolean;
    loading: boolean;
    error: string | null;
    message: string | null;
    name: string;
    setName: (v: string) => void;
    email: string;
    setEmail: (v: string) => void;
    password: string;
    setPassword: (v: string) => void;
    showPassword: boolean;
    setShowPassword: (v: boolean) => void;
    onSubmit: (e: React.FormEvent) => void;
    onToggleMode: () => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({
    isLogin, loading, error, message, name, setName, email, setEmail, password, setPassword,
    showPassword, setShowPassword, onSubmit, onToggleMode
}) => {
    const inputClass = "w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-full text-slate-800 font-bold outline-none transition-all text-sm";
    const labelClass = "block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1";

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            {!isLogin && (
                <div>
                    <label className={labelClass}>Nome Completo</label>
                    <div className="relative group">
                        <UserIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        <input type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
                    </div>
                </div>
            )}

            <div>
                <label className={labelClass}>Email</label>
                <div className="relative group">
                    <EnvelopeIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input type="email" placeholder="exemplo@igreja.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
                </div>
            </div>

            <div>
                <div className="flex justify-between items-center mb-1.5 ml-1">
                    <label className={labelClass}>Senha</label>
                    {isLogin && <button type="button" className="text-[10px] font-bold text-blue-600 hover:underline">Esqueceu?</button>}
                </div>
                <div className="relative group">
                    <LockClosedIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-1">
                        {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3 animate-fade-in">
                    <div className="text-red-500 mt-0.5"><LockClosedIcon className="w-3.5 h-3.5"/></div>
                    <p className="text-red-600 text-xs font-bold">{error}</p>
                </div>
            )}
            
            {message && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3 animate-fade-in">
                    <div className="text-emerald-500 mt-0.5"><CheckBadgeIcon className="w-3.5 h-3.5"/></div>
                    <p className="text-emerald-600 text-xs font-bold">{message}</p>
                </div>
            )}

            <button type="submit" disabled={loading} className="w-full py-4 text-white font-black uppercase tracking-wide rounded-full shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-70 mt-2 text-xs bg-gradient-to-l from-[#051024] to-[#0033AA]">
                {loading ? 'Processando...' : (isLogin ? 'Entrar na Plataforma' : 'Criar Conta Grátis')}
            </button>

            <div className="mt-6 text-center">
                <p className="text-xs font-bold text-slate-400">
                    {isLogin ? 'Novo por aqui?' : 'Já possui conta?'}
                    <button type="button" onClick={onToggleMode} className="text-slate-700 hover:text-blue-600 ml-1 transition-colors underline decoration-2 underline-offset-2">
                        {isLogin ? 'Criar conta' : 'Fazer Login'}
                    </button>
                </p>
            </div>
        </form>
    );
};