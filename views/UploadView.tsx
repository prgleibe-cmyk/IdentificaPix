
import React, { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { BanknotesIcon, SparklesIcon, InformationCircleIcon, WhatsAppIcon, ShieldCheckIcon, DevicePhoneMobileIcon } from '../components/Icons';
import { SmartBankCard } from '../components/upload/SmartBankCard';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { usePersistentState } from '../hooks/usePersistentState';

/**
 * UPLOAD VIEW (V9 - DESIGN REFINADO COM ESCOLHA DE MODO DE ENTRADA)
 */
export const UploadView: React.FC = () => {
    const { 
        banks
    } = useContext(AppContext);
    const { systemSettings } = useAuth();
    const { setActiveView } = useUI();
    const { t } = useTranslation();

    // Estado persistente para o modo de alimentação (arquivo vs android)
    const [feedingMode, setFeedingMode] = usePersistentState<'file' | 'android'>('identificapix-feeding-mode', 'file');

    return (
        <div className="flex flex-col h-full animate-fade-in gap-6 pb-4 px-2 md:px-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-brand-deep dark:text-white tracking-tight leading-none">Lançar Dados</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">Gerencie a entrada de transações e a alimentação da sua Lista Viva.</p>
                </div>
                
                <button
                    onClick={() => setActiveView('connectors')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95 border border-white/10 shrink-0 ${
                        feedingMode === 'android'
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            : 'bg-brand-blue hover:bg-brand-blue/90 dark:bg-slate-800 dark:hover:bg-slate-700 text-white dark:text-slate-200'
                    }`}
                >
                    {feedingMode === 'android' ? (
                        <>
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
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
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-brand-blue/10 rounded-xl text-brand-blue">
                        <InformationCircleIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Como deseja alimentar a Lista Viva?</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Escolha um método exclusivo de entrada para evitar conflitos ou registros duplicados.</p>
                    </div>
                </div>

                <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 w-full md:w-auto">
                    <button
                        onClick={() => setFeedingMode('file')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                            feedingMode === 'file'
                                ? 'bg-brand-blue text-white shadow-md'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <BanknotesIcon className="w-4.5 h-4.5" />
                        <span>Carregar Arquivos</span>
                    </button>
                    <button
                        onClick={() => setFeedingMode('android')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                            feedingMode === 'android'
                                ? 'bg-brand-blue text-white shadow-md'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <DevicePhoneMobileIcon className="w-4.5 h-4.5" />
                        <span>Conexão Android</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 flex flex-col">
                <div className="w-full space-y-6">
                    {/* AVISO DE ORIENTAÇÃO COMPACTO NO TOPO */}
                    <div className="relative bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-[2rem] p-4 pr-12 md:pr-32 flex items-start gap-4 shadow-sm group">
                        <div className="p-2.5 bg-white dark:bg-indigo-900/40 rounded-xl shadow-sm text-indigo-600 dark:text-indigo-400 shrink-0">
                            <ShieldCheckIcon className="w-6 h-6" />
                        </div>
                        
                        <div className="flex-1">
                            <h4 className="font-black text-indigo-900 dark:text-indigo-100 uppercase text-[10px] tracking-widest mb-1">Guia de Melhores Resultados</h4>
                            <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
                                O sistema aprende através da <strong>Lista Viva</strong>. Para máxima precisão, use sempre o mesmo modelo de arquivo; mudanças de layout reduzem a identificação automática. Dê preferência a <strong>Excel (.xlsx) ou CSV</strong> por serem mais rápidos e estáveis.
                                <span className="block mt-1.5 font-bold text-indigo-800 dark:text-indigo-200 opacity-90">
                                    Atenção: Se o arquivo não retornar resultados ou não for reconhecido, chame o suporte para cadastrar seu modelo exclusivo.
                                </span>
                            </p>
                        </div>

                        {/* BOTÃO DE SUPORTE COMPACTO NO CANTO SUPERIOR */}
                        <button 
                            onClick={() => window.open(`https://wa.me/${systemSettings.supportNumber}?text=Olá! Meu extrato não retornou resultados. Preciso cadastrar um novo modelo de arquivo no IdentificaPix.`, '_blank')}
                            className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-md transition-all active:scale-95 border border-white/10"
                        >
                            <WhatsAppIcon className="w-3 h-3" />
                            <span className="hidden sm:inline">Suporte</span>
                        </button>
                    </div>

                    {/* PAINEL DE EXTRATOS */}
                    <div className="bg-white dark:bg-slate-800 p-5 md:p-6 rounded-[2rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                        
                        <div className="flex items-center gap-4 mb-5 relative z-10">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-brand-blue border border-blue-100 dark:border-blue-800 shadow-sm">
                                <BanknotesIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">Extratos para Processamento</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Selecione ou carregue as listas que deseja conciliar agora.</p>
                            </div>
                        </div>

                        {/* CONTAINER COM OVERLAY SE ESTIVER NO MODO ANDROID */}
                        <div className="relative">
                            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10 transition-all duration-300 ${
                                feedingMode === 'android' ? 'pointer-events-none select-none blur-[2px] opacity-20' : ''
                            }`}>
                                {banks.length > 0 ? (
                                    banks.map((bank: any) => (
                                        <SmartBankCard key={bank.id} bank={bank} />
                                    ))
                                ) : (
                                    <div className="p-10 text-center border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-3xl col-span-full">
                                        <p className="text-slate-400 text-sm font-medium">Nenhum banco cadastrado. Vá em "Cadastro" para adicionar.</p>
                                    </div>
                                )}
                            </div>

                            {/* OVERLAY EXPLICATIVO DO MODO ANDROID */}
                            {feedingMode === 'android' && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-6 bg-white/40 dark:bg-slate-800/40 backdrop-blur-[1px] rounded-3xl animate-fade-in">
                                    <div className="max-w-md bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-150 dark:border-slate-800 flex flex-col items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center animate-bounce">
                                            <DevicePhoneMobileIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800 dark:text-white uppercase text-xs tracking-wider">Alimentação Automática Ativa</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                                                Seu sistema está configurado para receber os Pix de forma <strong>100% automática e em tempo real</strong> diretamente pelo celular Android.
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1.5">
                                                O carregamento manual de arquivos está desativado para garantir a integridade dos relatórios e evitar duplicidades.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setFeedingMode('file')}
                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95"
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
                    className="flex items-center gap-3 px-8 py-3.5 text-white rounded-2xl shadow-2xl hover:-translate-y-1 transition-all text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-emerald-500 to-teal-600 border border-white/20 group animate-pulse-slow"
                >
                    <SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    <span>Ver Lista Viva (Painel)</span>
                </button>
            </div>
        </div>
    );
};

