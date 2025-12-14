
import React, { useContext, useState, useMemo, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { ResultsTable } from '../components/ResultsTable';
import { EmptyState } from '../components/EmptyState';
import { SearchIcon, AdjustmentsHorizontalIcon, PrinterIcon, FloppyDiskIcon, CheckCircleIcon, XCircleIcon, CircleStackIcon, XMarkIcon } from '../components/Icons';
import { filterByUniversalQuery, parseDate, normalizeString } from '../services/processingService';
import { formatCurrency } from '../utils/formatters';

const ITEMS_PER_PAGE = 50;

export const SearchView: React.FC = () => {
    const { 
        allHistoricalResults, 
        savedReports,
        openManualIdentify, 
        loadingAiId, 
        searchFilters,
        openSearchFilters,
        setSearchFilters,
        saveFilteredReport,
    } = useContext(AppContext);
    
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();
    const [query, setQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (searchFilters.dateRange.start || searchFilters.dateRange.end) count++;
        if (searchFilters.valueFilter.operator !== 'any') count++;
        if (searchFilters.filterBy === 'church' && searchFilters.churchIds.length > 0) count++;
        if (searchFilters.filterBy === 'contributor' && searchFilters.contributorName.trim()) count++;
        if (searchFilters.transactionType !== 'all') count++;
        if (searchFilters.reconciliationStatus !== 'all') count++;
        return count;
    }, [searchFilters]);

    // Determine source data based on selected report scope
    const sourceData = useMemo(() => {
        if (searchFilters.reportId) {
            const report = savedReports.find(r => r.id === searchFilters.reportId);
            return report?.data?.results || [];
        }
        return allHistoricalResults;
    }, [searchFilters.reportId, savedReports, allHistoricalResults]);

    const filteredResults = useMemo(() => {
        let results = [...sourceData];

        // 1. Apply advanced filters from the modal
        // Transaction Type
        if (searchFilters.transactionType === 'income') {
            results = results.filter(r => r.transaction.amount > 0);
        } else if (searchFilters.transactionType === 'expenses') {
            results = results.filter(r => r.transaction.amount < 0);
        }

        // Reconciliation Status
        switch (searchFilters.reconciliationStatus) {
            case 'confirmed_any':
                results = results.filter(r => r.status === 'IDENTIFICADO');
                break;
            case 'unconfirmed':
                results = results.filter(r => r.status === 'NÃO IDENTIFICADO');
                break;
            case 'confirmed_auto':
                results = results.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod));
                break;
            case 'confirmed_manual':
                 results = results.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));
                break;
        }

        // Contributor Name Filter (Now uses robust centralized logic)
        if (searchFilters.filterBy === 'contributor' && searchFilters.contributorName.trim()) {
            results = results.filter(r => filterByUniversalQuery(r, searchFilters.contributorName));
        }
        
        // Church filter
        if (searchFilters.filterBy === 'church' && searchFilters.churchIds.length > 0) {
            results = results.filter(r => searchFilters.churchIds.includes(r.church.id));
        }

        // Date range
        const startDate = searchFilters.dateRange.start ? new Date(searchFilters.dateRange.start).getTime() : null;
        const endDate = searchFilters.dateRange.end ? new Date(searchFilters.dateRange.end).getTime() + 86400000 : null; // Include the whole end day
        if (startDate || endDate) {
            results = results.filter(r => {
                const itemDate = parseDate(r.transaction.date)?.getTime();
                if (!itemDate) return false;
                if (startDate && itemDate < startDate) return false;
                if (endDate && itemDate >= endDate) return false;
                return true;
            });
        }
        
        // Value filter
        const { operator, value1, value2 } = searchFilters.valueFilter;
        if (operator !== 'any' && value1 !== null) {
            results = results.filter(r => {
                const amount = r.transaction.amount;
                switch (operator) {
                    case 'exact': return amount === value1;
                    case 'gt': return amount > value1;
                    case 'lt': return amount < value1;
                    case 'between': return value2 !== null && amount >= value1 && amount <= value2;
                    default: return true;
                }
            });
        }

        // 2. Apply text query on the already filtered results (Global Search Bar)
        if (query.trim()) {
            results = results.filter(r => filterByUniversalQuery(r, query));
        }

        return results;
    }, [query, sourceData, searchFilters]);
    
    const summary = useMemo(() => {
        const income = filteredResults.filter(r => r.transaction.amount > 0).reduce((sum, r) => sum + r.transaction.amount, 0);
        const expenses = filteredResults.filter(r => r.transaction.amount < 0).reduce((sum, r) => sum + r.transaction.amount, 0);
        const identified = filteredResults.filter(r => r.status === 'IDENTIFICADO').length;
        return {
            totalCount: filteredResults.length,
            income,
            expenses,
            identified,
            unidentified: filteredResults.length - identified,
        };
    }, [filteredResults]);

    useEffect(() => {
        setCurrentPage(1);
    }, [query, searchFilters]);

    const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
    const paginatedResults = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredResults.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredResults, currentPage]);
    
    const handleSave = () => {
        saveFilteredReport(filteredResults);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        
        const tableRows = filteredResults.map(r => `
            <tr>
                <td>${r.transaction.date}</td>
                <td>${r.transaction.cleanedDescription || r.transaction.description}</td>
                <td>${formatCurrency(r.transaction.amount, language)}</td>
                <td>${r.church.name}</td>
                <td>${r.contributor?.cleanedName || '---'}</td>
                <td>${r.status}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>${t('search.title')}</title>
                    <style>
                        body { font-family: sans-serif; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <h1>${t('search.title')}</h1>
                    <h3>${t('search.summaryTitle')}</h3>
                    <p>${t('search.totalTransactions')}: ${summary.totalCount}</p>
                    <p>${t('search.income')}: ${formatCurrency(summary.income, language)}</p>
                    <p>${t('search.expenses')}: ${formatCurrency(summary.expenses, language)}</p>
                    <hr/>
                    <table>
                        <thead>
                            <tr>
                                <th>${t('table.date')}</th>
                                <th>${t('table.description')}</th>
                                <th>${t('table.amount')}</th>
                                <th>${t('table.church')}</th>
                                <th>${t('table.contributor')}</th>
                                <th>${t('table.status')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };


    if (allHistoricalResults.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState icon={<SearchIcon className="w-12 h-12 text-brand-blue dark:text-blue-400" />} title={t('empty.search.title')} message={t('empty.search.message')} action={{ text: t('empty.dashboard.saved.action'), onClick: () => setActiveView('upload') }} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in gap-4 pb-2">
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-3 px-1">
                <div>
                    <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('search.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1">{t('search.subtitle')}</p>
                </div>
            </div>
            
             <div className="bg-white dark:bg-slate-800 p-6 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 flex-shrink-0">
                <div className="flex flex-col gap-4">
                    {/* Scope Selector */}
                    <div>
                        <label htmlFor="search-scope" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Origem da Pesquisa</label>
                        <div className="relative">
                            <CircleStackIcon className="w-4 h-4 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none"/>
                            <select
                                id="search-scope"
                                value={searchFilters.reportId || ''}
                                onChange={(e) => setSearchFilters(prev => ({ ...prev, reportId: e.target.value || null }))}
                                className="pl-9 pr-8 py-2.5 block w-full rounded-2xl border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 text-xs font-medium shadow-sm focus:border-brand-blue focus:ring-brand-blue transition-all cursor-pointer appearance-none outline-none"
                            >
                                <option value="">Todos os Relatórios Salvos ({allHistoricalResults.length} registros)</option>
                                {savedReports.map(report => (
                                    <option key={report.id} value={report.id}>
                                        {report.name} ({report.recordCount} registros) - {new Date(report.createdAt).toLocaleDateString()}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-grow">
                            <label htmlFor="search-query" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{t('search.nameDesc')}</label>
                            <div className="relative">
                                <SearchIcon className="w-4 h-4 text-brand-blue absolute top-1/2 left-3 -translate-y-1/2"/>
                                <input 
                                    type="text" 
                                    id="search-query" 
                                    value={query} 
                                    onChange={e => setQuery(e.target.value)} 
                                    placeholder={t('search.nameDescPlaceholder')} 
                                    className="pl-9 py-2.5 block w-full rounded-2xl border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 text-xs font-medium shadow-sm focus:border-brand-blue focus:ring-brand-blue transition-all outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex-shrink-0 flex items-end gap-2">
                             <button onClick={openSearchFilters} className="relative w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase rounded-full border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm tracking-wide h-[38px]">
                                <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
                                <span>{t('search.filters')}</span>
                                {activeFilterCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm border-2 border-white dark:border-slate-800">
                                        {activeFilterCount}
                                    </span>
                                )}
                             </button>
                             <button onClick={handlePrint} disabled={filteredResults.length === 0} className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase rounded-full border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm tracking-wide h-[38px]">
                                <PrinterIcon className="w-3.5 h-3.5" />
                                <span className="hidden lg:inline">{t('common.print')}</span>
                             </button>
                              <button onClick={handleSave} disabled={filteredResults.length === 0} className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase rounded-full text-white bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 transition-all tracking-wide h-[38px]">
                                <FloppyDiskIcon className="w-3.5 h-3.5" />
                                <span>{t('common.save')}</span>
                             </button>
                        </div>
                    </div>
                </div>
            </div>

            { (query || activeFilterCount > 0) && (
                <div className="flex-shrink-0 bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 animate-fade-in-up">
                    <h3 className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 ml-1">{t('search.summaryTitle')}</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">{t('search.totalTransactions')}</p>
                            <p className="font-black text-lg text-slate-900 dark:text-slate-100 leading-none">{summary.totalCount}</p>
                        </div>
                        <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-0.5">{t('search.income')}</p>
                            <p className="font-black text-lg text-emerald-700 dark:text-emerald-300 leading-none">{formatCurrency(summary.income, language)}</p>
                        </div>
                        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-800/30">
                            <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase mb-0.5">{t('search.expenses')}</p>
                            <p className="font-black text-lg text-red-700 dark:text-red-300 leading-none">{formatCurrency(summary.expenses, language)}</p>
                        </div>
                        <div className="flex flex-col justify-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500"/>
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">{t('search.identified')}</span>
                                </div>
                                <span className="font-bold text-sm text-slate-900 dark:text-white leading-none">{summary.identified}</span>
                            </div>
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <XCircleIcon className="w-3.5 h-3.5 text-amber-500"/>
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">{t('search.unidentified')}</span>
                                </div>
                                <span className="font-bold text-sm text-slate-900 dark:text-white leading-none">{summary.unidentified}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {filteredResults.length > 0 ? (
                     <ResultsTable 
                        results={paginatedResults} 
                        onManualIdentify={openManualIdentify} 
                        loadingAiId={loadingAiId} 
                        currentPage={currentPage} 
                        totalPages={totalPages} 
                        onPageChange={setCurrentPage} 
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500 italic bg-white/50 dark:bg-slate-900/30 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700">
                        <SearchIcon className="w-10 h-10 mb-2 opacity-50" />
                        <p>{t('search.noResults')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
