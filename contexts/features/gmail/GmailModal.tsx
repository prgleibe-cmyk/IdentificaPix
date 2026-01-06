
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../services/supabaseClient';
import { gmailService } from './GmailService';
import { 
    XMarkIcon, 
    EnvelopeIcon, 
    SparklesIcon, 
    CheckCircleIcon, 
    ExclamationTriangleIcon, 
    GoogleIcon,
    ShieldCheckIcon,
    BoltIcon
} from '../../components/Icons';

interface GmailModalProps {
    onClose: () => void;
    onSuccess: (csvContent: string) => void;
}

export const GmailModal: React.FC<GmailModalProps> = ({ onClose, onSuccess }) => {
    const [status, setStatus] = useState<'idle' | 'auth' | 'processing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('Conecte sua conta para buscar comprovantes.');
    const [detail, setDetail] = useState(''); 
    const [count, setCount] = useState(0);

    // INÍCIO DO FLUXO OAUTH
    const startProcess = async () => {
        setStatus('auth');
        setMessage('Redirecionando para o Google...');
        setDetail('Você será levado para a tela de login segura do Google.');

        try {
            // 1. Marca flag de pendência para reabrir o modal na volta
            localStorage.setItem('identificapix_gmail_pending', 'true');

            // 2. Inicia OAuth com escopos estritos
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    scopes: 'https://www.googleapis.com/auth/gmail.readonly',
                    redirectTo: window.location.origin, // Retorna para a mesma página
                    queryParams: { 
                        access_type: 'offline', // Importante para refresh token
                        prompt: 'consent'       // Força a tela de consentimento
                    }
                }
            });

            if (error) throw error;
            
        } catch (e: any) {
            localStorage.removeItem('identificapix_gmail_pending');
            setStatus('error');
            setMessage('Não foi possível iniciar.');
            setDetail(e.message);
        }
    };

    // MODO SIMULAÇÃO (Para contornar erro 403 em desenvolvimento)
    const runSimulation = () => {
        setStatus('processing');
        setMessage('Simulando conexão segura...');
        setDetail('Gerando dados de exemplo para teste do sistema...');

        setTimeout(() => {
            const mockCsv = `Data;Descrição;Valor;Tipo
${new Date().toLocaleDateString('pt-BR')};PIX RECEBIDO MARIA SILVA;150.00;PIX
${new Date().toLocaleDateString('pt-BR')};OFERTA JOAO SOUZA;200.00;OFERTA
${new Date().toLocaleDateString('pt-BR')};PAGAMENTO FORNECEDOR;-50.00;PAGTO
${new Date().toLocaleDateString('pt-BR')};TRANSFERENCIA RECEBIDA;-1200.00;TED`;
            
            setCount(4);
            setStatus('success');
            setMessage('Simulação Concluída!');
            setDetail('4 transações de teste foram geradas.');
            
            setTimeout(() => {
                onSuccess(mockCsv);
                onClose();
            }, 2000);
        }, 2000);
    };

    // RECUPERAÇÃO PÓS-REDIRECT
    useEffect(() => {
        const checkAndProcess = async () => {
            const isPending = localStorage.getItem('identificapix_gmail_pending');
            
            // Só executa se houver uma operação pendente iniciada por este modal
            if (isPending !== 'true') return;

            setStatus('processing');
            setMessage('Autenticado. Analisando e-mails...');
            setDetail('Aguarde, a IA está filtrando suas transações bancárias...');

            try {
                // Pequeno delay para garantir hidratação da sessão do Supabase
                await new Promise(r => setTimeout(r, 1000));

                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error || !session) {
                    throw new Error("Sessão não recuperada. Tente novamente.");
                }

                // O token do provedor (Google) é crucial aqui
                const providerToken = session.provider_token;

                if (!providerToken) {
                    throw new Error("Token de acesso do Google não encontrado. Por favor, reconecte.");
                }

                // 3. Chamada ao Backend (Segura, com token)
                const { csv, count } = await gmailService.syncEmails(providerToken);
                
                if (count > 0 && csv) {
                    setCount(count);
                    setStatus('success');
                    setMessage('Importação Concluída!');
                    setDetail(`${count} transações foram extraídas com sucesso.`);
                    
                    // Sucesso: Chama callback e fecha
                    setTimeout(() => {
                        onSuccess(csv);
                        onClose();
                    }, 2500);
                } else {
                    // Sucesso técnico, mas sem dados
                    setStatus('error');
                    setMessage('Nenhum comprovante encontrado.');
                    setDetail('Verificamos seus e-mails recentes e não encontramos transações bancárias. Verifique se recebeu os comprovantes no e-mail conectado.');
                    localStorage.removeItem('identificapix_gmail_pending');
                }

            } catch (err: any) {
                console.error("Erro no fluxo Gmail:", err);
                setStatus('error');
                setMessage('Falha na Sincronização.');
                setDetail(err.message || 'Erro desconhecido ao processar.');
                localStorage.removeItem('identificapix_gmail_pending');
            }
        };
        
        checkAndProcess();
    }, []); 

    // Renderizadores de Estado (UI)
    const renderIcon = () => {
        switch (status) {
            case 'processing': return <div className="animate-spin"><SparklesIcon className="w-12 h-12 text-brand-blue" /></div>;
            case 'success': return <CheckCircleIcon className="w-16 h-16 text-emerald-500 animate-scale-in" />;
            case 'error': return <ExclamationTriangleIcon className="w-12 h-12 text-red-500" />;
            case 'auth': return <div className="animate-pulse"><GoogleIcon className="w-12 h-12" /></div>;
            default: return <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl"><EnvelopeIcon className="w-10 h-10 text-red-500" /></div>;
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-[#051024]/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#0F172A] rounded-[2.5rem] shadow-2xl w-full max-w-[420px] border border-white/20 relative overflow-hidden flex flex-col items-center text-center animate-scale-in">
                
                {/* Decorative Background */}
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-slate-50 to-transparent dark:from-slate-800/50 pointer-events-none"></div>
                
                {/* Close Button (FIX: Z-Index 50 to ensure clickability over decorations) */}
                {status !== 'processing' && status !== 'auth' && (
                    <button 
                        onClick={onClose} 
                        className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors z-50 cursor-pointer"
                        title="Fechar"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                )}

                <div className="p-8 pb-4 w-full flex flex-col items-center relative z-10">
                    <div className="mb-6 h-24 flex items-center justify-center">
                        {renderIcon()}
                    </div>

                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2">
                        {status === 'idle' ? 'Importar do Gmail' : message}
                    </h3>
                    
                    <p className={`text-sm font-medium leading-relaxed max-w-[300px] mx-auto ${status === 'error' ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                        {status === 'idle' ? 'A inteligência artificial irá ler seus e-mails e extrair comprovantes bancários automaticamente.' : detail}
                    </p>
                </div>

                <div className="w-full p-8 pt-2 relative z-10">
                    {status === 'idle' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 p-4 rounded-2xl text-left flex gap-3 items-start">
                                <ShieldCheckIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">Privacidade Garantida</p>
                                    <p className="text-xs text-blue-600/80 dark:text-blue-200/70 leading-snug">
                                        Lemos apenas e-mails com termos como "Pix", "Comprovante" ou "Transferência".
                                    </p>
                                </div>
                            </div>

                            <button 
                                onClick={startProcess} 
                                className="w-full py-4 bg-[#DB4437] hover:bg-[#c53929] text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-red-500/20 hover:-translate-y-0.5 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                            >
                                <div className="bg-white/20 p-1 rounded-full group-hover:bg-white/30 transition-colors">
                                    <GoogleIcon className="w-4 h-4 text-white grayscale brightness-200" />
                                </div>
                                Conectar Gmail
                            </button>

                            <button 
                                onClick={runSimulation}
                                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl font-bold uppercase text-[10px] tracking-wide hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <BoltIcon className="w-3 h-3" />
                                Modo Simulação (Teste Rápido)
                            </button>
                            
                            <p className="text-[9px] text-slate-400">
                                * Se ocorrer erro 403, seu e-mail não está na lista de testadores do Google Cloud. Use o Modo Simulação.
                            </p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="space-y-3">
                            <button onClick={() => setStatus('idle')} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold uppercase text-xs tracking-wide hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                Tentar Novamente
                            </button>
                            <button 
                                onClick={runSimulation}
                                className="w-full py-3 bg-white border-2 border-slate-100 dark:bg-slate-800 dark:border-slate-700 text-brand-blue dark:text-blue-400 rounded-xl font-bold uppercase text-xs tracking-wide hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-center gap-2"
                            >
                                <BoltIcon className="w-3.5 h-3.5" />
                                Usar Modo Simulação
                            </button>
                            <p className="text-[10px] text-slate-400 leading-tight px-4">
                                Dica: Habilite a "Gmail API" no Google Cloud Console se este erro persistir.
                            </p>
                        </div>
                    )}
                    
                    {(status === 'processing' || status === 'auth') && (
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-4">
                            <div className="h-full bg-brand-blue animate-pulse w-2/3 rounded-full"></div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
