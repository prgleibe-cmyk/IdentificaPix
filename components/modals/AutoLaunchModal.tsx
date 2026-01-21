
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, BoltIcon, BrainIcon, PlayCircleIcon, ShieldCheckIcon, CheckBadgeIcon } from '../Icons';

export const AutoLaunchModal: React.FC = () => {
    const { autoLaunchTarget, closeAutoLaunch, churches } = useContext(AppContext);
    const { t } = useTranslation();
    const [step, setStep] = useState<'choice' | 'teaching' | 'executing'>('choice');

    if (!autoLaunchTarget) return null;

    const startTeaching = () => {
        window.postMessage({ source: "IdentificaPixIA", type: "START_TRAINING", payload: { bankName: "Manual" } }, "*");
        setStep('teaching');
    };

    const startExecution = () => {
        setStep('executing');
        // Lógica de envio em lote para a extensão
        autoLaunchTarget.forEach((item: any, index: number) => {
            setTimeout(() => {
                window.postMessage({ 
                    source: "IdentificaPixIA", 
                    type: "EXECUTE_ITEM", 
                    payload: { 
                        id: item.transaction.id,
                        date: item.transaction.date,
                        name: item.contributor?.name || item.transaction.description,
                        amount: item.transaction.amount
                    } 
                }, "*");
            }, index * 1500);
        });
    };

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal w-full max-w-lg rounded-[2.5rem] animate-scale-in">
                <div className="px-8 py-6 glass-header flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-500/30">
                            <BoltIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">Lançamento Automático</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Executor de Terceiros via Extensão</p>
                        </div>
                    </div>
                    <button onClick={closeAutoLaunch} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8">
                    {step === 'choice' && (
                        <div className="grid grid-cols-1 gap-4">
                            <button 
                                onClick={startTeaching}
                                className="flex items-center gap-5 p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl hover:border-brand-blue hover:bg-blue-50/50 transition-all text-left group"
                            >
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                                    <BrainIcon className="w-8 h-8 text-purple-600" />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 dark:text-white uppercase text-sm">1. Ensinar novo percurso</h4>
                                    <p className="text-xs text-slate-500 mt-1">Grave as ações (cliques e campos) no seu sistema financeiro.</p>
                                </div>
                            </button>

                            <button 
                                onClick={startExecution}
                                className="flex items-center gap-5 p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group"
                            >
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                                    <PlayCircleIcon className="w-8 h-8 text-emerald-600" />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 dark:text-white uppercase text-sm">2. Executar Automático</h4>
                                    <p className="text-xs text-slate-500 mt-1">Lançar os {autoLaunchTarget.length} registros selecionados agora.</p>
                                </div>
                            </button>
                        </div>
                    )}

                    {step === 'teaching' && (
                        <div className="text-center py-6 space-y-6">
                            <div className="relative w-20 h-20 mx-auto">
                                <div className="absolute inset-0 bg-purple-500/20 rounded-full animate-ping"></div>
                                <div className="relative bg-purple-600 text-white p-5 rounded-full shadow-xl">
                                    <BrainIcon className="w-10 h-10" />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-slate-800 dark:text-white uppercase">Gravando Percurso...</h4>
                                <p className="text-sm text-slate-500 mt-2 px-8">Acesse seu sistema financeiro e realize um lançamento completo. A extensão está capturando seus passos.</p>
                            </div>
                            <button 
                                onClick={() => {
                                    window.postMessage({ source: "IdentificaPixIA", type: "STOP_TRAINING" }, "*");
                                    closeAutoLaunch();
                                }}
                                className="px-10 py-3 bg-slate-800 text-white rounded-full font-black uppercase text-xs tracking-widest shadow-xl"
                            >
                                Finalizar e Salvar
                            </button>
                        </div>
                    )}

                    {step === 'executing' && (
                        <div className="text-center py-6 space-y-6">
                            <div className="relative w-20 h-20 mx-auto">
                                <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full border-t-emerald-500 animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <BoltIcon className="w-8 h-8 text-emerald-600" />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-slate-800 dark:text-white uppercase">Processando Lote...</h4>
                                <p className="text-sm text-slate-500 mt-2">Mantenha a aba do seu sistema financeiro aberta.</p>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full animate-[progress_10s_ease-in-out]"></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
