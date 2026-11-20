
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, ArrowPathIcon, SparklesIcon } from '../Icons';

export const RecompareModal: React.FC = () => {
    const { 
        isRecompareModalOpen, 
        closeRecompareModal, 
        similarityLevel, 
        setSimilarityLevel, 
        dayTolerance, 
        setDayTolerance,
        handleCompare
    } = useContext(AppContext);
    
    const { t } = useTranslation();
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isRecompareModalOpen) return null;

    const handleRun = async () => {
        setIsProcessing(true);
        // Pequeno delay para a UI atualizar antes do processamento pesado
        setTimeout(async () => {
            await handleCompare();
            setIsProcessing(false);
            closeRecompareModal();
        }, 100);
    };

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal animate-scale-in">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 rounded-lg text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-center">
                            <ArrowPathIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Refazer Identificação</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Reajuste os parâmetros e compare novamente.</p>
                        </div>
                    </div>
                    <button type="button" onClick={closeRecompareModal} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    
                    {/* Similarity Slider */}
                    <div className="space-y-2.5">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.similarityLevel')}
                            </label>
                            <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-md border border-orange-200/70 dark:border-orange-800/60 tabular-nums">
                                {similarityLevel}%
                            </span>
                        </div>
                        <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                            <div className="absolute top-0 left-0 h-full bg-orange-600 rounded-full transition-all duration-150" style={{ width: `${similarityLevel}%` }}></div>
                            <input 
                                type="range" 
                                min="10" 
                                max="100" 
                                value={similarityLevel} 
                                onChange={e => setSimilarityLevel(parseInt(e.target.value, 10))} 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            Define o quão rigoroso o sistema deve ser ao comparar nomes. Valores mais altos exigem nomes quase idênticos.
                        </p>
                    </div>

                    {/* Tolerance Slider */}
                    <div className="space-y-2.5">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.dayTolerance')}
                            </label>
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/70 dark:border-amber-800/60 tabular-nums">
                                {dayTolerance} dias
                            </span>
                        </div>
                        <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                            <div className="absolute top-0 left-0 h-full bg-amber-500 rounded-full transition-all duration-150" style={{ width: `${(dayTolerance / 30) * 100}%` }}></div>
                            <input 
                                type="range" 
                                min="0" 
                                max="30" 
                                value={dayTolerance} 
                                onChange={e => setDayTolerance(parseInt(e.target.value, 10))} 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            Flexibilidade para datas de transação diferentes da data na lista (útil para fins de semana).
                        </p>
                    </div>

                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 rounded-xl flex gap-3 items-start">
                        <SparklesIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-snug">
                            <strong>Atenção:</strong> Ao reprocessar, as identificações automáticas serão refeitas baseadas nos novos parâmetros. Identificações manuais serão preservadas se possível.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50/70 dark:bg-slate-900 px-6 py-4 flex justify-end space-x-2.5 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
                    <button type="button" onClick={closeRecompareModal} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer">
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleRun} 
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <>
                                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Processando...
                            </>
                        ) : (
                            <>
                                <ArrowPathIcon className="w-4 h-4" />
                                Comparar Novamente
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
