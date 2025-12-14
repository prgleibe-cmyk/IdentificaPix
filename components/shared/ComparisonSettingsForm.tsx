
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { ArrowsRightLeftIcon, DocumentArrowDownIcon, UploadIcon } from '../Icons';
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

    const ComparisonOption = ({ value, label, colorTheme, icon: Icon }: { value: ComparisonType, label: string, colorTheme: 'emerald' | 'rose' | 'blue', icon: any }) => {
        const isSelected = comparisonType === value;
        
        const themes = {
            emerald: { // Entradas (Green)
                active: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
                inactive: 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/10'
            },
            rose: { // Saídas (Red/Rose)
                active: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30',
                inactive: 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-300 dark:hover:bg-rose-500/10'
            },
            blue: { // Ambos (Blue)
                active: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
                inactive: 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-300 dark:hover:bg-blue-500/10'
            }
        };

        const style = themes[colorTheme];

        return (
            <label 
                className={`
                    cursor-pointer relative flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-full transition-all duration-200 border
                    ${isSelected 
                        ? `${style.active} shadow-sm` 
                        : `bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 ${style.inactive}`
                    }
                `}
            >
                <Icon className={`w-3 h-3 ${isSelected ? '' : 'opacity-70'}`} />
                <input 
                    type="radio" 
                    name="comparisonType" 
                    value={value} 
                    checked={isSelected} 
                    onChange={(e) => setComparisonType(e.target.value as ComparisonType)} 
                    className="sr-only" 
                />
                <span className="uppercase tracking-wide">{label}</span>
            </label>
        );
    }

    return (
        <div className="animate-fade-in flex flex-col lg:flex-row items-center justify-between gap-3 w-full">
            
            {/* Left: Type Selection (Soft Pill Buttons) */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <ComparisonOption 
                    value="income" 
                    label={t('upload.income')} 
                    colorTheme="emerald" 
                    icon={DocumentArrowDownIcon} 
                />
                <ComparisonOption 
                    value="expenses" 
                    label={t('upload.expenses')} 
                    colorTheme="rose" 
                    icon={UploadIcon} 
                />
                <ComparisonOption 
                    value="both" 
                    label={t('upload.both')} 
                    colorTheme="blue" 
                    icon={ArrowsRightLeftIcon} 
                />
            </div>

            {/* Middle: Sliders (Refined) */}
            { (comparisonType === 'income' || comparisonType === 'both') && (
                <div className="flex flex-1 items-center justify-center gap-6 lg:gap-10 w-full lg:w-auto px-2">
                    
                    {/* Similarity Slider */}
                    <div className="flex items-center gap-3 w-full max-w-[200px] group">
                        <span className="text-[9px] font-bold text-slate-400 uppercase w-10 text-right">Similar</span>
                        <div className="flex-1 relative h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
                            <div className="absolute top-0 left-0 h-full bg-brand-blue rounded-full transition-all duration-300" style={{ width: `${similarityLevel}%` }}></div>
                            <input 
                                type="range" min="10" max="100" value={similarityLevel} 
                                onChange={e => setSimilarityLevel(parseInt(e.target.value, 10))} 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            />
                        </div>
                        {/* High Visibility Badge */}
                        <div className="flex items-center justify-center min-w-[3.5rem] px-2 py-1 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg shadow-sm">
                            <span className="text-xs font-black text-brand-blue dark:text-blue-400">{similarityLevel}%</span>
                        </div>
                    </div>

                    {/* Tolerance Slider */}
                    <div className="flex items-center gap-3 w-full max-w-[200px] group">
                        <span className="text-[9px] font-bold text-slate-400 uppercase w-10 text-right">Tol.</span>
                        <div className="flex-1 relative h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
                            <div className="absolute top-0 left-0 h-full bg-brand-teal rounded-full transition-all duration-300" style={{ width: `${(dayTolerance / 30) * 100}%` }}></div>
                            <input 
                                type="range" min="0" max="30" value={dayTolerance} 
                                onChange={e => setDayTolerance(parseInt(e.target.value, 10))} 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            />
                        </div>
                        {/* High Visibility Badge - Darker Text for Readability */}
                        <div className="flex items-center justify-center min-w-[3.5rem] px-2 py-1 bg-teal-100 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg shadow-sm">
                            <span className="text-xs font-black text-teal-800 dark:text-teal-300">{dayTolerance}d</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Right: Action Button */}
            <div className="flex items-center gap-2">
                {finalIsCompareDisabled && (
                    <span className="hidden lg:inline text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full animate-pulse">
                        Carregue os arquivos
                    </span>
                )}
                <button 
                    onClick={handleCompare} 
                    disabled={finalIsCompareDisabled} 
                    className="px-5 py-2 rounded-full font-bold text-xs text-white bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] active:bg-blue-700 shadow-md shadow-brand-blue/30 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2 group"
                >
                    <ArrowsRightLeftIcon className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500"/>
                    <span className="tracking-wide uppercase">Comparar</span>
                </button>
            </div>
        </div>
    );
};
