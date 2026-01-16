
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, SparklesIcon, DocumentArrowDownIcon, UploadIcon, ArrowsRightLeftIcon, BoltIcon } from '../Icons';
import { ComparisonType } from '../../types';

interface InitialComparisonModalProps {
    onClose: () => void;
}

export const InitialComparisonModal: React.FC<InitialComparisonModalProps> = ({ onClose }) => {
    const { 
        similarityLevel, 
        setSimilarityLevel, 
        dayTolerance, 
        setDayTolerance,
        handleCompare,
        comparisonType,
        setComparisonType
    } = useContext(AppContext);
    
    const { t } = useTranslation();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleRun = async () => {
        setIsProcessing(true);
        // Pequeno delay para feedback visual do botão carregando
        setTimeout(async () => {
            // Chama o processamento passando os valores ATUAIS definidos no formulário
            await handleCompare(comparisonType, similarityLevel, dayTolerance);
            setIsProcessing(false);
            onClose();
        }, 100);
    };

    const TypeOption = ({ value, label, icon: Icon, colorClass }: { value: ComparisonType, label: string, icon: any, colorClass: string }) => {
        const isSelected = comparisonType === value;
        return (
            <button
                type="button"
                onClick={() => setComparisonType(value)}
                className={`
                    relative flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 gap-2
                    ${isSelected 
                        ? `bg-white dark:bg-slate-800 ${colorClass} shadow-lg transform scale-105 z-10` 
                        : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                    }
                `}
            >
                <Icon className={`w-6 h-6 ${isSelected ? '' : 'opacity-50'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isSelected ? '' : 'opacity-70'}`}>{label}</span>
                {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-current animate-pulse"></div>
                )}
            </button>
        );
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 animate-scale-in overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-brand-blue to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/30">
                            <BoltIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Configurar Conciliação</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Defina os parâmetros antes de processar.</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                    
                    {/* 1. Comparison Type */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                            {t('upload.comparisonType')}
                        </label>
                        <div className="flex gap-3">
                            <TypeOption 
                                value="income" 
                                label={t('upload.income')} 
                                icon={DocumentArrowDownIcon} 
                                colorClass="border-emerald-500 text-emerald-600 dark:text-emerald-400"
                            />
                            <TypeOption 
                                value="expenses" 
                                label={t('upload.expenses')} 
                                icon={UploadIcon} 
                                colorClass="border-rose-500 text-rose-600 dark:text-rose-400"
                            />
                            <TypeOption 
                                value="both" 
                                label={t('upload.both')} 
                                icon={ArrowsRightLeftIcon} 
                                colorClass="border-blue-500 text-blue-600 dark:text-blue-400"
                            />
                        </div>
                    </div>

                    {(comparisonType === 'income' || comparisonType === 'both') && (
                        <div className="space-y-8 animate-fade-in">
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
                                    Rigor na comparação de nomes. <strong className="text-slate-600 dark:text-slate-300">Recomendado: 55%</strong>.
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
                                    Flexibilidade para datas (fins de semana/feriados). <strong className="text-slate-600 dark:text-slate-300">Recomendado: 2 dias</strong>.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/30 px-8 py-6 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-700/50">
                    <button type="button" onClick={onClose} className="px-6 py-3 text-xs font-bold rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all uppercase tracking-wide">
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleRun} 
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-8 py-3 text-xs font-bold text-white bg-gradient-to-r from-brand-blue to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-full shadow-lg shadow-blue-500/30 hover:-translate-y-0.5 transition-all uppercase tracking-wide disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <>
                                <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Processando...
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-3.5 h-3.5" />
                                Iniciar Processamento
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
