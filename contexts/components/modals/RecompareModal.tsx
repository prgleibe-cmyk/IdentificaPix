
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 animate-scale-in overflow-hidden">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                            <ArrowPathIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Refazer Identificação</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Reajuste os parâmetros e compare novamente.</p>
                        </div>
                    </div>
                    <button type="button" onClick={closeRecompareModal} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-8">
                    
                    {/* Similarity Slider */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                {t('settings.similarityLevel')}
                            </label>
                            <span className="text-sm font-black text-brand-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-800">
                                {similarityLevel}%
                            </span>
                        </div>
                        <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                            <div className="absolute top-0 left-0 h-full bg-brand-blue rounded-full transition-all duration-150" style={{ width: `${similarityLevel}%` }}></div>
                            <input 
                                type="range" 
                                min="10" 
                                max="100" 
                                value={similarityLevel} 
                                onChange={e => setSimilarityLevel(parseInt(e.target.value, 10))} 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            Define o quão rigoroso o sistema deve ser ao comparar nomes. Valores mais altos exigem nomes quase idênticos.
                        </p>
                    </div>

                    {/* Tolerance Slider */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                {t('settings.dayTolerance')}
                            </label>
                            <span className="text-sm font-black text-brand-teal dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-lg border border-teal-100 dark:border-teal-800">
                                {dayTolerance} dias
                            </span>
                        </div>
                        <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                            <div className="absolute top-0 left-0 h-full bg-brand-teal rounded-full transition-all duration-150" style={{ width: `${(dayTolerance / 30) * 100}%` }}></div>
                            <input 
                                type="range" 
                                min="0" 
                                max="30" 
                                value={dayTolerance} 
                                onChange={e => setDayTolerance(parseInt(e.target.value, 10))} 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            Flexibilidade para datas de transação diferentes da data na lista (útil para fins de semana).
                        </p>
                    </div>

                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl flex gap-3 items-start">
                        <SparklesIcon className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] text-amber-800 dark:text-amber-200 leading-snug">
                            <strong>Atenção:</strong> Ao reprocessar, as identificações automáticas serão refeitas baseadas nos novos parâmetros. Identificações manuais serão preservadas se possível.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/30 px-8 py-5 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-700/50">
                    <button type="button" onClick={closeRecompareModal} className="px-5 py-2.5 text-xs font-bold rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all uppercase tracking-wide">
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleRun} 
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-full shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 transition-all uppercase tracking-wide disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <>
                                <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Processando...
                            </>
                        ) : (
                            <>
                                <ArrowPathIcon className="w-3.5 h-3.5" />
                                Comparar Novamente
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
