
import React, { useContext, useEffect, memo, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { BanknotesIcon, SparklesIcon, InformationCircleIcon, WhatsAppIcon, ShieldCheckIcon, DevicePhoneMobileIcon } from '../components/Icons';
import { SmartBankCard } from '../components/upload/SmartBankCard';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { usePersistentState } from '../hooks/usePersistentState';
import { resolveBankKey } from '../utils/bankHelper';

/**
 * UPLOAD VIEW (V9 - DESIGN REFINADO COM ESCOLHA DE MODO DE ENTRADA)
 */
export const UploadView: React.FC = memo(() => {
    const { 
        banks
    } = useContext(AppContext);
    const { systemSettings } = useAuth();
    const { setActiveView } = useUI();
    const { t } = useTranslation();

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

    return (
        <div className="flex flex-col min-h-full animate-fade-in gap-6 pb-8 md:pb-4 px-2 md:px-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">Lançar Dados</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-normal">Gerencie a entrada de transações e a alimentação da sua Lista Viva.</p>
                </div>
                
                <button
                    onClick={() => setActiveView('connectors')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold uppercase text-xs tracking-wider shadow-sm transition-all active:scale-95 shrink-0 ${
                        feedingMode === 'android'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                    }`}
                >
                    {feedingMode === 'android' ? (
                        <>
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                            <span>Configuração Android Ativa</span>
                        </>
                    ) : (
                        <>
                            <DevicePhoneMobileIcon className="w-4 h-4" />
                            <span>Conexão Android</span>
                        </>
                    )}
                </button>
            </div>

            {/* SELETOR DE MODO DE ALIMENTAÇÃO DA LISTA VIVA */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-lg">
                        <InformationCircleIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Como deseja alimentar a Lista Viva?</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Escolha um método exclusivo de entrada para evitar conflitos ou registros duplicados.</p>
                    </div>
                </div>

                <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg shadow-xs border border-slate-200 dark:border-slate-700 w-full md:w-auto">
                    <button
                        onClick={() => setFeedingMode('file')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
                            feedingMode === 'file'
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                    >
                        <BanknotesIcon className="w-4 h-4" />
                        <span>Carregar Arquivos</span>
                    </button>
                    <button
                        onClick={() => setFeedingMode('android')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
                            feedingMode === 'android'
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                    >
                        <DevicePhoneMobileIcon className="w-4 h-4" />
                        <span>Conexão Android</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 flex flex-col">
                <div className="w-full space-y-6">
                    {/* AVISO DE ORIENTAÇÃO COMPACTO NO TOPO */}
                    <div className="relative bg-slate-50 dark:bg-slate-900/50 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 pr-12 md:pr-32 flex items-start gap-3.5 shadow-card group">
                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-xs text-orange-600 dark:text-orange-400 shrink-0 border border-slate-200 dark:border-slate-700">
                            <ShieldCheckIcon className="w-5 h-5" />
                        </div>
                        
                        <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 dark:text-white uppercase text-[10px] tracking-wider mb-1">Guia de Melhores Resultados</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                O sistema prioriza a <strong>Conexão Android</strong> automática: com seu celular configurado e a macro ativa, as transações (SMS e notificações) alimentam a Lista Viva <strong>em tempo real</strong> sem risco de perdas. O upload de arquivos (Excel ou CSV) serve para cargas históricas ou retroativas, e o sistema <strong>retorna automaticamente à Conexão Android</strong> após a importação.
                                <span className="block mt-1.5 font-medium text-slate-800 dark:text-slate-200">
                                    Dica: Cada conciliação manual que você realiza ensina nossa inteligência a identificar os próximos lançamentos de forma 100% automatizada.
                                </span>
                            </p>
                        </div>

                        {/* BOTÃO DE SUPORTE COMPACTO NO CANTO SUPERIOR */}
                        <button 
                            onClick={() => window.open(`https://wa.me/${systemSettings.supportNumber}?text=Olá! Meu extrato não retornou resultados. Preciso cadastrar um novo modelo de arquivo no IdentificaPix.`, '_blank')}
                            className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg font-semibold uppercase text-[10px] tracking-wider shadow-xs transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
                        >
                            <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="hidden sm:inline">Suporte</span>
                        </button>
                    </div>

                    {/* PAINEL DE EXTRATOS */}
                    <div className="bg-white dark:bg-slate-800 p-5 md:p-6 rounded-xl shadow-card border border-slate-200/90 dark:border-slate-700 flex flex-col relative overflow-hidden group">
                        <div className="flex items-center gap-3 mb-5 relative z-10">
                            <div className="p-2.5 bg-slate-100 dark:bg-slate-700/60 rounded-lg text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-xs">
                                <BanknotesIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">Extratos para Processamento</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Selecione ou carregue as listas que deseja conciliar agora.</p>
                            </div>
                        </div>

                        {/* CONTAINER COM OVERLAY SE ESTIVER NO MODO ANDROID */}
                        <div className="relative">
                            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10 transition-all duration-300 ${
                                feedingMode === 'android' ? 'pointer-events-none select-none blur-[2px] opacity-20' : ''
                            }`}>
                                {(() => {
                                    const availableBanks = banks || [];
                                    if (availableBanks.length === 0) {
                                        return (
                                            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl col-span-full">
                                                <p className="text-slate-400 text-xs font-medium">Nenhum banco cadastrado. Vá em "Cadastro" para adicionar.</p>
                                            </div>
                                        );
                                    }
                                    return availableBanks.map((bank: any) => (
                                        <SmartBankCard key={bank.id} bank={bank} />
                                    ));
                                })()}
                            </div>

                            {/* OVERLAY EXPLICATIVO DO MODO ANDROID */}
                            {feedingMode === 'android' && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] rounded-xl animate-fade-in">
                                    <div className="max-w-md bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3.5">
                                        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                                            <DevicePhoneMobileIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-wider">Alimentação Automática Ativa</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                                                Seu sistema está configurado para receber os Pix de forma <strong>100% automática e em tempo real</strong> diretamente pelo celular Android.
                                            </p>
                                            <p className="text-[11px] text-slate-400 mt-1">
                                                O carregamento manual de arquivos está desativado para garantir a integridade dos relatórios e evitar duplicidades.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setFeedingMode('file')}
                                            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
                                        >
                                            Mudar para Carregar Arquivos
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-center pt-2 flex-shrink-0">
                <button 
                    onClick={() => setActiveView('dashboard')} 
                    className="inline-flex items-center gap-2.5 px-6 py-3 text-white rounded-lg shadow-sm hover:bg-orange-700 transition-all text-xs font-bold uppercase tracking-wider bg-orange-600 group"
                >
                    <SparklesIcon className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    <span>Ver Lista Viva (Painel)</span>
                </button>
            </div>
        </div>
    );
});

