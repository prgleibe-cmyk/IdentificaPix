import React, { useState } from 'react';
import { authService } from '../../services/authService';

interface ResetPasswordModalProps {
    onClose: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ onClose }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) {
            setError('A senha precisa ter no mínimo 6 caracteres.');
            return;
        }
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const resetToken = urlParams.get('resetToken') || urlParams.get('token') || '';
            const res = await authService.resetPassword(resetToken, password);
            if (!res.success) throw new Error(res.error || 'Erro ao redefinir senha');
            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 3000);
        } catch (err: any) {
            console.error("Error resetting password:", err);
            setError(err.message || 'Erro ao atualizar a senha.');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/55 dark:bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-elevated w-full max-w-md p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 animate-fade-in text-slate-900 dark:text-slate-100">
                <div className="text-center mb-6">
                    <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/70 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Nova Senha</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">Crie uma nova senha para sua conta.</p>
                </div>

                {success ? (
                    <div className="text-center py-4 space-y-3">
                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h4 className="text-base font-bold text-emerald-700 dark:text-emerald-400">Senha Alterada</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Sua senha foi atualizada com sucesso. Você já pode acessar normalmente.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 ml-0.5">Nova Senha</label>
                            <input 
                                type="password" 
                                placeholder="Mínimo 6 caracteres" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-lg text-slate-900 dark:text-white font-medium outline-none transition-all text-xs placeholder:text-slate-400"
                                required 
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 ml-0.5">Confirmar Nova Senha</label>
                            <input 
                                type="password" 
                                placeholder="Repita a nova senha" 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)} 
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-lg text-slate-900 dark:text-white font-medium outline-none transition-all text-xs placeholder:text-slate-400"
                                required 
                            />
                        </div>

                        {error && (
                            <p className="text-rose-700 dark:text-rose-300 text-xs font-medium text-center mt-2 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/50">{error}</p>
                        )}

                        <div className="flex gap-2.5 pt-2">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="flex-1 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                disabled={loading} 
                                className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 active:scale-[0.99] rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-60"
                            >
                                {loading ? 'Salvando...' : 'Salvar Senha'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
