import React, { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

export const useAuthController = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const toggleMode = useCallback(() => {
        setIsLogin(prev => !prev);
        setError(null);
        setMessage(null);
    }, []);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const { error } = await (supabase.auth as any).signInWithOAuth({
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
        } catch (err: any) {
            console.error("Google login error:", err);
            setError(err.message === 'Failed to fetch' 
                ? 'O servidor está acordando. Aguarde alguns segundos e tente novamente.' 
                : (err.message || 'Erro ao conectar com Google.'));
            setLoading(false);
        }
    };

    // Fix: Added React to imports and typed event as React.FormEvent
    const handleAuth = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);
        
        if (password.length < 6) {
            setError('A senha precisa ter no mínimo 6 caracteres.');
            setLoading(false);
            return;
        }

        let attempts = 0;
        const maxAttempts = 3;
        let success = false;

        while (attempts < maxAttempts && !success) {
            attempts++;
            try {
                if (isLogin) {
                    const { error } = await (supabase.auth as any).signInWithPassword({ email, password });
                    
                    // Fallback para Backend se falhar por rede ou CORS
                    if (error && (error.message === 'Failed to fetch' || error.message.includes('CORS') || error.message.includes('FetchEvent'))) {
                        console.warn('[AUTH] Falha direta, tentando fallback via API...');
                        try {
                            const response = await fetch('/api/login', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email, password })
                            });
                            
                            const result = await response.json();
                            
                            if (response.ok && result.session) {
                                // Define a sessão recebida do backend no cliente local
                                await (supabase.auth as any).setSession({
                                    access_token: result.session.access_token,
                                    refresh_token: result.session.refresh_token
                                });
                                console.log('[AUTH] Login via Proxy realizado com sucesso');
                                success = true;
                                continue;
                            } else if (result.error) {
                                throw new Error(result.error);
                            }
                        } catch (proxyErr: any) {
                            console.error('[AUTH] Fallback via Proxy falhou:', proxyErr);
                            // Mantém o erro original se o proxy também falhar
                        }
                    }

                    if (error) throw error;
                } else {
                    const { error } = await (supabase.auth as any).signUp({
                        email,
                        password,
                        options: { data: { full_name: name } }
                    });
                    if (error) throw error;
                    setMessage('Cadastro realizado! Verifique seu email para confirmação.');
                }
                success = true;
            } catch (err: any) {
                if (attempts === maxAttempts) {
                    if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
                        setError('O servidor está demorando para responder (Cold Start). Aguarde 10 segundos e tente novamente.');
                    } else if (err.message.includes('Invalid login credentials')) {
                        setError('Email ou senha incorretos.');
                    } else {
                        setError(err.message || 'Ocorreu um erro inesperado.');
                    }
                } else {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        setLoading(false);
    };

    return {
        isLogin, name, setName, email, setEmail, password, setPassword,
        showPassword, setShowPassword, loading, error, message,
        toggleMode, handleGoogleLogin, handleAuth
    };
};