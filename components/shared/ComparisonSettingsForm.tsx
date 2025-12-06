
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { ArrowsRightLeftIcon } from '../Icons';
import { ComparisonType } from '../../types';

export const ComparisonSettingsForm: React.FC = () => {
    const { 
        similarityLevel, 
        setSimilarityLevel, 
        dayTolerance, 
        setDayTolerance, 
        handleCompare, 
        isCompareDisabled,
        comparisonType,
        setComparisonType,
        bankStatementFile,
    } = useContext(AppContext);
    const { t, language } = useTranslation();

    const finalIsCompareDisabled = comparisonType === 'income' ? isCompareDisabled : !bankStatementFile;

    const ComparisonOption = ({ value, label }: { value: ComparisonType, label: string }) => {
        const isSelected = comparisonType === value;
        return (
            <label 
                className={`cursor-pointer relative flex-1 flex items-center justify-center py-2 px-3 text-xs font-bold rounded-xl transition-all duration-300 z-10 ${
                    isSelected 
                        ? 'text-white shadow-lg shadow-indigo-500/25 transform scale-[1.02]' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
            >
                {/* Active Background */}
                {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl -z-10 animate-fade-in"></div>
                )}
                
                <input 
                    type="radio" 
                    name="comparisonType" 
                    value={value} 
                    checked={isSelected} 
                    onChange={(e) => setComparisonType(e.target.value as ComparisonType)} 
                    className="sr-only" 
                />
                {label}
            </label>
        );
    }

    return (
        <div className="animate-fade-in flex flex-col gap-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                
                {/* Left: Type Selection (Pill Style) */}
                <div className="flex items-center w-full md:w-auto">
                    <div className="p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl flex w-full md:w-[320px] shadow-inner border border-slate-200 dark:border-slate-700/50">
                        <ComparisonOption value="income" label={t('upload.income')} />
                        <ComparisonOption value="expenses" label={t('upload.expenses')} />
                        <ComparisonOption value="both" label={t('upload.both')} />
                    </div>
                </div>

                {/* Middle: Sliders (Refined) */}
                { (comparisonType === 'income' || comparisonType === 'both') && (
                    <div className="hidden lg:flex items-center gap-8 flex-1 px-6 border-l border-r border-slate-200/60 dark:border-slate-700/50">
                        
                        {/* Similarity Slider */}
                        <div className="flex flex-col w-full max-w-[160px] group">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                <span>{t('settings.similarityLevel')}</span>
                                <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 rounded">{similarityLevel}%</span>
                            </div>
                            <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${similarityLevel}%` }}></div>
                                <input 
                                    type="range" min="10" max="100" value={similarityLevel} 
                                    onChange={e => setSimilarityLevel(parseInt(e.target.value, 10))} 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                />
                            </div>
                        </div>

                        {/* Tolerance Slider */}
                        <div className="flex flex-col w-full max-w-[160px] group">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                <span>{t('settings.dayTolerance')}</span>
                                <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 rounded">{dayTolerance} {language === 'pt' ? 'dias' : language === 'es' ? 'días' : 'days'}</span>
                            </div>
                            <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${(dayTolerance / 30) * 100}%` }}></div>
                                <input 
                                    type="range" min="0" max="30" value={dayTolerance} 
                                    onChange={e => setDayTolerance(parseInt(e.target.value, 10))} 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Right: Action Button */}
                <button 
                    onClick={handleCompare} 
                    disabled={finalIsCompareDisabled} 
                    className="w-full md:w-auto px-8 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/30 transform hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2 group"
                >
                    <ArrowsRightLeftIcon className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500"/>
                    <span className="tracking-wide">{t('settings.startComparison')}</span>
                </button>
            </div>

            {/* Mobile Sliders Fallback */}
            { (comparisonType === 'income' || comparisonType === 'both') && (
                <div className="flex lg:hidden flex-col gap-3 px-1 mt-1">
                     <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-500 w-24">{t('settings.similarityLevel')}: <span className="text-indigo-600">{similarityLevel}%</span></span>
                        <input type="range" min="10" max="100" value={similarityLevel} onChange={e => setSimilarityLevel(parseInt(e.target.value, 10))} className="flex-1 h-1.5 bg-slate-200 rounded-full accent-indigo-600" />
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-500 w-24">{t('settings.dayTolerance')}: <span className="text-blue-600">{dayTolerance}d</span></span>
                        <input type="range" min="0" max="30" value={dayTolerance} onChange={e => setDayTolerance(parseInt(e.target.value, 10))} className="flex-1 h-1.5 bg-slate-200 rounded-full accent-blue-600" />
                    </div>
                </div>
            )}

            {finalIsCompareDisabled && (
                <div className="text-center mt-1">
                    <span className="text-[10px] font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full border border-red-100 dark:border-red-900/50 animate-pulse">
                        {t('settings.startComparisonError')}
                    </span>
                </div>
            )}
        </div>
    );
};
