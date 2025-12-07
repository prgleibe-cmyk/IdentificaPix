import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { SearchFilters } from '../../types';
import { XMarkIcon } from '../Icons';

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
    const [localFilters, setLocalFilters] = useState<SearchFilters>(currentFilters);
    
    useEffect(() => {
        setLocalFilters(currentFilters);
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
            if (type !== 'church') {
                newFilters.churchIds = [];
            }
            if (type !== 'contributor') {
                newFilters.contributorName = '';
            }
            return newFilters;
        });
    };

    const commonInputClass = "mt-2 block w-full rounded-xl border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm placeholder:text-slate-400 py-2.5 transition-all";
    const radioClass = "h-4 w-4 border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600";

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]">
                <div className="p-8 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">{t('search.filtersTitle')}</h3>
                    <button type="button" onClick={closeSearchFilters} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                    {/* Main Filter Type */}
                    <div className="bg-slate-50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                        <legend className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">{t('search.filterBy')}</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                             <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${localFilters.filterBy === 'none' ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 shadow-md shadow-indigo-500/5' : 'border-transparent hover:bg-white/50 dark:hover:bg-slate-800/50'}`}>
                                <input type="radio" value="none" checked={localFilters.filterBy === 'none'} onChange={() => handleFilterTypeChange('none')} className={radioClass} />
                                <span className="ml-2.5 text-sm font-bold text-slate-700 dark:text-slate-200">{t('search.filterBy.none')}</span>
                            </label>
                            <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${localFilters.filterBy === 'church' ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 shadow-md shadow-indigo-500/5' : 'border-transparent hover:bg-white/50 dark:hover:bg-slate-800/50'}`}>
                                <input type="radio" value="church" checked={localFilters.filterBy === 'church'} onChange={() => handleFilterTypeChange('church')} className={radioClass} />
                                <span className="ml-2.5 text-sm font-bold text-slate-700 dark:text-slate-200">{t('search.filterBy.church')}</span>
                            </label>
                             <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${localFilters.filterBy === 'contributor' ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 shadow-md shadow-indigo-500/5' : 'border-transparent hover:bg-white/50 dark:hover:bg-slate-800/50'}`}>
                                <input type="radio" value="contributor" checked={localFilters.filterBy === 'contributor'} onChange={() => handleFilterTypeChange('contributor')} className={radioClass} />
                                <span className="ml-2.5 text-sm font-bold text-slate-700 dark:text-slate-200">{t('search.filterBy.contributor')}</span>
                            </label>
                        </div>

                        {/* Conditional Fields */}
                        <div className="mt-4">
                            {localFilters.filterBy === 'church' && (
                                <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl p-3 custom-scrollbar shadow-inner">
                                {churches.map(church => (
                                        <label key={church.id} className="flex items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={localFilters.churchIds.includes(church.id)}
                                                onChange={() => setLocalFilters(prev => {
                                                    const newChurchIds = prev.churchIds.includes(church.id)
                                                        ? prev.churchIds.filter(id => id !== church.id)
                                                        : [...prev.churchIds, church.id];
                                                    return { ...prev, churchIds: newChurchIds };
                                                })}
                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                                            />
                                            <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">{church.name}</span>
                                        </label>
                                ))}
                                </div>
                            )}
                            {localFilters.filterBy === 'contributor' && (
                                <input type="text" placeholder={t('search.filterByContributorPlaceholder')} value={localFilters.contributorName} onChange={(e) => setLocalFilters(p => ({...p, contributorName: e.target.value}))} className={commonInputClass}/>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Transaction Type */}
                         <div>
                            <legend className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('search.filterByTransactionType')}</legend>
                            <select value={localFilters.transactionType} onChange={e => setLocalFilters(p => ({...p, transactionType: e.target.value as any}))} className={commonInputClass}>
                                <option value="all">{t('search.type.all')}</option>
                                <option value="income">{t('search.type.income')}</option>
                                <option value="expenses">{t('search.type.expenses')}</option>
                            </select>
                        </div>

                        {/* Reconciliation Status */}
                        <div>
                            <legend className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('search.filterByReconciliationStatus')}</legend>
                             <select value={localFilters.reconciliationStatus} onChange={e => setLocalFilters(p => ({...p, reconciliationStatus: e.target.value as any}))} className={commonInputClass}>
                                <option value="all">{t('search.status.all')}</option>
                                <option value="confirmed_any">{t('search.status.confirmed_any')}</option>
                                <option value="confirmed_auto">{t('search.status.confirmed_auto')}</option>
                                <option value="confirmed_manual">{t('search.status.confirmed_manual')}</option>
                                <option value="unconfirmed">{t('search.status.unconfirmed')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700/50 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Date Range */}
                            <div>
                                <legend className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('search.filterByDate')}</legend>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <input type="date" value={localFilters.dateRange.start || ''} onChange={e => setLocalFilters(p => ({...p, dateRange: {...p.dateRange, start: e.target.value || null}}))} className={commonInputClass}/>
                                    </div>
                                     <div>
                                        <input type="date" value={localFilters.dateRange.end || ''} onChange={e => setLocalFilters(p => ({...p, dateRange: {...p.dateRange, end: e.target.value || null}}))} className={commonInputClass}/>
                                    </div>
                                </div>
                            </div>

                            {/* Value Filter */}
                            <div>
                                <legend className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('search.transactionValue')}</legend>
                                <div className="space-y-3">
                                    <select value={localFilters.valueFilter.operator} onChange={e => setLocalFilters(p => ({...p, valueFilter: {...p.valueFilter, operator: e.target.value as any}}))} className={commonInputClass}>
                                        <option value="any">{t('search.valueOperator.any')}</option>
                                        <option value="exact">{t('search.valueOperator.exact')}</option>
                                        <option value="gt">{t('search.valueOperator.gt')}</option>
                                        <option value="lt">{t('search.valueOperator.lt')}</option>
                                        <option value="between">{t('search.valueOperator.between')}</option>
                                    </select>
                                    
                                    <div className="flex items-center gap-2">
                                        {(localFilters.valueFilter.operator !== 'any') && (
                                            <div className="flex-1">
                                                <input type="number" placeholder={t('search.valueLabel')} value={localFilters.valueFilter.value1 ?? ''} onChange={e => setLocalFilters(p => ({...p, valueFilter: {...p.valueFilter, value1: e.target.value ? parseFloat(e.target.value) : null}}))} className={commonInputClass} style={{marginTop: 0}} />
                                            </div>
                                        )}
                                        {localFilters.valueFilter.operator === 'between' && (
                                             <div className="flex-1">
                                                <input type="number" placeholder={t('search.maxValueLabel')} value={localFilters.valueFilter.value2 ?? ''} onChange={e => setLocalFilters(p => ({...p, valueFilter: {...p.valueFilter, value2: e.target.value ? parseFloat(e.target.value) : null}}))} className={commonInputClass} style={{marginTop: 0}} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-between items-center rounded-b-2xl border-t border-slate-100 dark:border-slate-700/50 flex-shrink-0">
                    <button type="button" onClick={handleClear} className="px-5 py-2.5 text-sm font-bold rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors">{t('search.clearFilters')}</button>
                    <div className="flex gap-3">
                        <button type="button" onClick={closeSearchFilters} className="px-5 py-2.5 text-sm font-bold rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors">{t('common.cancel')}</button>
                        <button type="button" onClick={handleApply} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 transition-all">{t('search.applyFilters')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};