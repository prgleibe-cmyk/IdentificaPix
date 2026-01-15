
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, EnvelopeIcon, BoltIcon, CheckCircleIcon, ExclamationTriangleIcon, GoogleIcon, SparklesIcon } from '../Icons';
import { gmailService } from '../../services/gmailService';
import { parseEmailBatch } from '../../services/emailParser';
import { supabase } from '../../services/supabaseClient';

interface GmailSyncModalProps {
    onClose: () => void;
}

export const GmailSyncModal: React.FC<GmailSyncModalProps> = ({ onClose }) => {
    const { 
        handleGmailSyncSuccess, // Nova função no context
        banks 
    } = useContext(AppContext);
    const { t } = useTranslation();
    
    const [status, setStatus] = useState<'idle' | 'auth' | 'fetching' | 'analyzing' | 'success' | 'error'>('idle');
    const [log, setLog] = useState<string[]>([]);
    const [foundCount, setFoundCount] = useState(0);

    const addLog = (msg: string) => setLog(prev => [...prev, msg]);

    const startSync = async () => {
        setStatus('auth');
        addLog("Verificando sessão...");

        try {
            const { data: { session } } = await (supabase.auth as any).getSession();
            
            // Tenta obter o token do provedor. 
            // Nota: O Supabase só expõe o provider_token na sessão inicial ou se configurado explicitamente.
            // Se falhar, pedimos re-login.
            let token = session?.provider_token;

            if (!token) {
                addLog("Token não encontrado. Solicitando permissão...");
                await gmailService.connect(); // Isso redirecionará a página
                return;
            }

            setStatus('fetching');
            addLog("Buscando e-mails bancários recentes...");
            // Busca os últimos 400 e-mails para garantir que cobre o período desconectado e grandes eventos
            const emails = await gmailService.fetchBankEmails(token, 400); 
            
            if (emails.length === 0) {
                addLog("Nenhum e-mail relevante encontrado.");
                setStatus('error');
                return;
            }

            addLog(`${emails.length} e-mails encontrados. Analisando com IA...`);
            setStatus('analyzing');

            const transactions = await parseEmailBatch(emails);
            setFoundCount(transactions.length);

            if (transactions.length > 0) {
                addLog(`${transactions.length} transações identificadas!`);
                handleGmailSyncSuccess(transactions); // Injeta no sistema
                setStatus('success');
            } else {
                addLog("A IA não conseguiu extrair transações válidas.");
                setStatus('error');
            }

        } catch (error: any) {
            console.error(error);
            addLog(`Erro: ${error.message}`);
            setStatus('error');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">
                            <EnvelopeIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Importar do Gmail</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Automação Inteligente v1.0</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8">
                    {status === 'idle' && (
                        <div className="text-center space-y-6">
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <GoogleIcon className="w-8 h-8" />
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                Conecte seu Gmail para que a IA busque automaticamente comprovantes de Pix e transferências recentes.
                            </p>
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-800 text-left">
                                <p className="text-[10px] text-amber-700 dark:text-amber-300 flex gap-2">
                                    <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                                    <span>
                                        O sistema lerá apenas e-mails com termos como "Pix", "Comprovante" ou "Transferência". Nenhum dado pessoal será armazenado.
                                    </span>
                                </p>
                            </div>
                            <button 
                                onClick={startSync}
                                className="w-full py-3 bg-brand-blue hover:bg-blue-600 text-white rounded-xl font-bold uppercase tracking-wide shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <BoltIcon className="w-4 h-4" />
                                Conectar e Sincronizar
                            </button>
                        </div>
                    )}

                    {(status === 'auth' || status === 'fetching' || status === 'analyzing') && (
                        <div className="text-center py-8">
                            <div className="relative w-16 h-16 mx-auto mb-6">
                                <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-700 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <SparklesIcon className="w-6 h-6 text-brand-blue animate-pulse" />
                                </div>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Trabalhando...</h4>
                            <div className="h-32 overflow-y-auto bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-[10px] font-mono text-slate-500 text-left border border-slate-200 dark:border-slate-700 custom-scrollbar">
                                {log.map((l, i) => <div key={i} className="mb-1"> {'>'} {l}</div>)}
                            </div>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-100 dark:border-emerald-800">
                                <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2">Sucesso!</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                                <strong>{foundCount}</strong> transações foram extraídas e adicionadas ao seu painel de conciliação.
                            </p>
                            <button onClick={onClose} className="px-8 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-full font-bold text-xs uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                Fechar
                            </button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-100 dark:border-red-800">
                                <XMarkIcon className="w-8 h-8 text-red-500" />
                            </div>
                            <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2">Ops!</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                                Não foi possível completar a sincronização. Verifique sua conexão ou tente novamente.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={onClose} className="px-6 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-full font-bold text-xs uppercase hover:bg-slate-50 transition-colors">
                                    Cancelar
                                </button>
                                <button onClick={startSync} className="px-6 py-2 bg-brand-blue text-white rounded-full font-bold text-xs uppercase shadow-lg hover:bg-blue-600 transition-colors">
                                    Tentar Novamente
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
