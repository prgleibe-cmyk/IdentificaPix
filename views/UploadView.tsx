
import React, { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { BanknotesIcon, SparklesIcon, InformationCircleIcon, WhatsAppIcon, ShieldCheckIcon } from '../components/Icons';
import { SmartBankCard } from '../components/upload/SmartBankCard';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';

/**
 * UPLOAD VIEW (V9 - DESIGN REFINADO)
 * Removidas funcionalidades de Gmail e SMS (Fase de Homologação)
 */
export const UploadView: React.FC = () => {
    const { 
        banks, activeReportId, selectedBankIds, handleCompare
    } = useContext(AppContext);
    const { systemSettings } = useAuth();
    const { setActiveView } = useUI();
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
                            className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-black uppercase text-[9px] tracking-widest shadow-md transition-all active:scale-95 border border-white/10"
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
