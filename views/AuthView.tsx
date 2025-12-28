
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LogoIcon, EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, UserIcon, CheckBadgeIcon, GoogleIcon } from '../components/Icons';

export const AuthView: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
                redirectTo: window.location.origin
            },
        });
        if (error) throw error;
    } catch (error: any) {
        console.error("Google login error:", error);
        if (error.message === 'Failed to fetch') {
            setError('O servidor está acordando. Aguarde alguns segundos e tente novamente.');
        } else {
            setError(error.message || 'Erro ao conectar com Google. Verifique se o provedor está habilitado no Supabase.');
        }
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

    // Lógica de Retry: Tenta 3 vezes antes de desistir
    let attempts = 0;
    const maxAttempts = 3;
    let success = false;

    while (attempts < maxAttempts && !success) {
        attempts++;
        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });
                
                if (error) throw error;
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: name,
                        }
                    }
                });

                if (error) throw error;
                setMessage('Cadastro realizado! Verifique seu email para confirmação.');
            }
            success = true; // Sai do loop se der certo
        } catch (error: any) {
            console.error(`Auth attempt ${attempts} failed:`, error);
            
            // Se for a última tentativa, exibe o erro
            if (attempts === maxAttempts) {
                // Tratamento específico para "Failed to fetch" que é comum em problemas de CORS/Rede/Cold Start
                if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
                    setError('O servidor está demorando para responder (Cold Start). Aguarde 10 segundos e tente novamente.');
                } else if (error.message.includes('Invalid login credentials')) {
                    setError('Email ou senha incorretos.');
                } else {
                    setError(error.message || 'Ocorreu um erro inesperado. Tente novamente.');
                }
            } else {
                // Se não for a última, espera 2s e tenta de novo (Backoff simples)
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    
    setLoading(false);
  };
  
  return (
    // FIX: Alterado de min-h-screen para h-[100dvh] com overflow-hidden no pai
    // Isso garante que o layout respeite as bordas do dispositivo sem criar scroll duplo no body
    <div className="h-[100dvh] w-full flex flex-col bg-[#051024] relative overflow-hidden font-sans selection:bg-blue-500/30">
      
      {/* Background Elements (Fixed Position) */}
      <div className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none mix-blend-overlay" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>

      <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Scrollable Content Container */}
      {/* FIX: Adicionado overflow-y-auto aqui para permitir scroll interno do conteúdo quando necessário */}
      <div className="flex-1 w-full overflow-y-auto z-10 relative custom-scrollbar">
          <div className="w-full max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 p-6 lg:p-12 items-center gap-12 lg:gap-0 min-h-full">
            
            {/* LEFT SIDE: Brand & Copy */}
            <div className="flex flex-col justify-center max-w-xl lg:pl-12 space-y-12 py-8 lg:py-0">
                
                {/* LOGO HEADER */}
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/5 rounded-2xl backdrop-blur-md border border-white/10 shadow-xl">
                        <LogoIcon className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight leading-none">IdentificaPix</h1>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold block mt-0.5">Enterprise System</span>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Enterprise Badge */}
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full w-fit">
                        <CheckBadgeIcon className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-bold tracking-widest text-white uppercase">Tecnologia Certificada</span>
                    </div>
                    
                    {/* Headline */}
                    <h2 className="text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight">
                        Finanças com <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                            Precisão
                        </span><br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                            Absoluta.
                        </span>
                    </h2>
                    
                    {/* Subtitle */}
                    <div className="border-l-4 border-blue-500 pl-6">
                        <p className="text-lg text-slate-400 leading-relaxed">
                            Tecnologia de ponta para gestão de dízimos e ofertas. Conciliação bancária automatizada para igrejas modernas.
                        </p>
                    </div>

                    {/* Social Proof */}
                    <div className="flex items-center gap-4 pt-2">
                        <div className="flex -space-x-4">
                            {[1,2,3,4].map(i => (
                                <div key={i} className="w-10 h-10 rounded-full border-2 border-[#051024] bg-slate-700 overflow-hidden relative shadow-lg">
                                    {/* Placeholder avatars */}
                                    <div className={`w-full h-full bg-gradient-to-br ${i===1?'from-pink-500 to-rose-500': i===2?'from-blue-500 to-cyan-500': i===3?'from-amber-500 to-orange-500':'from-purple-500 to-indigo-500'}`}></div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <p className="text-white font-bold text-base leading-none mb-1">Confiança Total</p>
                            <p className="text-emerald-400 text-xs font-medium uppercase tracking-wide">Líderes de todo o Brasil</p>
                        </div>
                    </div>
                </div>
                
                {/* Footer Copy */}
                <div className="hidden lg:block pt-8">
                    <p className="text-slate-600 text-xs font-medium">© 2025 IdentificaPix Enterprise. Segurança garantida.</p>
                </div>
            </div>

            {/* RIGHT SIDE: Login Card */}
            <div className="flex justify-center lg:justify-end lg:pr-12 pb-8 lg:pb-0">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-[400px] p-8 relative overflow-hidden border border-slate-100/50">
                    
                    {/* Card Header */}
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">
                            {isLogin ? 'Bem-vindo' : 'Criar Conta'}
                        </h2>
                        <p className="text-slate-500 text-sm font-medium">
                            {isLogin ? 'Faça login para continuar.' : 'Preencha os dados abaixo.'}
                        </p>
                    </div>

                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleLogin}
                        type="button"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 py-3.5 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full font-bold text-xs uppercase tracking-wide transition-all shadow-sm hover:shadow-md mb-6 active:scale-[0.98]"
                    >
                        <GoogleIcon className="w-5 h-5" />
                        <span>Entrar com Google</span>
                    </button>

                    <div className="relative flex py-2 items-center mb-6">
                        <div className="flex-grow border-t border-slate-100"></div>
                        <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Ou Email</span>
                        <div className="flex-grow border-t border-slate-100"></div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleAuth} className="space-y-4">
                        {!isLogin && (
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Nome Completo</label>
                                <div className="relative group">
                                    <UserIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                    <input
                                        type="text"
                                        name="name"
                                        autoComplete="name"
                                        placeholder="Seu nome"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-full text-slate-800 font-bold outline-none transition-all placeholder:font-medium placeholder:text-slate-400 text-sm"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Email</label>
                            <div className="relative group">
                                <EnvelopeIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                <input
                                    type="email"
                                    name="email"
                                    autoComplete="email"
                                    placeholder="exemplo@igreja.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-full text-slate-800 font-bold outline-none transition-all placeholder:font-medium placeholder:text-slate-400 text-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1.5 ml-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Senha</label>
                                {isLogin && <button type="button" className="text-[10px] font-bold text-blue-600 hover:underline">Esqueceu?</button>}
                            </div>
                            <div className="relative group">
                                <LockClosedIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-full text-slate-800 font-bold outline-none transition-all placeholder:font-bold placeholder:text-slate-300 text-sm"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-1"
                                >
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

                        {/* Submit Button - ROUNDED FULL */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 text-white font-black uppercase tracking-wide rounded-full shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2 text-xs bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288]"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    {isLogin ? 'Conectando...' : 'Criando...'}
                                </span>
                            ) : (isLogin ? 'Entrar na Plataforma' : 'Criar Conta Grátis')}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-xs font-bold text-slate-400">
                            {isLogin ? 'Novo por aqui?' : 'Já possui conta?'}
                            <button
                                onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
                                className="text-slate-700 hover:text-blue-600 ml-1 transition-colors underline decoration-2 underline-offset-2"
                            >
                                {isLogin ? 'Criar conta' : 'Fazer Login'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};
