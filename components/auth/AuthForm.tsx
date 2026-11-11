import React from 'react';
import { UserIcon, EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, CheckBadgeIcon } from '../Icons';

interface AuthFormProps {
    isLogin: boolean;
    isRecoveryMode: boolean;
    setIsRecoveryMode: (v: boolean) => void;
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
    isLogin, isRecoveryMode, setIsRecoveryMode, loading, error, message, name, setName, email, setEmail, password, setPassword,
    showPassword, setShowPassword, onSubmit, onToggleMode
}) => {
    const inputClass = "w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-lg text-slate-900 dark:text-white font-medium outline-none transition-all text-xs placeholder:text-slate-400";
    const labelClass = "block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 ml-0.5";

    return (
        <form onSubmit={onSubmit} className="space-y-3.5">
            {!isLogin && !isRecoveryMode && (
                <div>
                    <label className={labelClass}>Nome Completo</label>
                    <div className="relative group">
                        <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-600 transition-colors" />
                        <input type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
                    </div>
                </div>
            )}

            <div>
                <label className={labelClass}>E-mail</label>
                <div className="relative group">
                    <EnvelopeIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-600 transition-colors" />
                    <input type="email" placeholder="exemplo@igreja.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
                </div>
            </div>

            {!isRecoveryMode && (
                <div>
                    <div className="flex justify-between items-center mb-1 ml-0.5">
                        <label className={labelClass}>Senha</label>
                        {isLogin && (
                            <button 
                                type="button" 
                                onClick={() => {
                                    setIsRecoveryMode(true);
                                }} 
                                className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                            >
                                Esqueceu a senha?
                            </button>
                        )}
                    </div>
                    <div className="relative group">
                        <LockClosedIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-600 transition-colors" />
                        <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-600 transition-colors p-1">
                            {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 animate-fade-in text-xs font-medium">
                    <div className="mt-0.5"><LockClosedIcon className="w-3.5 h-3.5 text-rose-600"/></div>
                    <p>{error}</p>
                </div>
            )}
            
            {message && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5 animate-fade-in text-xs font-medium">
                    <div className="mt-0.5"><CheckBadgeIcon className="w-3.5 h-3.5 text-emerald-600"/></div>
                    <p>{message}</p>
                </div>
            )}

            <button type="submit" disabled={loading} className="w-full py-2.5 text-white font-semibold uppercase tracking-wider rounded-lg shadow-sm hover:bg-orange-700 active:scale-[0.99] transition-all disabled:opacity-60 mt-2 text-xs bg-orange-600 cursor-pointer">
                {loading ? 'Processando...' : (isRecoveryMode ? 'Recuperar Senha' : (isLogin ? 'Entrar na Plataforma' : 'Criar Conta Grátis'))}
            </button>

            <div className="mt-6 text-center space-y-2">
                {isRecoveryMode ? (
                    <button type="button" onClick={() => setIsRecoveryMode(false)} className="text-xs font-bold text-slate-500 hover:text-brand-blue transition-colors underline decoration-2 underline-offset-2">
                        Voltar para o Login
                    </button>
                ) : (
                    <>
                        <p className="text-xs font-bold text-slate-400">
                            {isLogin ? 'Novo por aqui?' : 'Já possui conta?'}
                            <button type="button" onClick={onToggleMode} className="text-slate-700 hover:text-brand-blue ml-1 transition-colors underline decoration-2 underline-offset-2">
                                {isLogin ? 'Criar conta' : 'Fazer Login'}
                            </button>
                        </p>
                    </>
                )}
            </div>
        </form>
    );
};