
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
    const inputClass = "w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-400 placeholder:font-medium";
    const labelClass = "block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1";
    const sectionClass = "p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/30";

    // Componente de Toggle Segmentado (Pílula)
    const FilterTypeToggle = () => (
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-full border border-slate-200 dark:border-slate-700 w-full">
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
                        className={`flex-1 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${
                            isActive 
                            ? 'bg-white dark:bg-slate-700 text-brand-blue dark:text-white shadow-sm border border-slate-200 dark:border-slate-600' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#0B1120] rounded-[2rem] shadow-2xl w-full max-w-2xl border border-white/20 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden">
                
                {/* Header Compacto */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-xl text-brand-blue dark:text-blue-400">
                            <AdjustmentsHorizontalIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight leading-none">{t('search.filtersTitle')}</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Refine sua busca no histórico</p>
                        </div>
                    </div>
                    <button type="button" onClick={closeSearchFilters} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
                
                {/* Scrollable Content */}
                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30 dark:bg-[#0F172A]/50">
                    
                    {/* 1. Origem do Filtro (Pílula) */}
                    <div>
                        <label className={labelClass}>{t('search.filterBy')}</label>
                        <FilterTypeToggle />

                        {/* Conteúdo Condicional Compacto */}
                        <div className="mt-3 animate-fade-in">
                            {localFilters.filterBy === 'church' && (
                                <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl p-2 custom-scrollbar shadow-inner">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                        {churches.map(church => (
                                            <label key={church.id} className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border ${localFilters.churchIds.includes(church.id) ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={localFilters.churchIds.includes(church.id)}
                                                    onChange={() => setLocalFilters(prev => {
                                                        const newChurchIds = prev.churchIds.includes(church.id)
                                                            ? prev.churchIds.filter(id => id !== church.id)
                                                            : [...prev.churchIds, church.id];
                                                        return { ...prev, churchIds: newChurchIds };
                                                    })}
                                                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                                                />
                                                <span className={`ml-2 text-xs font-bold truncate ${localFilters.churchIds.includes(church.id) ? 'text-brand-blue dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>{church.name}</span>
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
                                            <input type="date" value={localFilters.dateRange.start || ''} onChange={e => setLocalFilters(p => ({...p, dateRange: {...p.dateRange, start: e.target.value || null}}))} className={`${inputClass} text-[10px] px-2`}/>
                                        </div>
                                        <span className="text-slate-400 font-bold text-[10px]">até</span>
                                        <div className="relative flex-1">
                                            <input type="date" value={localFilters.dateRange.end || ''} onChange={e => setLocalFilters(p => ({...p, dateRange: {...p.dateRange, end: e.target.value || null}}))} className={`${inputClass} text-[10px] px-2`}/>
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
                                            <input type="number" placeholder="Valor" value={localFilters.valueFilter.value1 ?? ''} onChange={e => setLocalFilters(p => ({...p, valueFilter: {...p.valueFilter, value1: e.target.value ? parseFloat(e.target.value) : null}}))} className={inputClass} />
                                        )}
                                        {localFilters.valueFilter.operator === 'between' && (
                                             <input type="number" placeholder="Max" value={localFilters.valueFilter.value2 ?? ''} onChange={e => setLocalFilters(p => ({...p, valueFilter: {...p.valueFilter, value2: e.target.value ? parseFloat(e.target.value) : null}}))} className={inputClass} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Compacto */}
                <div className="bg-white dark:bg-[#0B1120] px-6 py-4 flex justify-between items-center border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
                    <button type="button" onClick={handleClear} className="px-5 py-2.5 text-[10px] font-bold rounded-full border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors uppercase tracking-wide">
                        {t('search.clearFilters')}
                    </button>
                    <div className="flex gap-2">
                        <button type="button" onClick={closeSearchFilters} className="px-6 py-2.5 text-[10px] font-bold rounded-full border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors uppercase tracking-wide">
                            {t('common.cancel')}
                        </button>
                        <button type="button" onClick={handleApply} className="flex items-center gap-2 px-8 py-2.5 text-[10px] font-bold text-white rounded-full shadow-lg shadow-blue-500/30 hover:-translate-y-0.5 transition-all uppercase tracking-wide bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] active:scale-95">
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            {t('search.applyFilters')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
