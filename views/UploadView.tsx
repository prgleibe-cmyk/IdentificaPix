
import React, { useContext, useEffect, memo } from 'react';
import { Upload } from 'lucide-react';
import { AppContext } from '../contexts/AppContext';
import { BanknotesIcon, SparklesIcon, InformationCircleIcon, WhatsAppIcon, ShieldCheckIcon, DevicePhoneMobileIcon } from '../components/Icons';
import { SmartBankCard } from '../components/upload/SmartBankCard';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { usePersistentState } from '../hooks/usePersistentState';

/**
 * UPLOAD VIEW (V10 - PADRONIZAÇÃO VISUAL IGGESTOR)
 */
export const UploadView: React.FC = memo(() => {
    const { banks } = useContext(AppContext);
    const { systemSettings } = useAuth();
    const { setActiveView } = useUI();

    // Estado persistente para o modo de alimentação (arquivo vs android)
    const [feedingMode, setFeedingMode] = usePersistentState<'file' | 'android'>('identificapix-feeding-mode', 'android');

    // Sempre garante que o modo de alimentação padrão é 'android' ao montar/desmontar (navegar para outra tela)
    useEffect(() => {
        setFeedingMode('android');
        return () => {
            setFeedingMode('android');
        };
    }, [setFeedingMode]);

    // Ouve o evento de finalização de upload de arquivo para retornar automaticamente para 'android'
    useEffect(() => {
        const handleFinishedUpload = () => {
            setTimeout(() => {
                setFeedingMode('android');
            }, 2000); // 2 segundos de atraso para o usuário perceber que o upload deu certo e depois mudar de volta
        };

        window.addEventListener('identificapix-file-uploaded', handleFinishedUpload);
        return () => {
            window.removeEventListener('identificapix-file-uploaded', handleFinishedUpload);
        };
    }, [setFeedingMode]);

    const availableBanks = banks || [];

    return (
        <div className="flex flex-col min-h-full animate-fade-in gap-3 pb-16 md:pb-4">
            {/* Header Card */}
            <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                            <Upload className="w-4 h-4 stroke-[2]" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                Lançar Dados
                            </h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Gerencie a entrada de transações e a alimentação da sua Lista Viva.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setActiveView('connectors')}
                        className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all active:scale-95 shrink-0 w-full sm:w-auto border ${
                            feedingMode === 'android'
                                ? 'bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60'
                                : 'bg-orange-50 hover:bg-orange-100/80 dark:bg-orange-950/40 dark:hover:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200/80 dark:border-orange-800/60'
                        }`}
                    >
                        {feedingMode === 'android' ? (
                            <>
                                <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span>Configuração Android Ativa</span>
                            </>
                        ) : (
                            <>
                                <DevicePhoneMobileIcon className="w-3.5 h-3.5 shrink-0" />
                                <span>Conexão Android</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Seletor de Modo de Alimentação da Lista Viva */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 rounded-lg flex items-center justify-center shrink-0">
                        <InformationCircleIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">Como deseja alimentar a Lista Viva?</h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Escolha um método exclusivo de entrada para evitar conflitos ou registros duplicados.</p>
                    </div>
                </div>

                <div className="flex bg-slate-100/80 dark:bg-slate-800 p-1 rounded-lg border border-slate-200/80 dark:border-slate-700 w-full lg:w-auto shrink-0">
                    <button
                        onClick={() => setFeedingMode('file')}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                            feedingMode === 'file'
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                    >
                        <BanknotesIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>Carregar Arquivos</span>
                    </button>
                    <button
                        onClick={() => setFeedingMode('android')}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                            feedingMode === 'android'
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                    >
                        <DevicePhoneMobileIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>Conexão Android</span>
                    </button>
                </div>
            </div>

            {/* Guia de Melhores Resultados */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col gap-2.5 flex-shrink-0">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                            <ShieldCheckIcon className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">Guia de Melhores Resultados</h3>
                    </div>

                    <button 
                        onClick={() => window.open(`https://wa.me/${systemSettings.supportNumber}?text=Olá! Meu extrato não retornou resultados. Preciso cadastrar um novo modelo de arquivo no IdentificaPix.`, '_blank')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold text-[11px] shadow-xs transition-all active:scale-95 border border-slate-200/90 dark:border-slate-700 shrink-0"
                    >
                        <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Suporte</span>
                    </button>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed sm:pl-10">
                    <p>
                        O sistema prioriza a <strong className="text-slate-800 dark:text-slate-100">Conexão Android</strong> automática: com seu celular configurado e a macro ativa, as transações (SMS e notificações) alimentam a Lista Viva <strong className="text-slate-800 dark:text-slate-100">em tempo real</strong> sem risco de perdas. O upload de arquivos (Excel ou CSV) serve para cargas históricas ou retroativas, e o sistema <strong className="text-slate-800 dark:text-slate-100">retorna automaticamente à Conexão Android</strong> após a importação.
                    </p>
                    <p className="mt-1.5 font-medium text-slate-700 dark:text-slate-200">
                        Dica: Cada conciliação manual que você realiza ensina nossa inteligência a identificar os próximos lançamentos de forma 100% automatizada.
                    </p>
                </div>
            </div>

            {/* Painel de Extratos */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden flex-shrink-0">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shrink-0">
                        <BanknotesIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight leading-tight">Extratos para Processamento</h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Selecione ou carregue as listas que deseja conciliar agora.</p>
                    </div>
                </div>

                <div className="p-4 md:p-5">
                    {feedingMode === 'android' ? (
                        <div className="py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col items-center justify-center text-center animate-fade-in">
                            <div className="max-w-md flex flex-col items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <DevicePhoneMobileIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">Alimentação Automática Ativa</h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                                        Seu sistema está configurado para receber os Pix de forma <strong>100% automática e em tempo real</strong> diretamente pelo celular Android.
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                                        O carregamento manual de arquivos está desativado para garantir a integridade dos relatórios e evitar duplicidades.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setFeedingMode('file')}
                                    className="mt-1 px-4 py-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-xs"
                                >
                                    Mudar para Carregar Arquivos
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
                            {availableBanks.length === 0 ? (
                                <div className="py-10 px-4 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl col-span-full bg-slate-50/50 dark:bg-slate-800/20">
                                    <p className="text-slate-400 text-xs font-medium">Nenhum banco cadastrado. Vá em "Cadastro" para adicionar.</p>
                                </div>
                            ) : (
                                availableBanks.map((bank: any) => (
                                    <SmartBankCard key={bank.id} bank={bank} />
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-center pt-1 flex-shrink-0">
                <button 
                    onClick={() => setActiveView('dashboard')} 
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-white rounded-lg shadow-xs hover:bg-orange-700 transition-all active:scale-95 text-xs font-semibold bg-orange-600 group w-full sm:w-auto"
                >
                    <SparklesIcon className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    <span>Ver Lista Viva (Painel)</span>
                </button>
            </div>
        </div>
    );
});

