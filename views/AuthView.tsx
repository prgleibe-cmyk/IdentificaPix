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

  const inputClasses = "w-full px-4 py-3 text-base text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
  
  return (
    <div className="min-h-screen flex">
      {/* Painel decorativo esquerdo */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/3 items-center justify-center bg-gradient-to-tr from-indigo-900 to-slate-950 animate-gradient-xy bg-[400%_400%] relative overflow-hidden">
        <div className="text-white text-center p-12 z-10">
          <LogoIcon className="w-24 h-24 mx-auto text-white drop-shadow-lg" />
          <h1 className="text-5xl font-bold mt-6 tracking-tight drop-shadow-lg">Bem-vindo ao IdentificaPix</h1>
          <p className="mt-4 text-xl opacity-90 drop-shadow-md">Identificação automática para seus recebimentos PIX.</p>
        </div>
        {/* Formas decorativas */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-white/10 rounded-xl transform rotate-45 animate-pulse [animation-delay:3s]"></div>
        <div className="absolute bottom-1/2 right-1/4 w-24 h-24 bg-white/5 rounded-full animate-pulse [animation-delay:5s]"></div>
      </div>

      {/* Painel direito com formulário de login */}
      <div className="w-full lg:w-1/2 xl:w-1/3 flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 sm:p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8 lg:hidden">
            <LogoIcon className="w-12 h-12 mx-auto" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-4">IdentificaPix</h1>
          </div>
          
          <div className="bg-white dark:bg-slate-800 shadow-2xl rounded-2xl p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-slate-200 mb-6">{isLogin ? 'Acessar sua conta' : 'Criar nova conta'}</h2>
            
            <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors font-medium disabled:opacity-50"
            >
                <GoogleIcon />
                Continuar com o Google
            </button>

            <div className="my-6 flex items-center">
                <div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-sm">ou</span>
                <div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div>
            </div>

            <form onSubmit={handleAuth} className="space-y-6">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-2" htmlFor="email">
                  Email
                </label>
                <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <EnvelopeIcon className="h-5 w-5 text-slate-400" />
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
                <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-2" htmlFor="password">
                  Senha
                </label>
                <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <LockClosedIcon className="h-5 w-5 text-slate-400" />
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
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                            {showPassword ? (
                                <EyeSlashIcon className="h-5 w-5" />
                            ) : (
                                <EyeIcon className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                </div>
                {isLogin && (
                    <div className="text-right mt-2">
                        <a href="#" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        Esqueceu sua senha?
                        </a>
                    </div>
                )}
              </div>
              
              {error && (
                  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300 p-4 rounded-md" role="alert">
                      <p>{error}</p>
                  </div>
              )}
              {message && (
                  <div className="bg-green-100 border-l-4 border-green-500 text-green-700 dark:bg-green-900/30 dark:border-green-500/50 dark:text-green-300 p-4 rounded-md" role="alert">
                      <p>{message}</p>
                  </div>
              )}

              <div>
                <button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-800 disabled:bg-slate-400 dark:disabled:bg-slate-600 transition-colors duration-300 flex items-center justify-center"
                  type="submit"
                  disabled={loading}
                >
                  {loading && (
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                  )}
                  {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Cadastrar')}
                </button>
              </div>
            </form>

            <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-8">
              {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
              <button
                className="font-medium text-blue-600 dark:text-blue-400 hover:underline ml-1"
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