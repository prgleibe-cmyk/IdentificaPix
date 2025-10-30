import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { SearchFilters } from '../../types';
import { XMarkIcon } from '../Icons';

// Valores padrão seguros para searchFilters
const initialSearchFilters: SearchFilters = {
    filterBy: 'none',
    churchIds: [],
    contributorName: '',
    transactionType: 'all',
    reconciliationStatus: 'all',
    dateRange: { start: null, end: null },
    valueFilter: { operator: 'any', value1: null, value2: null },
};

export const SearchFiltersModal: React.FC = () => {
    const { 
        isSearchFiltersOpen, 
        closeSearchFilters, 
        setSearchFilters,
        clearSearchFilters,
        searchFilters: currentFilters,
        churches
    } = useContext(AppContext);
    
    const { t } = useTranslation();

    // Inicializa localFilters garantindo valores padrão
    const [localFilters, setLocalFilters] = useState<SearchFilters>({
        ...initialSearchFilters,
        ...currentFilters
    });

    // Sincroniza localFilters sempre que modal abre ou currentFilters mudam
    useEffect(() => {
        setLocalFilters({
            ...initialSearchFilters,
            ...currentFilters
        });
    }, [isSearchFiltersOpen, currentFilters]);

    if (!isSearchFiltersOpen) return null;

    const handleApply = () => {
        setSearchFilters(localFilters);
        closeSearchFilters();
    };

    const handleClear = () => {
        clearSearchFilters();
        closeSearchFilters();
    }

    const handleFilterTypeChange = (type: 'none' | 'church' | 'contributor') => {
        setLocalFilters(prev => {
            const newFilters = { ...prev, filterBy: type };
            if (type !== 'church') newFilters.churchIds = [];
            if (type !== 'contributor') newFilters.contributorName = '';
            return newFilters;
        });
    };

    const commonInputClass = "mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400";
    const radioCheckboxClass = "h-4 w-4 border-slate-300 dark:border-slate-600 text-blue-700 focus:ring-blue-600";

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6 border-b dark:border-slate-700 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('search.filtersTitle')}</h3>
                    <button type="button" onClick={closeSearchFilters} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Main Filter Type */}
                    <fieldset>
                        <legend className="text-base font-medium text-slate-900 dark:text-slate-100">{t('search.filterBy')}</legend>
                        <div className="mt-2 flex items-center gap-x-6">
                            <div className="flex items-center">
                                <input id="filter-by-none" type="radio" value="none" checked={localFilters.filterBy === 'none'} onChange={() => handleFilterTypeChange('none')} className={radioCheckboxClass} />
                                <label htmlFor="filter-by-none" className="ml-2 block text-sm text-gray-900 dark:text-slate-200">{t('search.filterBy.none')}</label>
                            </div>
                            <div className="flex items-center">
                                <input id="filter-by-church" type="radio" value="church" checked={localFilters.filterBy === 'church'} onChange={() => handleFilterTypeChange('church')} className={radioCheckboxClass} />
                                <label htmlFor="filter-by-church" className="ml-2 block text-sm text-gray-900 dark:text-slate-200">{t('search.filterBy.church')}</label>
                            </div>
                            <div className="flex items-center">
                                <input id="filter-by-contributor" type="radio" value="contributor" checked={localFilters.filterBy === 'contributor'} onChange={() => handleFilterTypeChange('contributor')} className={radioCheckboxClass} />
                                <label htmlFor="filter-by-contributor" className="ml-2 block text-sm text-gray-900 dark:text-slate-200">{t('search.filterBy.contributor')}</label>
                            </div>
                        </div>
                    </fieldset>

                    {/* Conditional Fields */}
                    {localFilters.filterBy === 'church' && (
                        <fieldset>
                            <div className="space-y-2 max-h-32 overflow-y-auto border p-2 rounded-md dark:border-slate-700">
                               {churches.map(church => (
                                    <div key={church.id} className="flex items-center">
                                        <input
                                            id={`church-${church.id}`}
                                            type="checkbox"
                                            checked={localFilters.churchIds.includes(church.id)}
                                            onChange={() => setLocalFilters(prev => {
                                                const newChurchIds = prev.churchIds.includes(church.id)
                                                    ? prev.churchIds.filter(id => id !== church.id)
                                                    : [...prev.churchIds, church.id];
                                                return { ...prev, churchIds: newChurchIds };
                                            })}
                                            className={`${radioCheckboxClass} rounded`}
                                        />
                                        <label htmlFor={`church-${church.id}`} className="ml-2 text-sm text-gray-900 dark:text-slate-200">{church.name}</label>
                                    </div>
                               ))}
                            </div>
                        </fieldset>
                    )}
                    {localFilters.filterBy === 'contributor' && (
                        <fieldset>
                            <div className="mt-2">
                                <input type="text" placeholder={t('search.filterByContributorPlaceholder')} value={localFilters.contributorName} onChange={(e) => setLocalFilters(p => ({...p, contributorName: e.target.value}))} className={commonInputClass}/>
                            </div>
                        </fieldset>
                    )}

                    {/* Transaction Type */}
                    <fieldset>
                        <legend className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('search.filterByTransactionType')}</legend>
                        <div className="mt-2">
                            <select value={localFilters.transactionType} onChange={e => setLocalFilters(p => ({...p, transactionType: e.target.value as any}))} className={commonInputClass}>
                                <option value="all">{t('search.type.all')}</option>
                                <option value="income">{t('search.type.income')}</option>
                                <option value="expenses">{t('search.type.expenses')}</option>
                            </select>
                        </div>
                    </fieldset>

                    {/* Reconciliation Status */}
                    <fieldset>
                        <legend className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('search.filterByReconciliationStatus')}</legend>
                        <div className="mt-2">
                             <select value={localFilters.reconciliationStatus} onChange={e => setLocalFilters(p => ({...p, reconciliationStatus: e.target.value as any}))} className={commonInputClass}>
                                <option value="all">{t('search.status.all')}</option>
                                <option value="confirmed_any">{t('search.status.confirmed_any')}</option>
                                <option value="confirmed_auto">{t('search.status.confirmed_auto')}</option>
                                <option value="confirmed_manual">{t('search.status.confirmed_manual')}</option>
                                <option value="unconfirmed">{t('search.status.unconfirmed')}</option>
                            </select>
                        </div>
                    </fieldset>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Date Range */}
                        <fieldset>
                            <legend className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('search.filterByDate')}</legend>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                <div>
                                    <label htmlFor="start-date" className="sr-only">{t('search.from')}</label>
                                    <input type="date" id="start-date" value={localFilters.dateRange.start || ''} onChange={e => setLocalFilters(p => ({...p, dateRange: {...p.dateRange, start: e.target.value || null}}))} className={commonInputClass}/>
                                </div>
                                <div>
                                    <label htmlFor="end-date" className="sr-only">{t('search.to')}</label>
                                    <input type="date" id="end-date" value={localFilters.dateRange.end || ''} onChange={e => setLocalFilters(p => ({...p, dateRange: {...p.dateRange, end: e.target.value || null}}))} className={commonInputClass}/>
                                </div>
                            </div>
                        </fieldset>

                        {/* Value Filter */}
                        <fieldset>
                            <legend className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('search.transactionValue')}</legend>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                <select value={localFilters.valueFilter.operator} onChange={e => setLocalFilters(p => ({...p, valueFilter: {...p.valueFilter, operator: e.target.value as any}}))} className={commonInputClass}>
                                    <option value="any">{t('search.valueOperator.any')}</option>
                                    <option value="exact">{t('search.valueOperator.exact')}</option>
                                    <option value="gt">{t('search.valueOperator.gt')}</option>
                                    <option value="lt">{t('search.valueOperator.lt')}</option>
                                    <option value="between">{t('search.valueOperator.between')}</option>
                                </select>
                                
                                <div className="flex items-center gap-2">
                                    {(localFilters.valueFilter.operator === 'exact' || localFilters.valueFilter.operator === 'gt' || localFilters.valueFilter.operator === 'lt') && (
                                        <div className="flex-1">
                                            <label htmlFor="value1" className="sr-only">{t('search.valueLabel')}</label>
                                            <input type="number" id="value1" placeholder={t('search.valueLabel')} value={localFilters.valueFilter.value1 ?? ''} onChange={e => setLocalFilters(p => ({...p, valueFilter: {...p.valueFilter, value1: e.target.value ? parseFloat(e.target.value) : null}}))} className={commonInputClass} />
                                        </div>
                                    )}
                                    {localFilters.valueFilter.operator === 'between' && (
                                        <>
                                            <div className="flex-1">
                                                <label htmlFor="value1" className="sr-only">{t('search.minValueLabel')}</label>
                                                <input type="number" id="value1" placeholder={t('search.minValueLabel')} value={localFilters.valueFilter.value1 ?? ''} onChange={e => setLocalFilters(p => ({...p, valueFilter: {...p.valueFilter, value1: e.target.value ? parseFloat(e.target.value) : null}}))} className={commonInputClass} />
                                            </div>
                                            <div className="flex-1">
                                                <label htmlFor="value2" className="sr-only">{t('search.maxValueLabel')}</label>
                                                <input type="number" id="value2" placeholder={t('search.maxValueLabel')} value={localFilters.valueFilter.value2 ?? ''} onChange={e => setLocalFilters(p => ({...p, valueFilter: {...p.valueFilter, value2: e.target.value ? parseFloat(e.target.value) : null}}))} className={commonInputClass} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </fieldset>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-between items-center">
                    <button type="button" onClick={handleClear} className="px-4 py-2 text-sm font-medium rounded-md border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">{t('search.clearFilters')}</button>
                    <div className="flex gap-2">
                        <button type="button" onClick={closeSearchFilters} className="px-4 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">{t('common.cancel')}</button>
                        <button type="button" onClick={handleApply} className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md">{t('search.applyFilters')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
