import React, { useContext, useState, useMemo, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { ResultsTable } from '../components/ResultsTable';
import { EmptyState } from '../components/EmptyState';
import { SearchIcon, AdjustmentsHorizontalIcon, PrinterIcon, FloppyDiskIcon, CheckCircleIcon, XCircleIcon, CircleStackIcon, XMarkIcon } from '../components/Icons';
import { filterByUniversalQuery, parseDate, normalizeString } from '../services/processingService';
import { formatCurrency, formatDate } from '../utils/formatters';

const ITEMS_PER_PAGE = 50;

export const SearchView: React.FC = () => {
    // ... (Mantém hooks e lógica existente)
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

    // ... (Lógica de filtragem sourceData, filteredResults, summary mantida) ...
    const sourceData = useMemo(() => {
        if (searchFilters.reportId) {
            const report = savedReports.find(r => r.id === searchFilters.reportId);
            return report?.data?.results || [];
        }
        return allHistoricalResults;
    }, [searchFilters.reportId, savedReports, allHistoricalResults]);

    const filteredResults = useMemo(() => {
        let results = [...sourceData];

        if (searchFilters.transactionType === 'income') {
            results = results.filter(r => r.transaction.amount > 0);
        } else if (searchFilters.transactionType === 'expenses') {
            results = results.filter(r => r.transaction.amount < 0);
        }

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

        if (searchFilters.filterBy === 'contributor' && searchFilters.contributorName.trim()) {
            results = results.filter(r => filterByUniversalQuery(r, searchFilters.contributorName));
        }
        
        if (searchFilters.filterBy === 'church' && searchFilters.churchIds.length > 0) {
            results = results.filter(r => searchFilters.churchIds.includes(r.church.id));
        }

        const startDate = searchFilters.dateRange.start ? new Date(searchFilters.dateRange.start).getTime() : null;
        const endDate = searchFilters.dateRange.end ? new Date(searchFilters.dateRange.end).getTime() + 86400000 : null;
        if (startDate || endDate) {
            results = results.filter(r => {
                const itemDate = parseDate(r.transaction.date)?.getTime();
                if (!itemDate) return false;
                if (startDate && itemDate < startDate) return false;
                if (endDate && itemDate >= endDate) return false;
                return true;
            });
        }
        
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

    // UNIFIED BUTTON COMPONENT - NEON VARIANT
    const UnifiedButton = ({ 
        onClick, 
        icon: Icon, 
        label, 
        badgeCount,
        isActive,
        isLast,
        variant = 'default'
    }: { 
        onClick: () => void, 
        icon: any, 
        label: string, 
        badgeCount?: number,
        isActive?: boolean,
        isLast?: boolean,
        variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'violet'
    }) => {
        // MAPA DE CORES: Garante visibilidade permanente
        const colorMap = {
            default: { base: 'text-slate-300 hover:text-white', active: 'text-white' },
            primary: { base: 'text-blue-400 hover:text-blue-300', active: 'text-blue-300 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' }, 
            success: { base: 'text-emerald-400 hover:text-emerald-300', active: 'text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' }, 
            danger: { base: 'text-rose-400 hover:text-rose-300', active: 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]' }, 
            warning: { base: 'text-amber-400 hover:text-amber-300', active: 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' }, 
            info: { base: 'text-cyan-400 hover:text-cyan-300', active: 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]' }, 
            violet: { base: 'text-violet-400 hover:text-violet-300', active: 'text-violet-300 drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]' }, 
        };

        const colors = colorMap[variant] || colorMap.default;
        const currentClass = isActive ? `${colors.active} font-black scale-105` : `${colors.base} font-bold hover:scale-105`;

        return (
            <>
                <button 
                    onClick={onClick}
                    className={`
                        relative flex-1 flex items-center justify-center gap-2 px-4 h-full text-[10px] uppercase transition-all duration-300 outline-none group
                        ${currentClass}
                    `}
                >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
                    <span className="hidden sm:inline">{label}</span>
                    {badgeCount !== undefined && badgeCount > 0 && (
                        <span className="ml-1 bg-red-500 px-1.5 py-0.5 rounded-full text-[9px] leading-none text-white font-bold">
                            {badgeCount}
                        </span>
                    )}
                </button>
                {!isLast && <div className="w-px h-3 bg-white/10 self-center"></div>}
            </>
        );
    };

    if (allHistoricalResults.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState icon={<SearchIcon className="w-12 h-12 text-brand-blue dark:text-blue-400" />} title={t('empty.search.title')} message={t('empty.search.message')} action={{ text: t('empty.dashboard.saved.action'), onClick: () => setActiveView('upload') }} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in gap-2 pb-1">
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-1 mt-1 min-h-[40px]">
                <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none whitespace-nowrap">{t('search.title')}</h2>
                
                {/* UNIFIED COMMAND CAPSULE */}
                <div className="flex items-center h-9 bg-gradient-to-r from-blue-600 via-[#051024] to-blue-600 rounded-full shadow-lg border border-white/20 overflow-hidden p-0.5">
                     <UnifiedButton 
                        onClick={openSearchFilters}
                        icon={AdjustmentsHorizontalIcon}
                        label={t('search.filters')}
                        badgeCount={activeFilterCount}
                        variant="primary"
                     />
                     <UnifiedButton 
                        onClick={handlePrint}
                        icon={PrinterIcon}
                        label={t('common.print')}
                        variant="info"
                     />
                     <UnifiedButton 
                        onClick={handleSave}
                        icon={FloppyDiskIcon}
                        label={t('common.save')}
                        isLast={true}
                        variant="success"
                     />
                </div>
            </div>
            
             <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 flex-shrink-0 flex gap-4 items-end">
                {/* ... (Restante do header de busca mantido) ... */}
                {/* Scope Selector - Compacto */}
                <div className="w-1/3 min-w-[200px]">
                    <label htmlFor="search-scope" className="block text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Origem</label>
                    <div className="relative">
                        <CircleStackIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-2.5 -translate-y-1/2 pointer-events-none"/>
                        <select
                            id="search-scope"
                            value={searchFilters.reportId || ''}
                            onChange={(e) => setSearchFilters(prev => ({ ...prev, reportId: e.target.value || null }))}
                            className="pl-8 pr-6 py-1.5 block w-full rounded-lg border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 text-xs font-medium shadow-sm focus:border-brand-blue focus:ring-brand-blue transition-all cursor-pointer appearance-none outline-none"
                        >
                            <option value="">Todos ({allHistoricalResults.length} registros)</option>
                            {savedReports.map(report => (
                                <option key={report.id} value={report.id}>
                                    {report.name} ({report.recordCount})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-grow">
                    <label htmlFor="search-query" className="block text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">{t('search.nameDesc')}</label>
                    <div className="relative">
                        <SearchIcon className="w-3.5 h-3.5 text-brand-blue absolute top-1/2 left-2.5 -translate-y-1/2"/>
                        <input 
                            type="text" 
                            id="search-query" 
                            value={query} 
                            onChange={e => setQuery(e.target.value)} 
                            placeholder={t('search.nameDescPlaceholder')} 
                            className="pl-8 py-1.5 block w-full rounded-lg border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 text-xs font-medium shadow-sm focus:border-brand-blue focus:ring-brand-blue transition-all outline-none"
                        />
                    </div>
                </div>
            </div>

            { (query || activeFilterCount > 0) && (
                <div className="flex-shrink-0 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 animate-fade-in-up">
                    <div className="grid grid-cols-4 gap-2">
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t('search.totalTransactions')}</p>
                            <p className="font-black text-sm text-slate-900 dark:text-slate-100">{summary.totalCount}</p>
                        </div>
                        <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center">
                            <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">{t('search.income')}</p>
                            <p className="font-black text-sm text-emerald-700 dark:text-emerald-300">{formatCurrency(summary.income, language)}</p>
                        </div>
                        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/30 flex justify-between items-center">
                            <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase">{t('search.expenses')}</p>
                            <p className="font-black text-sm text-red-700 dark:text-red-300">{formatCurrency(summary.expenses, language)}</p>
                        </div>
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                             <div className="flex items-center gap-1">
                                <CheckCircleIcon className="w-3 h-3 text-emerald-500"/>
                                <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase">{summary.identified}</span>
                            </div>
                             <div className="flex items-center gap-1">
                                <XCircleIcon className="w-3 h-3 text-amber-500"/>
                                <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase">{summary.unidentified}</span>
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
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500 italic bg-white/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                        <SearchIcon className="w-10 h-10 mb-2 opacity-50" />
                        <p>{t('search.noResults')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};