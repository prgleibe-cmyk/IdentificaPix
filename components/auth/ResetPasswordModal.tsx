import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';

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
            const { error: resetError } = await (supabase.auth as any).updateUser({ password });
            if (resetError) throw resetError;
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md p-8 border border-slate-100 dark:border-white/5 animate-fade-in text-slate-800 dark:text-slate-100">
                <div className="text-center mb-6">
                    <h3 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">Nova Senha</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Crie uma nova senha para sua conta.</p>
                </div>

                {success ? (
                    <div className="text-center py-6 space-y-3">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-500 mx-auto animate-bounce">
                            <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h4 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Senha Alterada!</h4>
                        <p className="text-xs text-slate-400 font-medium">Sua senha foi atualizada com sucesso. Você já está conectado.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Nova Senha</label>
                            <input 
                                type="password" 
                                placeholder="Mínimo 6 caracteres" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/5 rounded-xl text-slate-800 dark:text-white font-bold outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm"
                                required 
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Confirmar Nova Senha</label>
                            <input 
                                type="password" 
                                placeholder="Repita a nova senha" 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)} 
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/5 rounded-xl text-slate-800 dark:text-white font-bold outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm"
                                required 
                            />
                        </div>

                        {error && (
                            <p className="text-red-500 text-xs font-bold text-center mt-2 bg-red-50 dark:bg-red-950/20 p-2.5 rounded-lg border border-red-100 dark:border-red-950/45">{error}</p>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="flex-1 py-3 px-4 border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                disabled={loading} 
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-orange-500/10 transition-all disabled:opacity-70"
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
