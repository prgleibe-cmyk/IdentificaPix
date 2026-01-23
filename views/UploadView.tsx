
import React, { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { BanknotesIcon, SparklesIcon, InformationCircleIcon, WhatsAppIcon, ShieldCheckIcon } from '../components/Icons';
import { GmailButton } from '../features/gmail/GmailButton';
import { SmartBankCard } from '../components/upload/SmartBankCard';
import { useAuth } from '../contexts/AuthContext';

/**
 * UPLOAD VIEW (V4 - COM GOVERNANÇA VISÍVEL)
 */
export const UploadView: React.FC = () => {
    const { 
        banks, activeReportId, selectedBankIds, handleCompare
    } = useContext(AppContext);
    const { systemSettings } = useAuth();
    const { t } = useTranslation();

    const hasSelection = selectedBankIds.length > 0;
    const canProcess = hasSelection || !!activeReportId;

    return (
        <div className="flex flex-col h-full animate-fade-in gap-6 pb-4 px-2 md:px-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-brand-deep dark:text-white tracking-tight leading-none">Lançar Dados</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">Selecione seus extratos para identificação automática inteligente.</p>
                </div>
                <div className="flex items-center gap-3">
                    <GmailButton />
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 flex flex-col">
                <div className="w-full space-y-6">
                    {/* AVISO DE GOVERNANÇA FIXO */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-[2rem] p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
                        <div className="p-4 bg-white dark:bg-indigo-900/40 rounded-2xl shadow-sm text-indigo-600 dark:text-indigo-400 shrink-0">
                            <ShieldCheckIcon className="w-8 h-8" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h4 className="font-black text-indigo-900 dark:text-indigo-100 uppercase text-xs tracking-widest mb-1">Seu arquivo não foi reconhecido?</h4>
                            <p className="text-sm text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed font-medium">
                                Se o sistema não extrair os dados, significa que este modelo ainda não foi aprendido. 
                                <strong> Envie o arquivo para o suporte</strong> para criarmos o padrão exclusivo do seu banco.
                            </p>
                        </div>
                        <button 
                            onClick={() => window.open(`https://wa.me/${systemSettings.supportNumber}?text=Olá! Preciso cadastrar um novo modelo de extrato no IdentificaPix.`, '_blank')}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95 shrink-0 border border-white/10"
                        >
                            <WhatsAppIcon className="w-4 h-4" />
                            Chamar Suporte
                        </button>
                    </div>

                    {/* PAINEL DE EXTRATOS - Ajustado para ocupar tela toda com melhor aproveitamento vertical */}
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
                        <div className="flex flex-col gap-2.5 relative z-10">
                            {banks.length > 0 ? (
                                banks.map((bank: any) => (
                                    <SmartBankCard key={bank.id} bank={bank} />
                                ))
                            ) : (
                                <div className="p-10 text-center border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-3xl">
                                    <p className="text-slate-400 text-sm font-medium">Nenhum banco cadastrado. Vá em "Cadastro" para adicionar.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-center pt-2 flex-shrink-0">
                <button 
                    onClick={handleCompare} 
                    disabled={!canProcess} 
                    className="flex items-center gap-3 px-8 py-3 text-white rounded-full shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 border border-white/20 group"
                >
                    <SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    {activeReportId ? "Atualizar Relatório" : "Processar com Inteligência"}
                </button>
            </div>
        </div>
    );
};
