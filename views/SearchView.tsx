import React, { useContext, useState, useMemo, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { ResultsTable } from '../components/ResultsTable';
import { EmptyState } from '../components/EmptyState';
import { SearchIcon, AdjustmentsHorizontalIcon, PrinterIcon, FloppyDiskIcon, CheckCircleIcon, XCircleIcon } from '../components/Icons';
import { filterByUniversalQuery, parseDate } from '../services/processingService';
import { formatCurrency } from '../utils/formatters';

const ITEMS_PER_PAGE = 50;

export const SearchView: React.FC = () => {
    const { 
        allHistoricalResults, 
        openManualIdentify, 
        loadingAiId, 
        searchFilters,
        openSearchFilters,
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

    const filteredResults = useMemo(() => {
        let results = [...allHistoricalResults];

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
    }, [query, allHistoricalResults, searchFilters]);
    
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
        return <EmptyState icon={<SearchIcon className="w-8 h-8 text-blue-700 dark:text-blue-400" />} title={t('empty.search.title')} message={t('empty.search.message')} action={{ text: t('empty.dashboard.saved.action'), onClick: () => setActiveView('upload') }} />;
    }

    return (
        <>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{t('search.title')}</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{t('search.subtitle')}</p>
            
             <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-grow">
                        <label htmlFor="search-query" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('search.nameDesc')}</label>
                        <div className="relative mt-1">
                            <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2"/>
                            <input 
                                type="text" 
                                id="search-query" 
                                value={query} 
                                onChange={e => setQuery(e.target.value)} 
                                placeholder={t('search.nameDescPlaceholder')} 
                                className="pl-10 p-2 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                    <div className="flex-shrink-0 flex items-end gap-2">
                         <button onClick={openSearchFilters} className="relative w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <AdjustmentsHorizontalIcon className="w-5 h-5" />
                            <span>{t('search.filters')}</span>
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                         </button>
                         <button onClick={handlePrint} disabled={filteredResults.length === 0} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <PrinterIcon className="w-5 h-5" />
                            <span>{t('common.print')}</span>
                         </button>
                          <button onClick={handleSave} disabled={filteredResults.length === 0} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed">
                            <FloppyDiskIcon className="w-5 h-5" />
                            <span>{t('common.save')}</span>
                         </button>
                    </div>
                </div>
            </div>

            { (query || activeFilterCount > 0) && (
                <div className="mt-6 bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">{t('search.summaryTitle')}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">{t('search.totalTransactions')}</p>
                            <p className="font-bold text-lg text-slate-900 dark:text-slate-100">{summary.totalCount}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">{t('search.income')}</p>
                            <p className="font-bold text-lg text-green-600 dark:text-green-400">{formatCurrency(summary.income, language)}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">{t('search.expenses')}</p>
                            <p className="font-bold text-lg text-red-600 dark:text-red-400">{formatCurrency(summary.expenses, language)}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                                <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2"/>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">{t('search.identified')}</p>
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">{summary.identified}</p>
                                </div>
                            </div>
                             <div className="flex items-center">
                                <XCircleIcon className="w-5 h-5 text-yellow-500 mr-2"/>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">{t('search.unidentified')}</p>
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">{summary.unidentified}</p>
                                </div>
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
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <p>{t('search.noResults')}</p>
                </div>
            )}
        </>
    );
};