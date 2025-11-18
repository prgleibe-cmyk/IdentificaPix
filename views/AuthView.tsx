import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LogoIcon, EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, GoogleIcon } from '../components/Icons';

export const AuthView: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    
    if (password.length < 6) {
        setError('A senha precisa ter no mínimo 6 caracteres.');
        setLoading(false);
        return;
    }

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email: email,
        password: password,
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Cadastro realizado! Verifique seu email para confirmação.');
      }
    }
    setLoading(false);
  };

  const inputClasses = "w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
  
  return (
    <div className="min-h-screen w-full flex relative bg-gradient-to-tr from-blue-500 to-blue-800 dark:from-blue-500 dark:to-blue-700 animate-gradient-xy bg-[400%_400%] overflow-hidden">
        
        {/* Elementos Decorativos de Fundo (Globais) */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full animate-pulse pointer-events-none"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-white/10 rounded-xl transform rotate-45 animate-pulse [animation-delay:3s] pointer-events-none"></div>
        <div className="absolute bottom-1/2 right-1/4 w-24 h-24 bg-white/5 rounded-full animate-pulse [animation-delay:5s] pointer-events-none"></div>

      {/* Lado Esquerdo - Decorativo (Texto e Logo) */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-8 z-10">
        <div className="text-center max-w-xl">
            <LogoIcon className="w-24 h-24 mx-auto text-white drop-shadow-2xl mb-6" />
            <h1 className="text-3xl font-bold text-white mb-3 tracking-tight drop-shadow-md">IdentificaPix</h1>
            <p className="text-lg text-blue-100 leading-relaxed opacity-90 mb-8">
              Simplifique a conciliação bancária da sua igreja com inteligência e rapidez.
            </p>

            {/* Spoiler / Lista de Recursos Minimalista em Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-left mx-auto max-w-md">
                {[
                    "Conciliação via IA",
                    "Leitura de Extratos",
                    "Relatórios em PDF/Excel",
                    "Gestão Multi-igrejas",
                    "Aprendizado Contínuo",
                    "Auditoria Simples"
                ].map((item, i) => (
                    <div 
                        key={i} 
                        className="flex items-center space-x-3 animate-fade-in group"
                        style={{ animationDelay: `${(i + 1) * 100}ms`, opacity: 0, animationFillMode: 'forwards' }}
                    >
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors flex items-center justify-center backdrop-blur-sm">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <span className="text-blue-50 font-medium text-sm tracking-wide truncate group-hover:text-white transition-colors">{item}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Lado Direito - Janela de Login (Card Flutuante) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8 z-10">
        <div className="w-full max-w-sm md:max-w-md space-y-6 animate-fade-in bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl shadow-2xl ring-1 ring-slate-900/5 backdrop-blur-sm">
          <div className="text-center lg:text-left">
             <div className="lg:hidden flex justify-center mb-3">
                <LogoIcon className="w-12 h-12 text-blue-600 dark:text-blue-400" />
             </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {isLogin ? 'Por favor, insira seus dados para entrar.' : 'Preencha os dados abaixo para começar.'}
            </p>
          </div>
          
          <div className="space-y-4">
             <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium disabled:opacity-50 bg-white dark:bg-slate-800"
            >
                <GoogleIcon className="w-4 h-4" />
                <span>Continuar com o Google</span>
            </button>

            <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                <span className="flex-shrink-0 mx-3 text-slate-400 text-xs">ou</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
                <div>
                <label className="block text-slate-700 dark:text-slate-300 text-xs font-medium mb-1.5" htmlFor="email">
                    Email
                </label>
                <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <EnvelopeIcon className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        className={`${inputClasses} pl-10`}
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="seu@email.com"
                    />
                </div>
                </div>
                <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-slate-700 dark:text-slate-300 text-xs font-medium" htmlFor="password">
                        Senha
                    </label>
                    {isLogin && (
                        <a href="#" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        Esqueceu?
                        </a>
                    )}
                </div>
                <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <LockClosedIcon className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        className={`${inputClasses} pl-10 pr-10`}
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                            {showPassword ? (
                                <EyeSlashIcon className="h-4 w-4" />
                            ) : (
                                <EyeIcon className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                </div>
                </div>
                
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 dark:bg-red-900/20 dark:text-red-300 p-3 rounded-md text-xs" role="alert">
                        <p>{error}</p>
                    </div>
                )}
                {message && (
                    <div className="bg-green-50 border-l-4 border-green-500 text-green-700 dark:bg-green-900/20 dark:text-green-300 p-3 rounded-md text-xs" role="alert">
                        <p>{message}</p>
                    </div>
                )}

                <button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900 disabled:bg-slate-400 dark:disabled:bg-slate-600 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center text-sm"
                    type="submit"
                    disabled={loading}
                >
                    {loading && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    )}
                    {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Criar conta')}
                </button>
            </form>

            <p className="text-center text-slate-600 dark:text-slate-400 text-xs">
                {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                <button
                className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 ml-1 focus:outline-none focus:underline"
                onClick={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                    setMessage(null);
                }}
                >
                {isLogin ? 'Cadastre-se' : 'Faça login'}
                </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};