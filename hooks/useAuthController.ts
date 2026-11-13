import React, { useState, useCallback, useEffect } from 'react';
import { authService } from '../services/authService';

const GOOGLE_CALLBACK_PATH = '/auth/google/callback';
const processedGoogleCodes = new Set<string>();

export const useAuthController = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const toggleMode = useCallback(() => {
        setIsLogin(prev => !prev);
        setIsRecoveryMode(false);
        setError(null);
        setMessage(null);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const isCallbackPath = window.location.pathname === GOOGLE_CALLBACK_PATH;
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const oauthError = params.get('error');

        if (!isCallbackPath && !(code && state)) return;

        if (oauthError) {
            window.history.replaceState({}, document.title, '/');
            setError(
                oauthError === 'access_denied'
                    ? 'Acesso com Google cancelado pelo usuário.'
                    : 'Não foi possível concluir a autenticação com o Google.'
            );
            return;
        }

        if (!code || !state) {
            window.history.replaceState({}, document.title, '/');
            return;
        }

        if (processedGoogleCodes.has(code)) return;
        processedGoogleCodes.add(code);

        let active = true;
        const completeGoogleLogin = async () => {
            setLoading(true);
            setError(null);
            try {
                const redirectUri = `${window.location.origin}${GOOGLE_CALLBACK_PATH}`;
                const res = await authService.googleOAuth({ code, state, redirectUri });

                if (!res.success) {
                    window.history.replaceState({}, document.title, '/');
                    if (active) {
                        setError(res.error || 'Erro ao autenticar com Google.');
                        setLoading(false);
                    }
                    return;
                }

                if (res.data?.requiresTwoFactor) {
                    window.history.replaceState({}, document.title, '/');
                    if (active) {
                        setError('Esta conta possui verificação em duas etapas (2FA) ativa. Utilize login com e-mail e senha.');
                        setLoading(false);
                    }
                    return;
                }

                window.history.replaceState({}, document.title, '/');
                window.location.reload();
            } catch (err: any) {
                console.warn('Google OAuth callback error:', err);
                window.history.replaceState({}, document.title, '/');
                if (active) {
                    setError(err?.message || 'Erro ao conectar com Google.');
                    setLoading(false);
                }
            }
        };

        completeGoogleLogin();

        return () => {
            active = false;
        };
    }, []);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            const redirectUri = `${window.location.origin}${GOOGLE_CALLBACK_PATH}`;
            const res = await authService.getGoogleAuthUrl(redirectUri);
            if (!res.success || !res.url) {
                setError(res.error || 'Não foi possível iniciar o login com Google.');
                setLoading(false);
                return;
            }
            window.location.assign(res.url);
        } catch (err: any) {
            console.warn("Google login network error:", err);
            setError(err?.message || 'Erro ao conectar com Google.');
            setLoading(false);
        }
    };

    const handleAuth = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);
        
        if (isRecoveryMode) {
            if (!email) {
                setError('Por favor, informe seu email.');
                setLoading(false);
                return;
            }
            try {
                const res = await authService.requestPasswordReset(email);
                if (!res.success) {
                    setError(res.error || 'Erro ao solicitar recuperação de senha.');
                    return;
                }
                setMessage('Instruções de recuperação enviadas! Verifique sua caixa de entrada.');
            } catch (err: any) {
                console.warn("Reset password network error:", err);
                setError(err?.message || 'Erro ao enviar email de recuperação.');
            } finally {
                setLoading(false);
            }
            return;
        }

        if (password.length < 4) {
            setError('A senha precisa ter no mínimo 4 caracteres.');
            setLoading(false);
            return;
        }

        try {
            if (isLogin) {
                const res = await authService.login(email, password);
                if (!res.success) {
                    setError(res.error || 'Email ou senha incorretos.');
                    return;
                }
                window.location.reload();
            } else {
                const res = await authService.signup(email, password, name);
                if (!res.success) {
                    setError(res.error || 'Erro ao realizar cadastro.');
                    return;
                }
                window.location.reload();
            }
        } catch (err: any) {
            console.warn("Auth network error:", err);
            setError(err?.message || 'Ocorreu um erro na autenticação.');
        } finally {
            setLoading(false);
        }
    };

    return {
        isLogin, isRecoveryMode, setIsRecoveryMode, name, setName, email, setEmail, password, setPassword,
        showPassword, setShowPassword, loading, error, message,
        toggleMode, handleGoogleLogin, handleAuth
    };
};
