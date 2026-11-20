
import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { SearchFilters } from '../../types';
import { XMarkIcon, AdjustmentsHorizontalIcon, CalendarIcon, DollarSignIcon, BuildingOfficeIcon, UserIcon, CheckCircleIcon } from '../Icons';

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

    // Estilos Otimizados e Compactos
    const inputClass = "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500 outline-none transition-colors placeholder:text-slate-400";
    const labelClass = "block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5";
    const sectionClass = "p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs";

    // Componente de Toggle Segmentado
    const FilterTypeToggle = () => (
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700 w-full gap-1">
            {[
                { id: 'none', label: t('search.filterBy.none') },
                { id: 'church', label: t('search.filterBy.church') },
                { id: 'contributor', label: t('search.filterBy.contributor') }
            ].map((option) => {
                const isActive = localFilters.filterBy === option.id;
                return (
                    <button
                        key={option.id}
                        onClick={() => handleFilterTypeChange(option.id as any)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                            isActive 
                            ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs border border-slate-200/80 dark:border-slate-700' 
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="glass-overlay">
            <div className="glass-modal animate-fade-in">
                
                {/* Header Compacto */}
                <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg text-orange-600 dark:text-orange-400 flex items-center justify-center">
                            <AdjustmentsHorizontalIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-none">{t('search.filtersTitle')}</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">Refine sua busca no histórico</p>
                        </div>
                    </div>
                    <button type="button" onClick={closeSearchFilters} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
                
                {/* Scrollable Content */}
                <div
                    className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/40 dark:bg-slate-950/40"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                >
                    
                    {/* 1. Origem do Filtro */}
                    <div>
                        <label className={labelClass}>{t('search.filterBy')}</label>
                        <FilterTypeToggle />

                        {/* Conteúdo Condicional Compacto */}
                        <div className="mt-3 animate-fade-in">
                            {localFilters.filterBy === 'church' && (
                                <div
                                    className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl p-2 custom-scrollbar shadow-xs"
                                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                        {churches.map(church => (
                                            <label key={church.id} className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border ${localFilters.churchIds.includes(church.id) ? 'bg-orange-50/80 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={localFilters.churchIds.includes(church.id)}
                                                    onChange={() => setLocalFilters(prev => {
                                                        const newChurchIds = prev.churchIds.includes(church.id)
                                                            ? prev.churchIds.filter(id => id !== church.id)
                                                            : [...prev.churchIds, church.id];
                                                        return { ...prev, churchIds: newChurchIds };
                                                    })}
                                                    className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                                />
                                                <span className={`ml-2 text-xs font-medium truncate ${localFilters.churchIds.includes(church.id) ? 'text-orange-700 dark:text-orange-300' : 'text-slate-700 dark:text-slate-300'}`}>{church.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {localFilters.filterBy === 'contributor' && (
                                <div className="relative">
                                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input 
                                        type="text" 
                                        placeholder={t('search.filterByContributorPlaceholder')} 
                                        value={localFilters.contributorName} 
                                        onChange={(e) => setLocalFilters(p => ({...p, contributorName: e.target.value}))} 
                                        className={`${inputClass} pl-9`}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. Grid de Configurações */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         
                         {/* Tipo e Status */}
                         <div className={sectionClass}>
                            <div className="space-y-3">
                                <div>
                                    <label className={labelClass}>{t('search.filterByTransactionType')}</label>
                                    <select value={localFilters.transactionType} onChange={e => setLocalFilters(p => ({...p, transactionType: e.target.value as any}))} className={inputClass}>
                                        <option value="all">{t('search.type.all')}</option>
                                        <option value="income">{t('search.type.income')}</option>
                                        <option value="expenses">{t('search.type.expenses')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>{t('search.filterByReconciliationStatus')}</label>
                                     <select value={localFilters.reconciliationStatus} onChange={e => setLocalFilters(p => ({...p, reconciliationStatus: e.target.value as any}))} className={inputClass}>
                                        <option value="all">{t('search.status.all')}</option>
                                        <option value="confirmed_any">{t('search.status.confirmed_any')}</option>
                                        <option value="confirmed_auto">{t('search.status.confirmed_auto')}</option>
                                        <option value="confirmed_manual">{t('search.status.confirmed_manual')}</option>
                                        <option value="unconfirmed">{t('search.status.unconfirmed')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Data e Valores */}
                        <div className={sectionClass}>
                            <div className="space-y-3">
                                <div>
                                    <label className={labelClass}>{t('search.filterByDate')}</label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <input type="date" value={localFilters.dateRange.start || ''} onChange={e => setLocalFilters(p => ({...p, dateRange: {...p.dateRange, start: e.target.value || null}}))} className={`${inputClass} text-[11px] px-2 tabular-nums`}/>
                                        </div>
                                        <span className="text-slate-400 font-medium text-[11px]">até</span>
                                        <div className="relative flex-1">
                                            <input type="date" value={localFilters.dateRange.end || ''} onChange={e => setLocalFilters(p => ({...p, dateRange: {...p.dateRange, end: e.target.value || null}}))} className={`${inputClass} text-[11px] px-2 tabular-nums`}/>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>{t('search.transactionValue')}</label>
                                    <div className="flex gap-2">
                                        <select value={localFilters.valueFilter.operator} onChange={e => setLocalFilters(p => ({...p, valueFilter: {...p.valueFilter, operator: e.target.value as any}}))} className={`${inputClass} w-24`}>
                                            <option value="any">Qualquer</option>
                                            <option value="exact">=</option>
                                            <option value="gt">&gt;</option>
                                            <option value="lt">&lt;</option>
                                            <option value="between">Entre</option>
                                        </select>
                                        
                                        {(localFilters.valueFilter.operator !== 'any') && (
                                            <input type="number" placeholder="Valor" value={localFilters.valueFilter.value1 ?? ''} onChange={e => setLocalFilters(p => ({...p, valueFilter: {...p.valueFilter, value1: e.target.value ? parseFloat(e.target.value) : null}}))} className={`${inputClass} tabular-nums`} />
                                        )}
                                        {localFilters.valueFilter.operator === 'between' && (
                                             <input type="number" placeholder="Max" value={localFilters.valueFilter.value2 ?? ''} onChange={e => setLocalFilters(p => ({...p, valueFilter: {...p.valueFilter, value2: e.target.value ? parseFloat(e.target.value) : null}}))} className={`${inputClass} tabular-nums`} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Compacto */}
                <div className="bg-slate-50/70 dark:bg-slate-900 px-6 py-4 flex justify-between items-center border-t border-slate-200/80 dark:border-slate-800 flex-shrink-0">
                    <button type="button" onClick={handleClear} className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        {t('search.clearFilters')}
                    </button>
                    <div className="flex gap-2.5">
                        <button type="button" onClick={closeSearchFilters} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer">
                            {t('common.cancel')}
                        </button>
                        <button type="button" onClick={handleApply} className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-colors cursor-pointer">
                            <CheckCircleIcon className="w-4 h-4" />
                            {t('search.applyFilters')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
