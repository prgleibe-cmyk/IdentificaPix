import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LogoIcon } from '../components/Icons';

export const AuthView: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Cadastro realizado! Verifique seu e-mail para confirmar sua conta.');
      }
    } catch (error: any) {
      setError(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
            <LogoIcon className="w-12 h-12" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-4">IdentificaPix</h1>
        </div>
        
        <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg px-8 pt-6 pb-8 mb-4">
          <form onSubmit={handleAuth}>
            <div className="mb-4">
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2" htmlFor="email">
                Email
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2" htmlFor="password">
                Senha
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
                id="password"
                type="password"
                placeholder="******************"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            {error && <p className="bg-red-100 dark:bg-red-900/50 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded relative mb-4 text-sm">{error}</p>}
            {message && <p className="bg-green-100 dark:bg-green-900/50 border border-green-400 text-green-700 dark:text-green-300 px-4 py-3 rounded relative mb-4 text-sm">{message}</p>}

            <div className="flex items-center justify-between">
              <button
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-slate-400"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Carregando...' : (isLogin ? 'Entrar' : 'Cadastrar')}
              </button>
            </div>
          </form>
          <p className="text-center text-slate-500 dark:text-slate-400 text-xs mt-4">
            {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <button
              className="font-bold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 ml-2"
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
  );
};