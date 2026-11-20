
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, EnvelopeIcon, BoltIcon, CheckCircleIcon, ExclamationTriangleIcon, GoogleIcon, SparklesIcon } from '../Icons';
import { gmailService } from '../../services/gmailService';
import { parseEmailBatch } from '../../services/emailParser';
import { getAuthSession } from '../../services/auth/authAdapter';

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
            const session = await getAuthSession();
            
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
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal animate-scale-in">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 rounded-lg text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-center">
                            <EnvelopeIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Importar do Gmail</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Automação Inteligente v1.0</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {status === 'idle' && (
                        <div className="text-center space-y-5">
                            <div className="w-14 h-14 bg-orange-50 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-900/40 rounded-xl flex items-center justify-center mx-auto">
                                <GoogleIcon className="w-7 h-7" />
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                Conecte seu Gmail para que a IA busque automaticamente comprovantes de Pix e transferências recentes.
                            </p>
                            <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200/70 dark:border-amber-800/60 text-left">
                                <p className="text-[11px] text-amber-800 dark:text-amber-300 flex gap-2">
                                    <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>
                                        O sistema lerá apenas e-mails com termos como "Pix", "Comprovante" ou "Transferência". Nenhum dado pessoal será armazenado.
                                    </span>
                                </p>
                            </div>
                            <button 
                                onClick={startSync}
                                className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <BoltIcon className="w-4 h-4" />
                                Conectar e Sincronizar
                            </button>
                        </div>
                    )}

                    {(status === 'auth' || status === 'fetching' || status === 'analyzing') && (
                        <div className="text-center py-6">
                            <div className="relative w-14 h-14 mx-auto mb-5">
                                <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <SparklesIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                </div>
                            </div>
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-2">Trabalhando...</h4>
                            <div
                                className="h-32 overflow-y-auto bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-[11px] font-mono text-slate-600 dark:text-slate-300 text-left border border-slate-200 dark:border-slate-800 custom-scrollbar tabular-nums"
                                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                            >
                                {log.map((l, i) => <div key={i} className="mb-1"> {'>'} {l}</div>)}
                            </div>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="text-center py-4">
                            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl flex items-center justify-center mx-auto mb-4 border border-emerald-200/70 dark:border-emerald-800/60">
                                <CheckCircleIcon className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Sucesso!</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                                <strong className="tabular-nums">{foundCount}</strong> transações foram extraídas e adicionadas ao seu painel de conciliação.
                            </p>
                            <button onClick={onClose} className="px-5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors cursor-pointer">
                                Fechar
                            </button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="text-center py-4">
                            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/30 rounded-xl flex items-center justify-center mx-auto mb-4 border border-rose-200/70 dark:border-rose-800/60">
                                <XMarkIcon className="w-7 h-7 text-rose-600 dark:text-rose-400" />
                            </div>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Ops!</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                                Não foi possível completar a sincronização. Verifique sua conexão ou tente novamente.
                            </p>
                            <div className="flex gap-2.5 justify-center">
                                <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer">
                                    Cancelar
                                </button>
                                <button onClick={startSync} className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-colors cursor-pointer">
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
