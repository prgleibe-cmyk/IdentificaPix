
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
                    relative flex-1 flex items-center justify-center py-2.5 px-4 rounded-lg border transition-colors gap-2 cursor-pointer
                    ${isSelected 
                        ? `bg-white dark:bg-slate-900 ${colorClass} shadow-xs` 
                        : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }
                `}
            >
                <Icon className={`w-4 h-4 ${isSelected ? '' : 'opacity-60'}`} />
                <span className="text-xs font-semibold">{label}</span>
            </button>
        );
    };

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal animate-scale-in">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg text-orange-600 dark:text-orange-400 flex items-center justify-center">
                            <BoltIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Configurar Conciliação</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Defina os parâmetros antes de processar.</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div
                    className="p-6 overflow-y-auto custom-scrollbar space-y-6"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                >
                    
                    {/* 1. Comparison Type - Layout Horizontal Compacto */}
                    <div className="space-y-2.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {t('upload.comparisonType')}
                        </label>
                        <div className="flex gap-2.5">
                            <TypeOption 
                                value="income" 
                                label={t('upload.income')} 
                                icon={DocumentArrowDownIcon} 
                                colorClass="border-emerald-500 text-emerald-700 dark:text-emerald-400"
                            />
                            <TypeOption 
                                value="expenses" 
                                label={t('upload.expenses')} 
                                icon={UploadIcon} 
                                colorClass="border-rose-500 text-rose-700 dark:text-rose-400"
                            />
                            <TypeOption 
                                value="both" 
                                label={t('upload.both')} 
                                icon={ArrowsRightLeftIcon} 
                                colorClass="border-orange-500 text-orange-600 dark:text-orange-400"
                            />
                        </div>
                    </div>

                    {(comparisonType === 'income' || comparisonType === 'both') && (
                        <div className="space-y-6 animate-fade-in">
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
                                    Rigor na comparação de nomes. <strong className="text-slate-700 dark:text-slate-300">Recomendado: 55%</strong>.
                                </p>
                            </div>

                            {/* Tolerance Slider */}
                            <div className="space-y-2.5">
                                <div className="flex justify-between items-end">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                        {t('settings.dayTolerance')}
                                    </label>
                                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/70 dark:border-emerald-800/60 tabular-nums">
                                        {dayTolerance} dias
                                    </span>
                                </div>
                                <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                                    <div className="absolute top-0 left-0 h-full bg-emerald-600 rounded-full transition-all duration-150" style={{ width: `${(dayTolerance / 30) * 100}%` }}></div>
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
                                    Flexibilidade para datas (fins de semana/feriados). <strong className="text-slate-700 dark:text-slate-300">Recomendado: 2 dias</strong>.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50/70 dark:bg-slate-900 px-6 py-4 flex justify-end space-x-2.5 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer">
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
                                <SparklesIcon className="w-4 h-4" />
                                Iniciar Processamento
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
