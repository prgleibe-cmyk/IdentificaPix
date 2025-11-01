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

    return (
        <>
            <div className="mb-8">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('upload.comparisonType')}</label>
                <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center">
                        <input id="type-income" name="comparisonType" type="radio" value="income" checked={comparisonType === 'income'} onChange={(e) => setComparisonType(e.target.value as ComparisonType)} className="h-4 w-4 border-gray-300 text-blue-700 focus:ring-blue-600" />
                        <label htmlFor="type-income" className="ml-2 block text-sm text-gray-900 dark:text-slate-200">{t('upload.income')}</label>
                    </div>
                    <div className="flex items-center">
                        <input id="type-expenses" name="comparisonType" type="radio" value="expenses" checked={comparisonType === 'expenses'} onChange={(e) => setComparisonType(e.target.value as ComparisonType)} className="h-4 w-4 border-gray-300 text-blue-700 focus:ring-blue-600" />
                        <label htmlFor="type-expenses" className="ml-2 block text-sm text-gray-900 dark:text-slate-200">{t('upload.expenses')}</label>
                    </div>
                    <div className="flex items-center">
                        <input id="type-both" name="comparisonType" type="radio" value="both" checked={comparisonType === 'both'} onChange={(e) => setComparisonType(e.target.value as ComparisonType)} className="h-4 w-4 border-gray-300 text-blue-700 focus:ring-blue-600" />
                        <label htmlFor="type-both" className="ml-2 block text-sm text-gray-900 dark:text-slate-200">{t('upload.both')}</label>
                    </div>
                </div>
            </div>

            { (comparisonType === 'income' || comparisonType === 'both') && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div>
                        <label htmlFor="similarity" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.similarityLevel')}</label>
                        <input id="similarity" type="range" min="10" max="100" value={similarityLevel} onChange={e => setSimilarityLevel(parseInt(e.target.value, 10))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2 dark:bg-slate-700" />
                        <div className="text-center font-bold text-slate-800 dark:text-slate-200 mt-1">{similarityLevel}%</div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('settings.similarityDesc')}</p>
                        </div>
                        <div>
                        <label htmlFor="tolerance" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.dayTolerance')}</label>
                        <input id="tolerance" type="range" min="0" max="30" value={dayTolerance} onChange={e => setDayTolerance(parseInt(e.target.value, 10))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2 dark:bg-slate-700" />
                        <div className="text-center font-bold text-slate-800 dark:text-slate-200 mt-1">{dayTolerance} {language === 'pt' ? 'dias' : language === 'es' ? 'días' : 'days'}</div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('settings.dayToleranceDesc')}</p>
                        </div>
                    </div>
                </>
            )}
            <button onClick={handleCompare} disabled={finalIsCompareDisabled} className="w-full mt-8 flex items-center justify-center space-x-2 px-6 py-3 text-sm font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
                <ArrowsRightLeftIcon className="w-5 h-5"/>
                <span>{t('settings.startComparison')}</span>
            </button>
            {finalIsCompareDisabled && <p className="text-center text-xs text-red-500 dark:text-red-400 mt-2">{t('settings.startComparisonError')}</p>}
        </>
    );
};
