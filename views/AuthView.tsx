
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LogoIcon, EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, GoogleIcon, UserIcon } from '../components/Icons';

// Modern Input Component - Compact Version
const ModernInput = ({ 
  id, 
  type, 
  value, 
  onChange, 
  placeholder, 
  icon: Icon, 
  rightElement 
}: any) => (
  <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200 group-focus-within:text-indigo-500 text-slate-400">
          <Icon className="h-5 w-5" />
      </div>
      <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          required
          className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-300 shadow-sm text-sm"
          placeholder={placeholder}
      />
      {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {rightElement}
          </div>
      )}
  </div>
);

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
      
      if (error) {
        setError(error.message);
      }
      // Note: Profile auto-creation is now handled in AuthContext's calculateSubscription
      // to ensure it happens on any login (including persistent sessions).
    } else {
      // Sign Up Flow
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: name,
            }
        }
      });

      if (error) {
        setError(error.message);
      } else {
        // Immediate profile creation for new sign-ups is still good practice
        // to avoid waiting for the session listener
        if (data.user) {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 10);

            await supabase.from('profiles').upsert({
                id: data.user.id,
                email: email,
                name: name,
                subscription_status: 'trial',
                trial_ends_at: trialEnd.toISOString(),
                created_at: new Date().toISOString(),
                is_blocked: false,
                is_lifetime: false,
                usage_ai: 0,
                limit_ai: 100
            });
        }
        setMessage('Cadastro realizado! Verifique seu email para confirmação.');
      }
    }
    setLoading(false);
  };
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* --- Premium Background Elements (Lighter Tonality) --- */}
      
      {/* 1. Vibrant Base Gradient (Lighter Blue/Indigo) */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600"></div>
      
      {/* 2. Geometric Grid Overlay (Subtle) */}
      <div className="absolute inset-0 opacity-[0.1]" 
           style={{ 
               backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px)`, 
               backgroundSize: '50px 50px' 
           }}>
      </div>

      {/* 3. Animated Glowing Orbs (Dispersed Elements) */}
      <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-cyan-400/20 blur-[100px] animate-pulse-slow mix-blend-overlay"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-400/20 blur-[100px] animate-pulse-slow mix-blend-overlay" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-[30%] right-[20%] w-[20vw] h-[20vw] rounded-full bg-white/10 blur-[60px] animate-pulse-slow mix-blend-overlay" style={{ animationDelay: '4s' }}></div>

      {/* 4. Noise Texture for Finish */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>


      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 p-4 relative z-10 items-center">
        
        {/* Left Side - Branding */}
        <div className="hidden lg:flex flex-col justify-center text-white space-y-6 pr-8">
            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full w-fit border border-white/20 shadow-2xl ring-1 ring-white/10">
                <LogoIcon className="w-5 h-5 text-white" />
                <span className="font-semibold tracking-wide text-xs text-white">IdentificaPix v2.0</span>
            </div>
            
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight tracking-tight drop-shadow-sm">
                Conciliação <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-white">Inteligente</span>.
            </h1>
            
            <p className="text-base lg:text-lg text-indigo-100 leading-relaxed max-w-lg font-medium">
                Automatize a gestão de dízimos e ofertas com precisão absoluta. Clareza financeira e rapidez para sua liderança.
            </p>

            <div className="pt-6 flex items-center gap-6">
                <div className="flex -space-x-4">
                    {[1,2,3].map(i => (
                        <div key={i} className="w-10 h-10 rounded-full border-2 border-indigo-500 bg-gradient-to-br from-indigo-400 to-blue-400 flex items-center justify-center text-xs font-bold text-white shadow-lg relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/20"></div>
                        </div>
                    ))}
                </div>
                <div className="text-sm">
                    <p className="font-bold text-white">Confiado por líderes</p>
                    <p className="text-indigo-200 text-xs">Junte-se a milhares de igrejas.</p>
                </div>
            </div>
        </div>

        {/* Right Side - Login Card */}
        <div className="flex justify-center">
            <div className="w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl shadow-indigo-900/20 overflow-hidden relative border border-white/50 ring-4 ring-white/20">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                
                <div className="p-6 sm:p-8">
                    <div className="text-center mb-6">
                        <div className="lg:hidden flex justify-center mb-4">
                             <div className="p-3 bg-indigo-50 rounded-2xl shadow-inner">
                                <LogoIcon className="w-8 h-8 text-indigo-600" />
                            </div>
                        </div>
                        <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                            {isLogin ? 'Bem-vindo' : 'Criar Conta'}
                        </h2>
                        <p className="mt-2 text-slate-500 text-sm">
                            {isLogin ? 'Acesse seu painel financeiro.' : 'Comece sua jornada.'}
                        </p>
                    </div>
            
                    <div className="space-y-4">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-50 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                        >
                            <GoogleIcon className="w-5 h-5" />
                            <span>Continuar com Google</span>
                        </button>

                        <div className="relative flex items-center py-1">
                            <div className="flex-grow border-t border-slate-200"></div>
                            <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] uppercase font-bold tracking-widest">ou entre com email</span>
                            <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        <form onSubmit={handleAuth} className="space-y-4">
                            {!isLogin && (
                                <div>
                                    <label className="block text-slate-700 text-[10px] font-bold uppercase mb-1 ml-1" htmlFor="name">Nome Completo</label>
                                    <ModernInput 
                                        id="name"
                                        type="text"
                                        value={name}
                                        onChange={(e: any) => setName(e.target.value)}
                                        placeholder="Seu Nome"
                                        icon={UserIcon}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-slate-700 text-[10px] font-bold uppercase mb-1 ml-1" htmlFor="email">Email</label>
                                <ModernInput 
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e: any) => setEmail(e.target.value)}
                                    placeholder="exemplo@igreja.com"
                                    icon={EnvelopeIcon}
                                />
                            </div>
                            
                            <div>
                                <div className="flex items-center justify-between mb-1 ml-1">
                                    <label className="block text-slate-700 text-[10px] font-bold uppercase" htmlFor="password">Senha</label>
                                    {isLogin && <a href="#" className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold transition-colors">Esqueceu?</a>}
                                </div>
                                <ModernInput 
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e: any) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    icon={LockClosedIcon}
                                    rightElement={
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors focus:outline-none"
                                        >
                                            {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                        </button>
                                    }
                                />
                            </div>
                            
                            {error && (
                                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-2 rounded-2xl text-xs flex items-center animate-fade-in">
                                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    <span className="font-medium">{error}</span>
                                </div>
                            )}
                            {message && (
                                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-2 rounded-2xl text-xs flex items-center animate-fade-in">
                                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                    <span className="font-medium">{message}</span>
                                </div>
                            )}

                            <button
                                className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/30 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 transform hover:-translate-y-1 active:scale-[0.98] text-sm"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Acessando...
                                    </span>
                                ) : (
                                    isLogin ? 'Entrar no Sistema' : 'Cadastrar Grátis'
                                )}
                            </button>
                        </form>

                        <div className="text-center pt-1">
                            <button
                                className="text-xs text-slate-500 hover:text-indigo-600 font-bold transition-colors focus:outline-none"
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError(null);
                                    setMessage(null);
                                }}
                            >
                                {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entrar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
      
      <div className="absolute bottom-4 text-center w-full text-indigo-200/70 text-[10px] z-10 font-medium tracking-wide">
        &copy; {new Date().getFullYear()} IdentificaPix. Segurança e Privacidade garantidas.
      </div>
    </div>
  );
};
