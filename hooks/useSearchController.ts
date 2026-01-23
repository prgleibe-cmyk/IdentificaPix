
import { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { filterByUniversalQuery, parseDate } from '../services/processingService';
import { formatDate, formatCurrency } from '../utils/formatters';

const ITEMS_PER_PAGE = 50;

export const useSearchController = () => {
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

    const sourceData = useMemo(() => {
        if (searchFilters.reportId) {
            const report = savedReports.find((r: any) => r.id === searchFilters.reportId);
            return report?.data?.results || [];
        }
        return allHistoricalResults;
    }, [searchFilters.reportId, savedReports, allHistoricalResults]);

    const filteredResults = useMemo(() => {
        let results = [...sourceData];

        if (searchFilters.transactionType === 'income') {
            results = results.filter((r: any) => r.transaction.amount > 0);
        } else if (searchFilters.transactionType === 'expenses') {
            results = results.filter((r: any) => r.transaction.amount < 0);
        }

        switch (searchFilters.reconciliationStatus) {
            case 'confirmed_any':
                results = results.filter((r: any) => r.status === 'IDENTIFICADO');
                break;
            case 'unconfirmed':
                results = results.filter((r: any) => r.status === 'NÃO IDENTIFICADO');
                break;
            case 'confirmed_auto':
                results = results.filter((r: any) => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod));
                break;
            case 'confirmed_manual':
                 results = results.filter((r: any) => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));
                break;
        }

        if (searchFilters.filterBy === 'contributor' && searchFilters.contributorName.trim()) {
            results = results.filter((r: any) => filterByUniversalQuery(r, searchFilters.contributorName));
        }
        
        if (searchFilters.filterBy === 'church' && searchFilters.churchIds.length > 0) {
            results = results.filter((r: any) => searchFilters.churchIds.includes(r.church.id));
        }

        const startDate = searchFilters.dateRange.start ? new Date(searchFilters.dateRange.start).getTime() : null;
        const endDate = searchFilters.dateRange.end ? new Date(searchFilters.dateRange.end).getTime() + 86400000 : null;
        if (startDate || endDate) {
            results = results.filter((r: any) => {
                const itemDate = parseDate(r.transaction.date)?.getTime();
                if (!itemDate) return false;
                if (startDate && itemDate < startDate) return false;
                if (endDate && itemDate >= endDate) return false;
                return true;
            });
        }
        
        const { operator, value1, value2 } = searchFilters.valueFilter;
        if (operator !== 'any' && value1 !== null) {
            results = results.filter((r: any) => {
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

        if (query.trim()) {
            results = results.filter((r: any) => filterByUniversalQuery(r, query));
        }

        return results;
    }, [query, sourceData, searchFilters]);
    
    const summary = useMemo(() => {
        const income = filteredResults.filter((r: any) => r.transaction.amount > 0).reduce((sum, r: any) => sum + r.transaction.amount, 0);
        const expenses = filteredResults.filter((r: any) => r.transaction.amount < 0).reduce((sum, r: any) => sum + r.transaction.amount, 0);
        const identified = filteredResults.filter((r: any) => r.status === 'IDENTIFICADO').length;
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

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        
        const tableRows = filteredResults.map((r: any) => `
            <tr>
                <td>${formatDate(r.transaction.date)}</td>
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
                        <tbody>${tableRows}</tbody>
                    </table>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    return {
        allHistoricalResults,
        savedReports,
        query,
        setQuery,
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedResults,
        activeFilterCount,
        summary,
        searchFilters,
        setSearchFilters,
        openSearchFilters,
        saveFilteredReport,
        handlePrint,
        openManualIdentify,
        loadingAiId,
        setActiveView,
        filteredResults,
        language
    };
};
