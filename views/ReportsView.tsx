
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
    ChevronRightIcon,
    FloppyDiskIcon,
    ChartBarIcon
} from '../components/Icons';
import { formatCurrency } from '../utils/formatters';
import { MatchResult, Language } from '../types';
import { parseDate, filterByUniversalQuery } from '../services/processingService';

// Declarations for globally loaded libraries
declare const XLSX: any;
declare const jspdf: { jsPDF: any };

type SortDirection = 'asc' | 'desc';
interface SortConfig {
    key: string;
    direction: SortDirection;
}

const SummaryStat: React.FC<{ title: string; quantity: number; value: number; percentage: number; language: Language; colorClass?: string }> = ({ title, quantity, value, percentage, language, colorClass = 'text-slate-800 dark:text-white' }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-600 p-5 flex flex-col hover:border-blue-200 transition-colors">
            <dt className="truncate text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-3">{title}</dt>
            <dd className="flex items-baseline justify-between mb-1">
                <span className={`text-3xl font-extrabold ${colorClass}`}>{quantity}</span>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-600">
                    {percentage.toFixed(1)}%
                </span>
            </dd>
            <dd className="mt-auto">
                <span className={`text-sm font-semibold text-slate-600 dark:text-slate-300`}>{formatCurrency(value, language)}</span>
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
        updateReportData,
        openDeleteConfirmation,
        openManualIdentify,
        handleAnalyze,
        loadingAiId,
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'transaction.date', direction: 'desc' });
    const [isCollapsed, setIsCollapsed] = useState(true);

    const processedResults = useMemo(() => {
        let filteredData = [...results];

        // --- Filtering ---
        if (searchQuery.trim()) {
            filteredData = results.filter(r => filterByUniversalQuery(r, searchQuery));
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
    const isSimpleGroup = reportType === 'expenses' || churchId === 'unidentified';

    const summaryMetrics = useMemo(() => {
        if (isSimpleGroup) return null;
    
        // Calculate metrics based on the ACTUAL rows in the table (results),
        // not the source file. This ensures deletions update the summary.

        const autoConfirmed = results.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod));
        const manualConfirmed = results.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));
        const pendingRows = results.filter(r => r.status === 'NÃO IDENTIFICADO');
        
        const autoConfirmedCount = autoConfirmed.length;
        const manualConfirmedCount = manualConfirmed.length;
        const pendingCount = pendingRows.length;
        const totalCount = results.length;
        
        const autoConfirmedValue = autoConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0);
        const manualConfirmedValue = manualConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0);
        
        // For pending rows (which are usually contributors not yet matched), the transaction.amount is 0.
        // We must use contributorAmount to get the value of the missing contribution.
        const pendingValue = pendingRows.reduce((sum, r) => sum + (r.contributorAmount || 0), 0);

        const totalValue = autoConfirmedValue + manualConfirmedValue + pendingValue;

        return {
            auto: {
                quantity: autoConfirmedCount,
                value: autoConfirmedValue,
                percentage: totalCount > 0 ? (autoConfirmedCount / totalCount) * 100 : 0,
            },
            manual: {
                quantity: manualConfirmedCount,
                value: manualConfirmedValue,
                percentage: totalCount > 0 ? (manualConfirmedCount / totalCount) * 100 : 0,
            },
            pending: {
                quantity: pendingCount,
                value: pendingValue,
                percentage: totalCount > 0 ? (pendingCount / totalCount) * 100 : 0,
            },
            total: {
                quantity: totalCount,
                value: totalValue,
                percentage: 100,
            }
        };
    
    }, [results, isSimpleGroup]);
    
    // Simple summary logic for expenses and unidentified
    const simpleTotalRecords = results.length;
    const simpleTotalValue = results.reduce((sum, r) => sum + r.transaction.amount, 0);

    const getGroupName = (id: string): string => {
        if (id === 'unidentified') return t('reports.unidentifiedGroupTitle');
        if (id === 'all_expenses_group') return t('reports.expenseReportTitle');
        return churches.find(c => c.id === id)?.name || t('reports.unknownChurch');
    };

    const groupName = getGroupName(churchId);

    // Helper for robust name display in exports
    const getExportName = (item: MatchResult) => {
        const contributorName = item.contributor?.cleanedName || item.contributor?.name;
        const txDesc = item.transaction.cleanedDescription || item.transaction.description;
        // Logic: if contributor name exists, is valid and is not placeholder, use it. Else fallback to transaction description.
        const hasValidContributorName = contributorName && contributorName.trim().length > 0 && contributorName !== '---';
        return hasValidContributorName ? contributorName : (txDesc || '---');
    };

    // Helper for robust value display in exports (matches EditableReportTable logic)
    const getExportValue = (item: MatchResult, type: 'income' | 'expenses') => {
        if (type === 'income') {
            if (item.contributor?.originalAmount) return item.contributor.originalAmount;
            if (item.transaction.originalAmount) return item.transaction.originalAmount;
            return ((item.contributorAmount != null) ? formatCurrency(item.contributorAmount, language) : formatCurrency(item.transaction.amount, language));
        } else {
            return item.transaction.originalAmount || formatCurrency(item.transaction.amount, language);
        }
    };

    const handleDownload = (
        format: 'xlsx' | 'pdf',
        groupData?: { groupName: string; results: MatchResult[]; reportType: 'income' | 'expenses' }
    ) => {
        const dataToExport = groupData ? [groupData] : [{ groupName, results: processedResults, reportType }];
    
        if (format === 'xlsx') {
            const wb = XLSX.utils.book_new();
            dataToExport.forEach(group => {
                const mappedData = group.results.map(item => {
                    if (group.reportType === 'income') {
                         if (isUnidentifiedIncome) {
                            return {
                                [t('table.date')]: item.transaction.date,
                                [t('table.name')]: item.transaction.cleanedDescription || item.transaction.description,
                                ['Valor']: item.transaction.originalAmount || formatCurrency(item.transaction.amount, language),
                            };
                        }
                        return {
                            [t('table.date')]: item.transaction.date,
                            [t('table.contributor')]: getExportName(item),
                            [t('table.description')]: item.transaction.description,
                            [t('table.percentage')]: item.similarity != null ? `${item.similarity.toFixed(0)}%` : '0%',
                            [t('table.amount')]: getExportValue(item, 'income'),
                            [t('table.status')]: t(item.status === 'IDENTIFICADO' ? 'table.status.identified' : 'table.status.unidentified'),
                        };
                    } else { // expenses
                        return {
                            [t('table.date')]: item.transaction.date,
                            [t('table.description')]: item.transaction.cleanedDescription || item.transaction.description,
                            [t('table.amount')]: getExportValue(item, 'expenses'),
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
                            item.transaction.originalAmount || formatCurrency(item.transaction.amount, language),
                        ]);
                    } else {
                        head = [[t('table.date'), t('table.contributor'), t('table.amount'), t('table.status')]];
                        body = group.results.map(item => [
                            item.transaction.date,
                            getExportName(item),
                            getExportValue(item, 'income'),
                            t(item.status === 'IDENTIFICADO' ? 'table.status.identified' : 'table.status.unidentified'),
                        ]);
                    }
                } else {
                    head = [[t('table.date'), t('table.description'), t('table.amount'), t('table.costCenter')]];
                    body = group.results.map(item => [
                        item.transaction.date,
                        item.transaction.cleanedDescription || item.transaction.description,
                        getExportValue(item, 'expenses'),
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
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button onClick={() => setIsCollapsed(!isCollapsed)} className="w-full px-5 py-4 flex items-center justify-between bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                        <div className="flex items-center space-x-3">
                            {isCollapsed ? <ChevronRightIcon className="w-5 h-5 text-amber-500" /> : <ChevronDownIcon className="w-5 h-5 text-amber-500" />}
                            <span className="font-bold text-lg text-slate-800 dark:text-white">{groupName}</span>
                            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full dark:bg-amber-900/50 dark:text-amber-400">{results.length}</span>
                        </div>
                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleDownload('xlsx', { groupName, results: processedResults, reportType })} className="p-2 rounded-lg text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/50 transition-colors shadow-sm" title="Baixar Excel">
                                <DocumentArrowDownIcon className="w-5 h-5"/>
                            </button>
                            <button onClick={() => (window as any).handleUniversalPrint(churchId)} className="p-2 rounded-lg text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800 dark:hover:bg-indigo-900/50 transition-colors shadow-sm" title="Imprimir">
                                <PrinterIcon className="w-5 h-5"/>
                            </button>
                            <button onClick={() => openDeleteConfirmation({ type: 'report-group', id: churchId, name: `relatório de ${groupName}`, meta: { reportType }})} className="p-2 rounded-lg text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-900/50 transition-colors shadow-sm" title="Excluir Grupo">
                                <TrashIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    </button>
                    
                    {!isCollapsed && (
                    <div className="border-t border-slate-100 dark:border-slate-700">
                        <div className="p-4 bg-white dark:bg-slate-800 print-hidden border-b border-slate-100 dark:border-slate-700">
                            <label htmlFor="unidentified-search" className="sr-only">{t('common.search')}</label>
                            <div className="relative max-w-md">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <SearchIcon className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    id="unidentified-search"
                                    className="block w-full pl-10 pr-10 py-2.5 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 rounded-lg leading-5 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 sm:text-sm transition-all"
                                    placeholder="Buscar por nome, valor ou data..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                        <button onClick={() => setSearchQuery('')} className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none">
                                            <XMarkIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700/50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 font-semibold tracking-wider border-b border-slate-100 dark:border-slate-700">{t('table.date')}</th>
                                        <th scope="col" className="px-6 py-3 font-semibold tracking-wider border-b border-slate-100 dark:border-slate-700">{t('table.name')}</th>
                                        <th scope="col" className="px-6 py-3 font-semibold tracking-wider border-b border-slate-100 dark:border-slate-700 text-right">Valor</th>
                                        <th scope="col" className="px-6 py-3 font-semibold tracking-wider border-b border-slate-100 dark:border-slate-700 text-center">{t('table.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {processedResults.map(result => (
                                        <tr key={result.transaction.id} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">{result.transaction.date}</td>
                                            <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 max-w-sm truncate">{result.transaction.cleanedDescription || result.transaction.description}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{result.transaction.originalAmount || formatCurrency(result.transaction.amount, language)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center space-x-2">
                                                    <button onClick={() => openManualIdentify(result.transaction.id)} disabled={!!loadingAiId} className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50 transition-colors">
                                                        <UserPlusIcon className="w-3 h-3 mr-1.5" />
                                                        {t('table.actions.manual')}
                                                    </button>
                                                    <button onClick={() => handleAnalyze(result.transaction.id)} disabled={!!loadingAiId} className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-900/50 transition-colors">
                                                        {loadingAiId === result.transaction.id ? (
                                                            <><svg className="animate-spin -ml-1 mr-1.5 h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{t('table.actions.analyzing')}</>
                                                        ) : (
                                                            <><SparklesIcon className="w-3 h-3 mr-1.5" />{t('table.actions.ai')}</>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {processedResults.length === 0 && (
                                <p className="text-center text-slate-500 dark:text-slate-400 py-12">{t('common.noResults')}</p>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center rounded-b-xl">
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('reports.summary.total')}: <span className="text-slate-900 dark:text-white font-bold">{results.length}</span></span>
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('reports.summary.totalValue')}: <span className="text-slate-900 dark:text-white font-bold text-lg">{formatCurrency(simpleTotalValue, language)}</span></span>
                        </div>
                    </div>
                    )}
                </div>
            </div>
        );
    }
    
    // Normal report group layout (Expenses and Identified Income)
    return (
        <div className="report-group-wrapper" data-group-id={churchId}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden">
                <button onClick={() => setIsCollapsed(!isCollapsed)} className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-700/20 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-center space-x-3">
                        {isCollapsed ? <ChevronRightIcon className="w-5 h-5 text-slate-400" /> : <ChevronDownIcon className="w-5 h-5 text-slate-400" />}
                        <span className="font-bold text-lg text-slate-800 dark:text-white">{groupName}</span>
                        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full dark:bg-indigo-900/50 dark:text-indigo-400">{results.length}</span>
                    </div>
                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleDownload('xlsx', { groupName, results: processedResults, reportType })} className="p-2 rounded-lg text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/50 transition-colors shadow-sm" title="Baixar Excel">
                            <DocumentArrowDownIcon className="w-5 h-5"/>
                        </button>
                        <button onClick={() => (window as any).handleUniversalPrint(churchId)} className="p-2 rounded-lg text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800 dark:hover:bg-indigo-900/50 transition-colors shadow-sm" title="Imprimir">
                            <PrinterIcon className="w-5 h-5"/>
                        </button>
                        <button onClick={() => openDeleteConfirmation({ type: 'report-group', id: churchId, name: `relatório de ${groupName}`, meta: { reportType }})} className="p-2 rounded-lg text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-900/50 transition-colors shadow-sm" title="Excluir Grupo">
                            <TrashIcon className="w-5 h-5"/>
                        </button>
                    </div>
                </button>

                {!isCollapsed && (
                    <div className="border-t border-slate-100 dark:border-slate-700">
                        {summaryMetrics && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-50 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-700">
                                <SummaryStat title="Total" quantity={summaryMetrics.total.quantity} value={summaryMetrics.total.value} percentage={100} language={language} />
                                <SummaryStat title={t('reports.summary.autoConfirmed')} quantity={summaryMetrics.auto.quantity} value={summaryMetrics.auto.value} percentage={summaryMetrics.auto.percentage} language={language} colorClass="text-emerald-600 dark:text-emerald-400" />
                                <SummaryStat title={t('reports.summary.manualConfirmed')} quantity={summaryMetrics.manual.quantity} value={summaryMetrics.manual.value} percentage={summaryMetrics.manual.percentage} language={language} colorClass="text-blue-600 dark:text-blue-400" />
                                <SummaryStat title={t('reports.summary.unidentifiedPending')} quantity={summaryMetrics.pending.quantity} value={summaryMetrics.pending.value} percentage={summaryMetrics.pending.percentage} language={language} colorClass="text-amber-600 dark:text-amber-400" />
                            </div>
                        )}

                        <div className="p-4 bg-white dark:bg-slate-800 print-hidden border-b border-slate-100 dark:border-slate-700 flex justify-end">
                            <div className="relative w-full max-w-xs">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <SearchIcon className="h-4 w-4 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    className="block w-full pl-9 pr-8 py-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    placeholder={t('common.search')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                                        <button onClick={() => setSearchQuery('')} className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none">
                                            <XMarkIcon className="h-3 w-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <EditableReportTable
                            data={processedResults}
                            onRowChange={(updatedRow) => updateReportData(updatedRow, reportType)}
                            reportType={reportType}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export const ReportsView: React.FC = () => {
    const { reportPreviewData } = useContext(AppContext);
    const { setActiveView } = useUI();
    const { t } = useTranslation();

    const renderContent = () => {
        if (!reportPreviewData || (Object.keys(reportPreviewData.income).length === 0 && Object.keys(reportPreviewData.expenses).length === 0)) {
             return (
                <div className="mt-8">
                    <EmptyState
                        icon={<ChartBarIcon className="w-12 h-12 text-slate-400" />}
                        title={t('reports.noData')}
                        message={t('empty.reports.message')}
                        action={{
                            text: t('upload.title'),
                            onClick: () => setActiveView('upload'),
                        }}
                    />
                </div>
            );
        }

        const { income, expenses } = reportPreviewData;
        const incomeGroups = Object.keys(income);
        const expenseGroups = Object.keys(expenses);

        return (
            <div className="space-y-8 pb-10">
                {/* Income Section */}
                {incomeGroups.length > 0 && (
                    <div className="animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-4 px-1">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                                <DocumentArrowDownIcon className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">{t('reports.incomeReportTitle')}</h3>
                        </div>
                        <div className="space-y-6">
                            {incomeGroups.map(churchId => (
                                <ReportGroup 
                                    key={`income-${churchId}`} 
                                    churchId={churchId} 
                                    results={income[churchId]} 
                                    reportType="income" 
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Expenses Section */}
                {expenseGroups.length > 0 && (
                    <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                        <div className="flex items-center gap-3 mb-4 mt-8 px-1">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                                <DocumentDuplicateIcon className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">{t('reports.expenseReportTitle')}</h3>
                        </div>
                        <div className="space-y-6">
                            {expenseGroups.map(groupId => (
                                <ReportGroup 
                                    key={`expense-${groupId}`} 
                                    churchId={groupId} 
                                    results={expenses[groupId]} 
                                    reportType="expenses" 
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full lg:h-[calc(100vh-5.5rem)] animate-fade-in gap-4 pb-2">
            {/* Main Header with Actions */}
            <div className="flex-shrink-0 flex items-center justify-between gap-3 py-2">
                <div>
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-indigo-800 dark:from-white dark:to-indigo-200 tracking-tight">{t('reports.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{t('reports.subtitle')}</p>
                </div>
                <button 
                    onClick={() => setActiveView('savedReports')} 
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl text-xs font-bold uppercase tracking-wide transition-all shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 border border-transparent"
                >
                    <DocumentDuplicateIcon className="w-4 h-4 text-white" />
                    <span>{t('savedReports.title')}</span>
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                {renderContent()}
            </div>
        </div>
    );
};
