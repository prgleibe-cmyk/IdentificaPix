import React, { useContext, useState, useMemo, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { ResultsTable } from '../components/ResultsTable';
import { EmptyState } from '../components/EmptyState';
import { SearchIcon, AdjustmentsHorizontalIcon, PrinterIcon, FloppyDiskIcon, CheckCircleIcon, XCircleIcon, CircleStackIcon } from '../components/Icons';
import { filterByUniversalQuery, parseDate } from '../services/processingService';
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

        // Contributor Name
        if (searchFilters.filterBy === 'contributor' && searchFilters.contributorName.trim()) {
            const contributorQuery = searchFilters.contributorName.toLowerCase().trim();
            results = results.filter(r => 
                r.contributor?.name.toLowerCase().includes(contributorQuery) ||
                r.contributor?.cleanedName?.toLowerCase().includes(contributorQuery)
            );
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

        // 2. Apply text query on the already filtered results
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
            <div className="mt-8">
                <EmptyState icon={<SearchIcon className="w-12 h-12 text-blue-500 dark:text-blue-400" />} title={t('empty.search.title')} message={t('empty.search.message')} action={{ text: t('empty.dashboard.saved.action'), onClick: () => setActiveView('upload') }} />
            </div>
        );
    }

    return (
        <div className="pb-12 animate-fade-in">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">{t('search.title')}</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-lg">{t('search.subtitle')}</p>
            
             <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-soft border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
                <div className="flex flex-col gap-6">
                    {/* Scope Selector */}
                    <div>
                        <label htmlFor="search-scope" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 ml-1">Origem da Pesquisa</label>
                        <div className="relative">
                            <CircleStackIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-4 -translate-y-1/2 pointer-events-none"/>
                            <select
                                id="search-scope"
                                value={searchFilters.reportId || ''}
                                onChange={(e) => setSearchFilters(prev => ({ ...prev, reportId: e.target.value || null }))}
                                className="pl-12 p-3.5 block w-full rounded-2xl border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all cursor-pointer appearance-none"
                            >
                                <option value="">Todos os Relatórios Salvos ({allHistoricalResults.length} registros)</option>
                                {savedReports.map(report => (
                                    <option key={report.id} value={report.id}>
                                        {report.name} ({report.recordCount} registros) - {new Date(report.createdAt).toLocaleDateString()}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-grow">
                            <label htmlFor="search-query" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 ml-1">{t('search.nameDesc')}</label>
                            <div className="relative">
                                <SearchIcon className="w-5 h-5 text-indigo-500 absolute top-1/2 left-4 -translate-y-1/2"/>
                                <input 
                                    type="text" 
                                    id="search-query" 
                                    value={query} 
                                    onChange={e => setQuery(e.target.value)} 
                                    placeholder={t('search.nameDescPlaceholder')} 
                                    className="pl-12 p-3.5 block w-full rounded-2xl border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex-shrink-0 flex items-end gap-3">
                             <button onClick={openSearchFilters} className="relative w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold rounded-2xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                                <AdjustmentsHorizontalIcon className="w-5 h-5" />
                                <span>{t('search.filters')}</span>
                                {activeFilterCount > 0 && (
                                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-md border-2 border-white dark:border-slate-800">
                                        {activeFilterCount}
                                    </span>
                                )}
                             </button>
                             <button onClick={handlePrint} disabled={filteredResults.length === 0} className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold rounded-2xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                                <PrinterIcon className="w-5 h-5" />
                                <span className="hidden lg:inline">{t('common.print')}</span>
                             </button>
                              <button onClick={handleSave} disabled={filteredResults.length === 0} className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 transition-all">
                                <FloppyDiskIcon className="w-5 h-5" />
                                <span>{t('common.save')}</span>
                             </button>
                        </div>
                    </div>
                </div>
            </div>

            { (query || activeFilterCount > 0) && (
                <div className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-soft border border-slate-100 dark:border-slate-700 animate-fade-in-up">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">{t('search.summaryTitle')}</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('search.totalTransactions')}</p>
                            <p className="font-bold text-2xl text-slate-900 dark:text-slate-100">{summary.totalCount}</p>
                        </div>
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">{t('search.income')}</p>
                            <p className="font-bold text-2xl text-emerald-700 dark:text-emerald-300">{formatCurrency(summary.income, language)}</p>
                        </div>
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-800/30">
                            <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">{t('search.expenses')}</p>
                            <p className="font-bold text-2xl text-red-700 dark:text-red-300">{formatCurrency(summary.expenses, language)}</p>
                        </div>
                        <div className="flex flex-col justify-center space-y-3 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CheckCircleIcon className="w-4 h-4 text-emerald-500"/>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('search.identified')}</span>
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white">{summary.identified}</span>
                            </div>
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <XCircleIcon className="w-4 h-4 text-amber-500"/>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('search.unidentified')}</span>
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white">{summary.unidentified}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}


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
                <div className="text-center py-20 text-slate-400 dark:text-slate-500 italic bg-slate-50/50 dark:bg-slate-800/50 rounded-3xl mt-8 border border-dashed border-slate-200 dark:border-slate-700">
                    <p>{t('search.noResults')}</p>
                </div>
            )}
        </div>
    );
};