
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { Logger } from '../../services/monitoringService';
import { 
    XMarkIcon, 
    ExclamationTriangleIcon, 
    WhatsAppIcon, 
    InformationCircleIcon,
    ShieldCheckIcon,
    CloudArrowUpIcon
} from '../Icons';

export const ModelRequiredModal: React.FC = () => {
    const { modelRequiredData, setModelRequiredData } = useContext(AppContext);
    const { systemSettings } = useAuth();
    const { t } = useTranslation();
    const { showToast } = useUI();
    const [isEnqueuing, setIsEnqueuing] = useState(false);

    if (!modelRequiredData) return null;

    const { fingerprint, fileName, preview } = modelRequiredData;

    const handleCallSupport = () => {
        const message = `Olá! Meu arquivo "${fileName}" não possui um modelo no IdentificaPix. 
DNA Estrutural: ${fingerprint?.headerHash || 'N/A'}
Preview do Conteúdo: ${preview?.substring(0, 200)}...`;
        
        window.open(`https://wa.me/${systemSettings.supportNumber}?text=${encodeURIComponent(message)}`, '_blank');
        setModelRequiredData(null);
    };

    const enqueueModel = async () => {
        setIsEnqueuing(true);
        try {
            // Simulação de envio para fila administrativa via log estruturado
            Logger.info("[ADMIN_QUEUE] Documento enfileirado para análise de modelo.", {
                fileName,
                fingerprint,
                preview: preview?.substring(0, 500)
            });
            
            showToast("Documento enviado para a fila de análise do Admin.", "success");
            
            // Pequeno delay para o usuário ler o toast antes do modal fechar
            setTimeout(() => setModelRequiredData(null), 1500);
        } catch (error) {
            showToast("Erro ao enviar para análise.", "error");
        } finally {
            setIsEnqueuing(false);
        }
    };

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal w-full max-w-lg flex flex-col animate-scale-in rounded-[2.5rem] overflow-hidden bg-white dark:bg-[#0F172A] shadow-2xl border-white/20">
                
                <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-amber-50/50 dark:bg-amber-900/10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
                            <ExclamationTriangleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                Modelo não encontrado
                            </h3>
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mt-0.5">Ação Obrigatória</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => setModelRequiredData(null)} className="p-2 rounded-full hover:bg-white dark:hover:bg-white/10 text-slate-400 transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="bg-slate-50 dark:bg-black/20 p-5 rounded-2xl border border-slate-100 dark:border-white/5">
                        <div className="flex items-start gap-3 mb-4">
                            <InformationCircleIcon className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                Este documento ainda não possui um modelo cadastrado no IdentificaPix. 
                                <br/><br/>
                                <span className="text-slate-800 dark:text-white font-bold">Para garantir a fidelidade da Lista Viva, nenhuma extração automática foi realizada.</span>
                            </p>
                        </div>
                        
                        <div className="space-y-2 font-mono text-[10px] bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                <span className="text-slate-400 uppercase">Arquivo:</span>
                                <span className="text-slate-700 dark:text-slate-200 font-bold truncate max-w-[200px]">{fileName}</span>
                            </div>
                            <div className="flex justify-between pt-1">
                                <span className="text-slate-400 uppercase">DNA (Hash):</span>
                                <span className="text-indigo-500 font-bold">{fingerprint?.headerHash || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <button 
                            onClick={enqueueModel}
                            disabled={isEnqueuing}
                            className="flex items-center justify-center gap-3 w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                        >
                            {isEnqueuing ? (
                                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <CloudArrowUpIcon className="w-5 h-5" />
                            )}
                            {isEnqueuing ? 'Enviando...' : 'Enviar para fila do Admin'}
                        </button>

                        <button 
                            onClick={handleCallSupport}
                            className="flex items-center justify-center gap-3 w-full py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all"
                        >
                            <WhatsAppIcon className="w-4 h-4" />
                            Enviar para suporte
                        </button>
                    </div>
                </div>

                <div className="px-8 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 text-center">
                    <button 
                        onClick={() => setModelRequiredData(null)}
                        className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
