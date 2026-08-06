import React, { useState, useCallback } from 'react';
import { authService } from '../services/authService';

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

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            // Google OAuth integration via VPS backend or notification
            setError('Autenticação Google temporariamente indisponível. Utilize e-mail e senha.');
            setLoading(false);
        } catch (err: any) {
            console.error("Google login error:", err);
            setError(err.message || 'Erro ao conectar com Google.');
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
                    throw new Error(res.error || 'Erro ao solicitar recuperação de senha.');
                }
                setMessage('Instruções de recuperação enviadas! Verifique sua caixa de entrada.');
            } catch (err: any) {
                console.error("Reset password error:", err);
                setError(err.message || 'Erro ao enviar email de recuperação.');
            } finally {
                setLoading(false);
            }
            return;
        }

        if (password.length < 6) {
            setError('A senha precisa ter no mínimo 6 caracteres.');
            setLoading(false);
            return;
        }

        try {
            if (isLogin) {
                const res = await authService.login(email, password);
                if (!res.success) {
                    throw new Error(res.error || 'Email ou senha incorretos.');
                }
                window.location.reload();
            } else {
                const res = await authService.signup(email, password, name);
                if (!res.success) {
                    throw new Error(res.error || 'Erro ao realizar cadastro.');
                }
                setMessage('Cadastro realizado com sucesso! Você já pode entrar.');
                setIsLogin(true);
            }
        } catch (err: any) {
            console.error("Auth error:", err);
            setError(err.message || 'Ocorreu um erro na autenticação.');
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
