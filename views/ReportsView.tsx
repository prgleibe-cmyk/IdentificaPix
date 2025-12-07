import React, { useContext, useMemo, useState, memo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { EmptyState } from '../components/EmptyState';
import { EditableReportTable } from '../components/reports/EditableReportTable';
import { 
    DocumentDuplicateIcon, 
    PrinterIcon, 
    DocumentArrowDownIcon, 
    TrashIcon,
    SearchIcon,
    XMarkIcon,
    UserPlusIcon,
    SparklesIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ChevronRightIcon,
    FloppyDiskIcon
} from '../components/Icons';
import { formatCurrency } from '../utils/formatters';
import { Church, MatchResult, Language } from '../types';
import { parseDate, filterByUniversalQuery } from '../services/processingService';

// Declarations for globally loaded libraries
declare const XLSX: any;
declare const jspdf: { jsPDF: any };

type SortDirection = 'asc' | 'desc';
interface SortConfig {
    key: string;
    direction: SortDirection;
}

const SummaryStat: React.FC<{ title: string; quantity: number; value: number; percentage: number; language: Language; colorClass?: string }> = ({ title, quantity, value, percentage, language, colorClass = 'text-slate-900 dark:text-slate-100' }) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col">
            <dt className="text-slate-600 dark:text-slate-400 font-medium text-sm whitespace-nowrap">{title}</dt>
            <dd className="mt-2 text-slate-700 dark:text-slate-300 space-y-1 p-2 rounded-md bg-slate-100 dark:bg-slate-700/50 border dark:border-slate-600/50">
                <div className="text-xs flex justify-between items-center">
                    <span>{t('common.quantity')}:</span>
                    <span className={`font-semibold ${colorClass}`}>{quantity}</span>
                </div>
                <div className="text-xs flex justify-between items-center">
                    <span>{t('common.value')}:</span>
                    <span className={`font-semibold ${colorClass}`}>{formatCurrency(value, language)}</span>
                </div>
                <div className="text-xs flex justify-between items-center">
                    <span>{t('table.percentage')}:</span>
                    <span className={`font-semibold ${colorClass}`}>{percentage.toFixed(1)}%</span>
                </div>
            </dd>
        </div>
    );
};

// A simple utility to get nested property values for sorting.
const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((o, key) => (o && o[key] != null ? o[key] : null), obj);
};

const ReportGroup: React.FC<{
    churchId: string;
    results: MatchResult[];
    reportType: 'income' | 'expenses';
}> = ({ churchId, results, reportType }) => {
    const {
        churches,
        allContributorsWithChurch,
        updateReportData,
        openDeleteConfirmation,
        openManualIdentify,
        handleAnalyze,
        loadingAiId,
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'date', direction: 'desc' });
    const [isCollapsed, setIsCollapsed] = useState(true);

    const processedResults = useMemo(() => {
        // FILTER OUT DELETED ITEMS FROM THE TABLE VIEW
        let filteredData = results.filter(r => !r.isDeleted);

        // --- Filtering ---
        if (searchQuery.trim()) {
            filteredData = filteredData.filter(r => filterByUniversalQuery(r, searchQuery));
        }

        // --- Sorting ---
        if (sortConfig !== null) {
            filteredData.sort((a, b) => {
                const aValue = getNestedValue(a, sortConfig.key);
                const bValue = getNestedValue(b, sortConfig.key);

                if (sortConfig.key === 'date' || (sortConfig.key.includes('date'))) {
                    const dateA = parseDate(aValue)?.getTime() || 0;
                    const dateB = parseDate(bValue)?.getTime() || 0;
                    return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
                }

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                     return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }
                
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortConfig.direction === 'asc' 
                        ? aValue.localeCompare(bValue) 
                        : bValue.localeCompare(aValue);
                }
                
                return 0;
            });
        }

        return filteredData;
    }, [results, searchQuery, sortConfig]);

    const handleSort = (key: string) => {
        let direction: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const isUnidentifiedIncome = reportType === 'income' && churchId === 'unidentified';

    const summaryMetrics = useMemo(() => {
        // Metrics should calculate ALL items, including active and deleted,
        // to show a complete picture of what happened.
        
        let totalQuantity = 0;
        let totalValue = 0;
        let pendingCount = 0;
        let pendingValue = 0;
        let deletedCount = 0;
        let deletedValue = 0;

        // Count deleted items within this results group
        const deletedItems = results.filter(r => r.isDeleted);
        deletedCount = deletedItems.length;
        deletedValue = deletedItems.reduce((sum, r) => sum + r.transaction.amount, 0);

        // Filter active items for other calculations
        const activeResults = results.filter(r => !r.isDeleted);

        // Case A: Standard Church Report (Income) - Baseline is the expected contributors list
        if (reportType === 'income' && churchId !== 'unidentified') {
            const churchContributors = allContributorsWithChurch.filter(c => c.church.id === churchId);
            // Total expected comes from the original contributor list
            totalQuantity = churchContributors.length;
            totalValue = churchContributors.reduce((sum, c) => sum + (c.amount || 0), 0);
            
            // Calculate confirmed from active results that match this church
            const confirmedContributorIds = new Set(
                activeResults
                    .filter(r => r.status === 'IDENTIFICADO' && r.contributor?.id)
                    .map(r => r.contributor!.id)
            );
            
            // Pending are contributors NOT in the confirmed set
            const pendingContributors = churchContributors.filter(c => c.id && !confirmedContributorIds.has(c.id));
            pendingCount = pendingContributors.length;
            pendingValue = pendingContributors.reduce((sum, c) => sum + (c.amount || 0), 0);
        } 
        // Case B: Unidentified or Expenses - Baseline is the transactions present in this group (Active + Deleted)
        else {
            totalQuantity = results.length; // Count both active and deleted
            totalValue = results.reduce((sum, r) => sum + r.transaction.amount, 0);
            
            const pendingItems = activeResults.filter(r => r.status === 'NÃO IDENTIFICADO');
            pendingCount = pendingItems.length;
            pendingValue = pendingItems.reduce((sum, r) => sum + r.transaction.amount, 0);
        }

        if (totalQuantity === 0) return null;

        const autoConfirmed = activeResults.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod));
        const manualConfirmed = activeResults.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));

        const autoQuantity = autoConfirmed.length;
        const autoValue = autoConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0);
        
        const manualQuantity = manualConfirmed.length;
        const manualValue = manualConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0);

        return {
            auto: {
                quantity: autoQuantity,
                value: autoValue,
                percentage: totalQuantity > 0 ? (autoQuantity / totalQuantity) * 100 : 0,
            },
            manual: {
                quantity: manualQuantity,
                value: manualValue,
                percentage: totalQuantity > 0 ? (manualQuantity / totalQuantity) * 100 : 0,
            },
            pending: {
                quantity: pendingCount,
                value: pendingValue,
                percentage: totalQuantity > 0 ? (pendingCount / totalQuantity) * 100 : 0,
            },
            deleted: {
                quantity: deletedCount,
                value: deletedValue,
                percentage: totalQuantity > 0 ? (deletedCount / totalQuantity) * 100 : 0,
            },
            total: {
                quantity: totalQuantity,
                value: totalValue,
                percentage: 100,
            }
        };
    }, [results, reportType, churchId, allContributorsWithChurch]);
    

    const getGroupName = (id: string): string => {
        if (id === 'unidentified') return t('reports.unidentifiedGroupTitle');
        if (id === 'all_expenses_group') return t('reports.expenseReportTitle');
        return churches.find(c => c.id === id)?.name || t('reports.unknownChurch');
    };

    const groupName = getGroupName(churchId);

    const handleDownload = (
        format: 'xlsx' | 'pdf',
        groupData?: { groupName: string; results: MatchResult[]; reportType: 'income' | 'expenses' }
    ) => {
        // Filter deleted items before downloading
        const activeResults = processedResults.filter(r => !r.isDeleted);
        const dataToExport = groupData 
            ? [{ ...groupData, results: activeResults }] 
            : [{ groupName, results: activeResults, reportType }];
    
        if (format === 'xlsx') {
            const wb = XLSX.utils.book_new();
            dataToExport.forEach(group => {
                const mappedData = group.results.map(item => {
                    if (group.reportType === 'income') {
                         if (isUnidentifiedIncome) {
                            return {
                                [t('table.date')]: item.transaction.date,
                                [t('table.name')]: item.transaction.cleanedDescription || item.transaction.description,
                                ['Valor']: item.transaction.amount,
                            };
                        }
                        return {
                            [t('table.date')]: item.transaction.date,
                            [t('table.contributor')]: item.contributor?.name || (item.status === 'NÃO IDENTIFICADO' ? item.transaction.description : t('common.unassigned')),
                            [t('table.description')]: item.transaction.description,
                            [t('table.percentage')]: item.similarity != null ? `${item.similarity.toFixed(0)}%` : '0%',
                            [t('table.amount')]: item.transaction.amount,
                            [t('table.status')]: t(item.status === 'IDENTIFICADO' ? 'table.status.identified' : 'table.status.unidentified'),
                        };
                    } else { // expenses
                        return {
                            [t('table.date')]: item.transaction.date,
                            [t('table.description')]: item.transaction.description,
                            [t('table.amount')]: item.transaction.amount,
                            [t('table.costCenter')]: item.church.name !== '---' ? item.church.name : '',
                        };
                    }
                });
                const sheet = XLSX.utils.json_to_sheet(mappedData);
                XLSX.utils.book_append_sheet(wb, sheet, group.groupName.replace(/[:\\/?*[\]]/g, '').substring(0, 31));
            });
            XLSX.writeFile(wb, `${groupName}.xlsx`);
        } else { // PDF
            const { jsPDF } = jspdf;
            const doc = new jsPDF();
            let yPos = 15;

            doc.setFontSize(18);
            doc.text(groupName, 14, yPos);
            yPos += 10;
            
            dataToExport.forEach(group => {
                let head: any[], body: any[];
                if (group.reportType === 'income') {
                     if (isUnidentifiedIncome) {
                        head = [[t('table.date'), t('table.name'), 'Valor']];
                        body = group.results.map(item => [
                            item.transaction.date,
                            item.transaction.cleanedDescription || item.transaction.description,
                            formatCurrency(item.transaction.amount, language),
                        ]);
                    } else {
                        head = [[t('table.date'), t('table.contributor'), t('table.amount'), t('table.status')]];
                        body = group.results.map(item => [
                            item.transaction.date,
                            item.contributor?.name || (item.status === 'NÃO IDENTIFICADO' ? item.transaction.description : t('common.unassigned')),
                            formatCurrency(item.transaction.amount, language),
                            t(item.status === 'IDENTIFICADO' ? 'table.status.identified' : 'table.status.unidentified'),
                        ]);
                    }
                } else {
                    head = [[t('table.date'), t('table.description'), t('table.amount'), t('table.costCenter')]];
                    body = group.results.map(item => [
                        item.transaction.date,
                        item.transaction.description,
                        formatCurrency(item.transaction.amount, language),
                        item.church.name !== '---' ? item.church.name : '',
                    ]);
                }
                (doc as any).autoTable({ startY: yPos, head, body, theme: 'grid', styles: { fontSize: 10 }, headStyles: { fillColor: [30, 41, 59] } });
                yPos = (doc as any).autoTable.previous.finalY + 10;
            });
            doc.save(`${groupName}.pdf`);
        }
    };

    if (isUnidentifiedIncome) {
        return (
             <div className="report-group-wrapper" data-group-id={churchId}>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <button onClick={() => setIsCollapsed(!isCollapsed)} className="w-full p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4 text-left print-hidden">
                        <div className="flex items-center gap-3">
                            {isCollapsed ? <ChevronRightIcon className="w-5 h-5 text-slate-500" /> : <ChevronDownIcon className="w-5 h-5 text-slate-500" />}
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{groupName}</h3>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleDownload('xlsx', { groupName, results: processedResults, reportType })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                <DocumentArrowDownIcon className="w-4 h-4"/> Baixar
                            </button>
                            <button onClick={() => (window as any).handleUniversalPrint(churchId)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                <PrinterIcon className="w-4 h-4"/> Imprimir
                            </button>
                            <button onClick={() => openDeleteConfirmation({ type: 'report-group', id: churchId, name: `relatório de ${groupName}`, meta: { reportType }})} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md border border-red-300 dark:border-red-600/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                <TrashIcon className="w-4 h-4"/> Excluir
                            </button>
                        </div>
                    </button>
                    
                    {!isCollapsed && (
                    <>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 print-hidden">
                            <label htmlFor="unidentified-search" className="sr-only">{t('common.search')}</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <SearchIcon className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    id="unidentified-search"
                                    className="block w-full pl-10 pr-10 py-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 rounded-md leading-5 placeholder-slate-400 focus:outline-none focus:placeholder-slate-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="Buscar por nome, valor ou data..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                        <button onClick={() => setSearchQuery('')} className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none">
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                                <thead className="text-sm text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 font-medium">{t('table.date')}</th>
                                        <th scope="col" className="px-6 py-3 font-medium">{t('table.name')}</th>
                                        <th scope="col" className="px-6 py-3 font-medium text-right">Valor</th>
                                        <th scope="col" className="px-6 py-3 font-medium text-center">{t('table.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {processedResults.map(result => (
                                        <tr key={result.transaction.id} className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 whitespace-nowrap">{result.transaction.date}</td>
                                            <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 max-w-sm truncate">{result.transaction.cleanedDescription || result.transaction.description}</td>
                                            <td className="px-6 py-4 text-right font-semibold whitespace-nowrap">{formatCurrency(result.transaction.amount, language)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center space-x-2">
                                                    <button onClick={() => openManualIdentify(result.transaction.id)} disabled={!!loadingAiId} className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                                        <UserPlusIcon className="w-4 h-4 mr-2" />
                                                        {t('table.actions.manual')}
                                                    </button>
                                                    <button onClick={() => handleAnalyze(result.transaction.id)} disabled={!!loadingAiId} className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:bg-blue-500 disabled:cursor-not-allowed">
                                                        {loadingAiId === result.transaction.id ? (
                                                            <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{t('table.actions.analyzing')}</>
                                                        ) : (
                                                            <><SparklesIcon className="w-4 h-4 mr-2" />{t('table.actions.ai')}</>
                                                        )}
                                                    </button>
                                                    <button 
                                                        onClick={() => openDeleteConfirmation({ 
                                                            type: 'report-row', 
                                                            id: result.transaction.id, 
                                                            name: `a linha "${result.transaction.cleanedDescription || result.transaction.description}"` 
                                                        })}
                                                        className="p-2 rounded-md text-red-600 hover:bg-red-100 dark:text-red-500 dark:hover:bg-slate-700 transition-colors"
                                                        title={t('common.delete')}
                                                    >
                                                        <TrashIcon className="w-5 h-5 stroke-current" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {processedResults.length === 0 && (
                                <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('common.noResults')}</p>
                            )}
                        </div>

                        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-lg">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">{t('reports.summary.title')}</h4>
                            {summaryMetrics && (
                                <dl className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-6 print-summary-grid">
                                    <SummaryStat
                                        title={t('reports.summary.autoConfirmed')}
                                        quantity={summaryMetrics.auto.quantity}
                                        value={summaryMetrics.auto.value}
                                        percentage={summaryMetrics.auto.percentage}
                                        language={language}
                                        colorClass="text-green-500 dark:text-green-400"
                                    />
                                    <SummaryStat
                                        title={t('reports.summary.manualConfirmed')}
                                        quantity={summaryMetrics.manual.quantity}
                                        value={summaryMetrics.manual.value}
                                        percentage={summaryMetrics.manual.percentage}
                                        language={language}
                                        colorClass="text-blue-500 dark:text-blue-400"
                                    />
                                    <SummaryStat
                                        title={t('reports.summary.unidentifiedPending')}
                                        quantity={summaryMetrics.pending.quantity}
                                        value={summaryMetrics.pending.value}
                                        percentage={summaryMetrics.pending.percentage}
                                        language={language}
                                        colorClass="text-yellow-500 dark:text-yellow-400"
                                    />
                                    <SummaryStat
                                        title={t('reports.summary.deleted')}
                                        quantity={summaryMetrics.deleted.quantity}
                                        value={summaryMetrics.deleted.value}
                                        percentage={summaryMetrics.deleted.percentage}
                                        language={language}
                                        colorClass="text-red-500 dark:text-red-400"
                                    />
                                    <SummaryStat
                                        title={t('reports.summary.total')}
                                        quantity={summaryMetrics.total.quantity}
                                        value={summaryMetrics.total.value}
                                        percentage={summaryMetrics.total.percentage}
                                        language={language}
                                    />
                                </dl>
                            )}
                        </div>
                    </>
                    )}
                </div>
            </div>
        );
    }
    

    return (
        <div className="report-group-wrapper" data-group-id={churchId}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <button onClick={() => setIsCollapsed(!isCollapsed)} className="w-full p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4 text-left print-hidden">
                    <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronRightIcon className="w-5 h-5 text-slate-500" /> : <ChevronDownIcon className="w-5 h-5 text-slate-500" />}
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{groupName}</h3>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                         <button onClick={() => handleDownload('xlsx', { groupName, results: processedResults, reportType })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <DocumentArrowDownIcon className="w-4 h-4"/> Baixar
                        </button>
                         <button onClick={() => (window as any).handleUniversalPrint(churchId)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <PrinterIcon className="w-4 h-4"/> Imprimir
                        </button>
                         <button onClick={() => openDeleteConfirmation({ type: 'report-group', id: churchId, name: `relatório de ${groupName}`, meta: { reportType }})} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md border border-red-300 dark:border-red-600/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                            <TrashIcon className="w-4 h-4"/> Excluir
                        </button>
                    </div>
                </button>
                {!isCollapsed && (
                <>
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 print-hidden">
                        <label htmlFor={`search-${churchId}`} className="sr-only">{t('common.search')}</label>
                        <div className="relative">
                            <SearchIcon className="h-5 w-5 text-slate-400 absolute inset-y-0 left-3 flex items-center" />
                            <input
                                type="text"
                                id={`search-${churchId}`}
                                className="block w-full pl-10 pr-10 py-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 rounded-md leading-5 placeholder-slate-400 focus:outline-none focus:placeholder-slate-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Filtrar nesta tabela..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <button onClick={() => setSearchQuery('')} className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none">
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <EditableReportTable data={processedResults} onRowChange={(row) => updateReportData(row, reportType)} reportType={reportType} sortConfig={sortConfig} onSort={handleSort} />
                    
                    <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-lg">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">{t('reports.summary.title')}</h4>
                        {summaryMetrics && (
                            <dl className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-6 print-summary-grid">
                                <SummaryStat
                                    title={t('reports.summary.autoConfirmed')}
                                    quantity={summaryMetrics.auto.quantity}
                                    value={summaryMetrics.auto.value}
                                    percentage={summaryMetrics.auto.percentage}
                                    language={language}
                                    colorClass="text-green-500 dark:text-green-400"
                                />
                                <SummaryStat
                                    title={t('reports.summary.manualConfirmed')}
                                    quantity={summaryMetrics.manual.quantity}
                                    value={summaryMetrics.manual.value}
                                    percentage={summaryMetrics.manual.percentage}
                                    language={language}
                                    colorClass="text-blue-500 dark:text-blue-400"
                                />
                                <SummaryStat
                                    title={t('reports.summary.unidentifiedPending')}
                                    quantity={summaryMetrics.pending.quantity}
                                    value={summaryMetrics.pending.value}
                                    percentage={summaryMetrics.pending.percentage}
                                    language={language}
                                    colorClass="text-yellow-500 dark:text-yellow-400"
                                />
                                <SummaryStat
                                    title={t('reports.summary.deleted')}
                                    quantity={summaryMetrics.deleted.quantity}
                                    value={summaryMetrics.deleted.value}
                                    percentage={summaryMetrics.deleted.percentage}
                                    language={language}
                                    colorClass="text-red-500 dark:text-red-400"
                                />
                                <SummaryStat
                                    title={t('reports.summary.total')}
                                    quantity={summaryMetrics.total.quantity}
                                    value={summaryMetrics.total.value}
                                    percentage={summaryMetrics.total.percentage}
                                    language={language}
                                />
                            </dl>
                        )}
                    </div>
                </>
                )}
            </div>
        </div>
    );
};

const MemoizedReportGroup = memo(ReportGroup);

export const ReportsView: React.FC = () => {
    const { 
        reportPreviewData, 
        discardCurrentReport,
        churches,
        openSaveReportModal
    } = useContext(AppContext);
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();
    const [showSessionBanner, setShowSessionBanner] = useState(true);

    // Attach the universal print handler to the window object
    React.useEffect(() => {
        (window as any).handleUniversalPrint = (targetId: 'global' | string) => {
            const isGlobal = targetId === 'global';
            const churchDetails = !isGlobal ? churches.find(c => c.id === targetId) : null;
            const elementId = isGlobal ? '#print-section' : `[data-group-id="${targetId}"]`;
            const printElement = document.querySelector(elementId);
            
            if (!printElement) {
                console.error("Printable element not found for target:", targetId);
                return;
            }

            const getGroupName = (id: string): string => {
                if (id === 'unidentified') return t('reports.unidentifiedGroupTitle');
                if (id === 'all_expenses_group') return t('reports.expenseReportTitle');
                return churches.find(c => c.id === id)?.name || t('reports.unknownChurch');
            };

            const title = churchDetails ? churchDetails.name : getGroupName(targetId);
            const clonedNode = printElement.cloneNode(true) as HTMLElement;

            // Clean up the cloned node by removing unwanted elements for printing
            clonedNode.querySelectorAll('.print-hidden').forEach(el => el.remove());
            
            const contentHtml = clonedNode.innerHTML;

            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert("Por favor, habilite pop-ups para imprimir o relatório.");
                return;
            }

            const systemLogoSvg = `
                <svg width="40" height="40" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="logo-blue-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#38bdf8"></stop><stop offset="100%" stop-color="#0ea5e9"></stop></linearGradient>
                        <linearGradient id="logo-green-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4ade80"></stop><stop offset="100%" stop-color="#22c55e"></stop></linearGradient>
                    </defs>
                    <path fill="url(#logo-blue-grad)" d="M40,1H8C4.1,1,1,4.1,1,8v24c0,3.9,3.1,7,7,7h16.4c-1.4-1.6-2.2-3.7-2.2-6c0-5.5,4.5-10,10-10c2.3,0,4.4,0.8,6,2.2V8 C47,4.1,43.9,1,40,1z"></path>
                    <path fill="#ffffff" d="M20.6,20.5l-6.2,6.2c-0.8,0.8-2,0.8-2.8,0c-0.8-0.8-0.8-2,0-2.8l7.6-7.6c0.8-0.8,2,0.8,2.8,0l12.8,12.8 c0.8,0.8,0.8,2,0,2.8c-0.8,0.8-2,0.8-2.8,0L20.6,20.5z"></path>
                    <circle fill="url(#logo-green-grad)" cx="34" cy="34" r="12"></circle>
                    <path fill="#ffffff" d="M37,34.9c-1,0.5-2,0.7-3,0.7c-1.3,0-2.5-0.4-3.5-1.2c-1.1-0.9-1.8-2.1-1.8-3.5c0-1.2,0.5-2.4,1.4-3.2 c0.9-0.8,2.1-1.3,3.4-1.3c0.8,0,1.6,0.2,2.3,0.5l0.6-1.9c-0.9-0.4-1.9-0.6-2.9-0.6c-2.1,0-4,0.8-5.5,2.2c-1.5,1.4-2.3,3.3-2.3,5.4 c0,2.2,0.8,4.2,2.4,5.6c1.6,1.5,3.6,2.3,5.8,2.3c1.1,0,2.2-0.2,3.2-0.7L37,34.9z M39.2,30.5c-0.9-0.5-1.9-0.7-2.9-0.7 c-1.5,0-2.8,0.6-3.8,1.7c-0.8,1-1.3,2.3-1.3,3.6c0,1,0.3,1.9,0.8,2.7l7.3-2.3C39.4,34.5,39.6,32.4,39.2,30.5z"></path>
                </svg>`;
            
            const generatedDate = new Date().toLocaleString(language, { dateStyle: 'long', timeStyle: 'short' });
            
            let headerHtml = '';
            if (churchDetails) {
                const churchLogo = `<img src="${churchDetails.logoUrl}" alt="Logo da Igreja" style="width: 64px; height: 64px; object-fit: contain; margin-right: 16px; border-radius: 4px;"/>`;
                const systemLogoDiscreet = systemLogoSvg.replace('width="40"', 'width="24"').replace('height="40"', 'height="24"');
                
                headerHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                        <div style="display: flex; align-items: center;">
                            ${churchLogo}
                            <div>
                                <h1 style="font-weight: bold; color: #1e293b; font-size: 20px; margin: 0; line-height: 1.2;">${churchDetails.name}</h1>
                                <p style="font-size: 11px; color: #475569; margin: 4px 0 0;">${churchDetails.address}</p>
                                <p style="font-size: 11px; color: #475569; margin: 2px 0 0;"><strong>Pastor:</strong> ${churchDetails.pastor}</p>
                            </div>
                        </div>
                        <div style="text-align: right; flex-shrink: 0; margin-left: 20px;">
                            <div style="display: flex; align-items: center; justify-content: flex-end; opacity: 0.7;">
                                ${systemLogoDiscreet}
                                <span style="font-size: 12px; font-weight: bold; color: #1e293b; margin-left: 8px;">IdentificaPix</span>
                            </div>
                            <p style="font-size: 10px; color: #475569; margin-top: 8px;">
                                <strong>${t('reports.generatedAt')}:</strong><br/>
                                ${generatedDate}
                            </p>
                        </div>
                    </div>
                `;
            } else {
                headerHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                        <div style="display: flex; align-items: center;">
                            ${systemLogoSvg}
                            <div style="margin-left: 12px;">
                                <h1 style="font-weight: bold; color: #1e293b; font-size: 16px;">IdentificaPix</h1>
                                <h2 style="font-size: 12px; color: #475569;">${title}</h2>
                            </div>
                        </div>
                        <div style="text-align: right; font-size: 11px;">
                            <strong>${t('reports.generatedAt')}:</strong><br/>
                            ${generatedDate}
                        </div>
                    </div>
                `;
            }
            
            const footerHtml = `
                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <span>Gerado por IdentificaPix - Sistema de Conciliação</span>
                    <span class="page-number"></span>
                </div>
            `;

            const printStyles = `
                @page {
                    size: A4 portrait;
                    margin: 1.5cm;
                }
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    font-family: Arial, sans-serif;
                    font-size: 9pt;
                    color: #333;
                }
                .print-summary-grid {
                    display: flex !important;
                    justify-content: space-between !important;
                    gap: 1rem !important;
                }
                .print-summary-grid > div {
                    flex: 1;
                    min-width: 0;
                }
                .print-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .print-header, .print-footer {
                    width: 100%;
                }
                .print-header {
                    display: table-header-group;
                }
                .print-footer {
                    display: table-footer-group;
                }
                .print-header td, .print-footer td {
                    border: none;
                    padding: 0;
                }
                .print-header td {
                    padding-bottom: 0.5cm;
                }
                .print-header .header-content {
                    border-bottom: 1px solid #e2e8f0;
                    padding-bottom: 0.5cm;
                }
                .print-footer td {
                    padding-top: 0.5cm;
                }
                .print-footer .footer-content {
                     border-top: 1px solid #e2e8f0;
                     padding-top: 0.5cm;
                }
                .print-footer .page-number::after {
                    content: "Página " counter(page);
                }
                .report-group-wrapper { page-break-inside: avoid; margin-bottom: 1rem; }
                .report-group-wrapper > div, .report-group-wrapper table { border: none !important; box-shadow: none !important; }
                .main-report-headers { page-break-before: always; }
                .main-report-headers:first-of-type { page-break-before: auto; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; word-break: break-word; }
                th { background-color: #f1f5f9; font-weight: bold; }
                tr:nth-child(even) { background-color: #f8fafc; }
                table button, table svg { display: none; }
            `;

            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="${language}">
                <head>
                    <meta charset="UTF-8">
                    <title>${title}</title>
                    <style>${printStyles}</style>
                </head>
                <body class="font-sans">
                    <table class="print-table">
                        <thead class="print-header">
                            <tr>
                                <td>
                                    <div class="header-content">${headerHtml}</div>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${contentHtml}</td>
                            </tr>
                        </tbody>
                         <tfoot class="print-footer">
                            <tr>
                                <td>
                                     <div class="footer-content">${footerHtml}</div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </body>
                </html>
            `);
            
            setTimeout(() => {
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
                printWindow.close();
            }, 500);
        };
        // Cleanup function
        return () => {
            delete (window as any).handleUniversalPrint;
        };
    }, [t, language, churches]);


    const incomeGroups = reportPreviewData?.income ? Object.entries(reportPreviewData.income) : [];
    const expenseGroups = reportPreviewData?.expenses ? Object.entries(reportPreviewData.expenses) : [];

    const hasIncomeData = incomeGroups.some(([, results]) => (results as MatchResult[]).filter(r => !r.isDeleted).length > 0);
    const hasExpenseData = expenseGroups.some(([, results]) => (results as MatchResult[]).filter(r => !r.isDeleted).length > 0);
    
    const sortGroups = (a: [string, MatchResult[]], b: [string, MatchResult[]]) => {
        if (a[0] === 'unidentified') return 1;
        if (b[0] === 'unidentified') return -1;
        return a[0].localeCompare(b[0]);
    };

    const handleSaveReport = () => {
        if (!reportPreviewData) return;
        // When saving the report, we also exclude deleted items so they don't persist in saved history
        const allResults = [
            ...Object.values(reportPreviewData.income).flat(),
            ...Object.values(reportPreviewData.expenses).flat()
        ].filter((r: any) => !r.isDeleted);
        
        openSaveReportModal({
            type: 'global',
            results: allResults as MatchResult[],
        });
    };

    if (!reportPreviewData) {
        return (
            <EmptyState
                icon={<DocumentDuplicateIcon className="w-8 h-8 text-blue-700 dark:text-blue-400" />}
                title={t('empty.reports.title')}
                message={t('empty.reports.message')}
                action={{ text: t('empty.dashboard.action'), onClick: () => setActiveView('upload') }}
            />
        );
    }

    if (!hasIncomeData && !hasExpenseData) {
       return (
            <>
                 <EmptyState
                    icon={<DocumentDuplicateIcon className="w-8 h-8 text-blue-700 dark:text-blue-400" />}
                    title={t('common.noResults')}
                    message={t('empty.reports.message')}
                />
                 <div className="mt-6 flex justify-center">
                    <button onClick={discardCurrentReport} className="w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-md border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white transition-colors">{t('common.back')}</button>
                </div>
            </>
        );
    }

    const handleGlobalDownload = (format: 'xlsx' | 'pdf') => {
        // Filter out deleted items for global download
        const incomeResults = (reportPreviewData?.income ? Object.values(reportPreviewData.income) : []).flat().filter((r: any) => !r.isDeleted) as MatchResult[];
        const expenseResults = (reportPreviewData?.expenses ? Object.values(reportPreviewData.expenses) : []).flat().filter((r: any) => !r.isDeleted) as MatchResult[];
        
        if (format === 'xlsx') {
            const wb = XLSX.utils.book_new();
            if (incomeResults.length > 0) {
                 const incomeData = incomeResults.map((item: MatchResult) => ({
                    [t('table.church')]: item.church.name,
                    [t('table.date')]: item.transaction.date,
                    [t('table.contributor')]: item.contributor?.name || (item.status === 'NÃO IDENTIFICADO' ? item.transaction.description : t('common.unassigned')),
                    [t('table.amount')]: item.transaction.amount,
                    [t('table.status')]: t(item.status === 'IDENTIFICADO' ? 'table.status.identified' : 'table.status.unidentified'),
                }));
                const incomeSheet = XLSX.utils.json_to_sheet(incomeData);
                XLSX.utils.book_append_sheet(wb, incomeSheet, t('reports.incomeReportTitle').substring(0, 31));
            }
            if (expenseResults.length > 0) {
                const expenseData = expenseResults.map((item: MatchResult) => ({
                    [t('table.date')]: item.transaction.date,
                    [t('table.description')]: item.transaction.description,
                    [t('table.amount')]: item.transaction.amount,
                    [t('table.costCenter')]: item.church.name !== '---' ? item.church.name : '',
                }));
                const expenseSheet = XLSX.utils.json_to_sheet(expenseData);
                XLSX.utils.book_append_sheet(wb, expenseSheet, t('reports.expenseReportTitle').substring(0, 31));
            }
            if (wb.SheetNames.length > 0) {
                XLSX.writeFile(wb, `${t('reports.previewTitle')}.xlsx`);
            }
        } else { // PDF
            const { jsPDF } = jspdf;
            const doc = new jsPDF();
            let yPos = 15;
            
            doc.setFontSize(22);
            doc.text(t('reports.previewTitle'), 14, yPos);
            yPos += 15;

            if (incomeResults.length > 0) {
                if(yPos > 260) { doc.addPage(); yPos = 15; }
                doc.setFontSize(16);
                doc.text(t('reports.incomeReportTitle'), 14, yPos);
                yPos += 10;
                (doc as any).autoTable({
                    startY: yPos,
                    head: [[t('table.church'), t('table.date'), t('table.contributor'), t('table.amount'), t('table.status')]],
                    body: incomeResults.map((item: MatchResult) => [
                        item.church.name, 
                        item.transaction.date, 
                        item.contributor?.name || (item.status === 'NÃO IDENTIFICADO' ? item.transaction.description : t('common.unassigned')), 
                        formatCurrency(item.transaction.amount, language),
                        t(item.status === 'IDENTIFICADO' ? 'table.status.identified' : 'table.status.unidentified')
                    ]),
                    theme: 'grid', styles: { fontSize: 10 }, headStyles: { fillColor: [30, 41, 59] }
                });
                yPos = (doc as any).autoTable.previous.finalY + 10;
            }
            if (expenseResults.length > 0) {
                 if(yPos > 260) { doc.addPage(); yPos = 15; }
                 doc.setFontSize(16);
                 doc.text(t('reports.expenseReportTitle'), 14, yPos);
                 yPos += 10;
                (doc as any).autoTable({
                    startY: yPos,
                    head: [[t('table.date'), t('table.description'), t('table.amount')]],
                    body: expenseResults.map((item: MatchResult) => [item.transaction.date, item.transaction.description, formatCurrency(item.transaction.amount, language)]),
                    theme: 'grid', styles: { fontSize: 10 }, headStyles: { fillColor: [30, 41, 59] }
                });
            }
            doc.save(`${t('reports.previewTitle')}.pdf`);
        }
    };
    
    return (
        <>
            {showSessionBanner && (
                <div className="bg-blue-50 dark:bg-sky-900/40 border-l-4 border-blue-400 dark:border-sky-500 p-4 mb-6 rounded-r-md shadow-sm print-hidden">
                    <h4 className="font-bold text-blue-800 dark:text-sky-200">{t('reports.session.title')}</h4>
                    <p className="text-sm text-blue-700 dark:text-sky-300 mt-1">{t('reports.session.message')}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            onClick={() => setShowSessionBanner(false)}
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white transition-colors"
                        >
                            {t('reports.session.continue')}
                        </button>
                        <button
                            onClick={discardCurrentReport}
                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/70 rounded-md"
                        >
                            {t('reports.session.discard')}
                        </button>
                    </div>
                </div>
            )}
            <div id="print-section" className="space-y-8">
                {hasIncomeData && (
                    <div className={'main-report-headers'}>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('reports.incomeReportTitle')}</h2>
                    </div>
                )}
                {incomeGroups.sort(sortGroups).map(([churchId, results]) => (
                    (results as MatchResult[]).filter(r => !r.isDeleted).length > 0 && <MemoizedReportGroup key={`income-${churchId}`} churchId={churchId} results={results as MatchResult[]} reportType="income" />
                ))}

                {hasExpenseData && (
                     <div className={'main-report-headers mt-12'}>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('reports.expenseReportTitle')}</h2>
                    </div>
                )}
                {expenseGroups.map(([churchId, results]) => (
                    (results as MatchResult[]).filter(r => !r.isDeleted).length > 0 && <MemoizedReportGroup key={`expense-${churchId}`} churchId={churchId} results={results as MatchResult[]} reportType="expenses" />
                ))}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 print:hidden print-hidden">
                <div className="flex gap-4">
                    <button onClick={handleSaveReport} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white transition-colors">
                        <FloppyDiskIcon className="w-5 h-5"/><span>{t('reports.saveReport')}</span>
                     </button>
                     <button onClick={() => (window as any).handleUniversalPrint('global')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white transition-colors">
                        <PrinterIcon className="w-5 h-5"/><span>{t('common.print')}</span>
                     </button>
                     <div className="relative group">
                        <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md">
                            <DocumentArrowDownIcon className="w-5 h-5"/>
                            <span>{t('common.download')}</span>
                        </button>
                        <div className="absolute bottom-full mb-2 right-0 w-32 bg-white dark:bg-slate-700 rounded-md shadow-lg z-10 border dark:border-slate-600 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity transform scale-95 group-hover:scale-100 origin-bottom-right">
                             <button onClick={() => handleGlobalDownload('xlsx')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">Excel (.xlsx)</button>
                             <button onClick={() => handleGlobalDownload('pdf')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">PDF (.pdf)</button>
                        </div>
                     </div>
                </div>
            </div>
        </>
    );
};