
import React, { useContext, useMemo, useState, memo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { EditableReportTable } from '../components/reports/EditableReportTable';
import { SavedReportsView } from './SavedReportsView';
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
    ChartBarIcon,
    UploadIcon,
    ArrowLeftOnRectangleIcon,
    AdjustmentsHorizontalIcon,
    BuildingOfficeIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon
} from '../components/Icons';
import { formatCurrency } from '../utils/formatters';
import { MatchResult, Language } from '../types';
import { parseDate, filterByUniversalQuery, normalizeString } from '../services/processingService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type SortDirection = 'asc' | 'desc';
interface SortConfig {
    key: string;
    direction: SortDirection;
}

interface SummaryStatProps {
    title: string;
    quantity: number;
    value: number;
    percentage: number;
    language: Language;
    theme?: 'slate' | 'indigo' | 'emerald' | 'blue' | 'amber';
}

const SummaryStat: React.FC<SummaryStatProps> = ({ title, quantity, value, percentage, language, theme = 'slate' }) => {
    
    const themeClasses = {
        slate: {
            container: 'bg-slate-50 dark:bg-slate-700/30 border-slate-100 dark:border-slate-700',
            title: 'text-slate-500 dark:text-slate-400',
            value: 'text-brand-graphite dark:text-white',
            badge: 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600',
            subValue: 'text-slate-600 dark:text-slate-300'
        },
        indigo: {
            container: 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/30',
            title: 'text-indigo-600 dark:text-indigo-300',
            value: 'text-brand-graphite dark:text-white',
            badge: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700',
            subValue: 'text-indigo-700 dark:text-indigo-200'
        },
        emerald: {
            container: 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30',
            title: 'text-emerald-600 dark:text-emerald-300',
            value: 'text-brand-graphite dark:text-white',
            badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
            subValue: 'text-emerald-700 dark:text-emerald-200'
        },
        blue: {
            container: 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30',
            title: 'text-blue-600 dark:text-blue-300',
            value: 'text-brand-graphite dark:text-white',
            badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-700',
            subValue: 'text-blue-700 dark:text-blue-200'
        },
        amber: {
            container: 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30',
            title: 'text-amber-600 dark:text-amber-300',
            value: 'text-brand-graphite dark:text-white',
            badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-700',
            subValue: 'text-amber-700 dark:text-amber-200'
        }
    };

    const styles = themeClasses[theme];

    return (
        <div className={`${styles.container} rounded-xl border p-3 flex flex-col transition-all hover:shadow-sm`}>
            <div className="flex justify-between items-start mb-1">
                <dt className={`truncate text-[9px] font-bold uppercase ${styles.title} tracking-wider`}>{title}</dt>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${styles.badge}`}>
                    {percentage.toFixed(0)}%
                </span>
            </div>
            <dd className="flex items-baseline gap-2 mt-auto">
                <span className={`text-lg font-black ${styles.value} tracking-tight leading-none`}>{quantity}</span>
                <span className={`text-[10px] font-bold font-mono ${styles.subValue}`}>{formatCurrency(value, language)}</span>
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
        searchFilters, // Global filters
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'transaction.date', direction: 'desc' });
    const [isCollapsed, setIsCollapsed] = useState(true);

    // Fallback if results is null/undefined
    const safeResults = useMemo(() => Array.isArray(results) ? results : [], [results]);

    const processedResults = useMemo(() => {
        let filteredData = [...safeResults];

        // --- 1. Apply Global Search Filters (from Context) ---
        
        // Date Range
        if (searchFilters.dateRange.start || searchFilters.dateRange.end) {
            const startDate = searchFilters.dateRange.start ? new Date(searchFilters.dateRange.start).getTime() : null;
            const endDate = searchFilters.dateRange.end ? new Date(searchFilters.dateRange.end).getTime() + 86400000 : null; // Include full day
            
            filteredData = filteredData.filter(r => {
                const txDate = parseDate(r.transaction.date)?.getTime();
                if (!txDate) return false;
                if (startDate && txDate < startDate) return false;
                if (endDate && txDate >= endDate) return false;
                return true;
            });
        }

        // Value Filter
        const { operator, value1, value2 } = searchFilters.valueFilter;
        if (operator !== 'any' && value1 !== null) {
            filteredData = filteredData.filter(r => {
                const amount = Math.abs(r.transaction.amount);
                switch (operator) {
                    case 'exact': return amount === value1;
                    case 'gt': return amount > value1;
                    case 'lt': return amount < value1;
                    case 'between': return value2 !== null && amount >= value1 && amount <= value2;
                    default: return true;
                }
            });
        }

        // Reconciliation Status
        if (searchFilters.reconciliationStatus !== 'all') {
            switch (searchFilters.reconciliationStatus) {
                case 'confirmed_any':
                    filteredData = filteredData.filter(r => r.status === 'IDENTIFICADO');
                    break;
                case 'unconfirmed':
                    filteredData = filteredData.filter(r => r.status === 'NÃO IDENTIFICADO');
                    break;
                case 'confirmed_auto':
                    filteredData = filteredData.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod));
                    break;
                case 'confirmed_manual':
                    filteredData = filteredData.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));
                    break;
            }
        }

        // Filter By Church (Specific Global Filter)
        if (searchFilters.filterBy === 'church' && searchFilters.churchIds.length > 0) {
            filteredData = filteredData.filter(r => searchFilters.churchIds.includes(r.church.id));
        }

        // Filter By Contributor Name (Global)
        if (searchFilters.filterBy === 'contributor' && searchFilters.contributorName.trim()) {
             filteredData = filteredData.filter(r => filterByUniversalQuery(r, searchFilters.contributorName));
        }

        // --- 2. Apply Local Text Search (Search Bar inside group) ---
        if (searchQuery.trim()) {
            filteredData = filteredData.filter(r => filterByUniversalQuery(r, searchQuery));
        }

        // --- 3. Sorting ---
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
    }, [safeResults, searchQuery, sortConfig, searchFilters]);

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
    
        const autoConfirmed = processedResults.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod));
        const manualConfirmed = processedResults.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));
        const pendingRows = processedResults.filter(r => r.status === 'NÃO IDENTIFICADO');
        
        const autoConfirmedCount = autoConfirmed.length;
        const manualConfirmedCount = manualConfirmed.length;
        const pendingCount = pendingRows.length;
        const totalCount = processedResults.length;
        
        const autoConfirmedValue = autoConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0);
        const manualConfirmedValue = manualConfirmed.reduce((sum, r) => sum + r.transaction.amount, 0);
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
    
    }, [processedResults, isSimpleGroup]);
    
    const simpleTotalValue = processedResults.reduce((sum, r) => sum + r.transaction.amount, 0);

    // Calculate completion for the visual progress bar (header)
    const completionPercentage = useMemo(() => {
        if (processedResults.length === 0) return 0;
        const identified = processedResults.filter(r => r.status === 'IDENTIFICADO').length;
        return (identified / processedResults.length) * 100;
    }, [processedResults]);

    const getGroupName = (id: string): string => {
        if (id === 'unidentified') return t('reports.unidentifiedGroupTitle');
        if (id === 'all_expenses_group') return t('reports.expenseReportTitle');
        return churches.find(c => c.id === id)?.name || t('reports.unknownChurch');
    };

    const groupName = getGroupName(churchId);

    const getExportName = (item: MatchResult) => {
        const contributorName = item.contributor?.cleanedName || item.contributor?.name;
        const txDesc = item.transaction.cleanedDescription || item.transaction.description;
        const hasValidContributorName = contributorName && contributorName.trim().length > 0 && contributorName !== '---';
        return hasValidContributorName ? contributorName : (txDesc || '---');
    };

    const getExportValue = (item: MatchResult, type: 'income' | 'expenses') => {
        if (type === 'income') {
            const amount = item.contributorAmount ?? item.transaction.amount;
            if (amount !== 0) return formatCurrency(amount, language);
            if (item.contributor?.originalAmount) return item.contributor.originalAmount;
            if (item.transaction.originalAmount) return item.transaction.originalAmount;
            return formatCurrency(0, language);
        } else {
            const amount = item.transaction.amount;
            if (amount !== 0) return formatCurrency(amount, language);
            return item.transaction.originalAmount || formatCurrency(0, language);
        }
    };

    const handlePrintGroup = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const date = new Date().toLocaleDateString();
        
        // Find church specific data for logo
        const currentChurch = churches.find(c => c.id === churchId);
        const churchLogo = currentChurch?.logoUrl;
        
        let tableHeader = '';
        let tableRows = '';

        if (reportType === 'income') {
            if (isUnidentifiedIncome) {
                tableHeader = `<tr><th>Data</th><th>Descrição/Nome</th><th style="text-align:right">Valor</th></tr>`;
                tableRows = processedResults.map(r => `
                    <tr>
                        <td>${r.transaction.date}</td>
                        <td>${r.transaction.cleanedDescription || r.transaction.description}</td>
                        <td style="text-align:right">${getExportValue(r, 'income')}</td>
                    </tr>
                `).join('');
            } else {
                tableHeader = `<tr><th>Data</th><th>Contribuinte</th><th>Método</th><th style="text-align:right">Valor</th></tr>`;
                tableRows = processedResults.map(r => `
                    <tr>
                        <td>${r.transaction.date}</td>
                        <td>${getExportName(r)}</td>
                        <td>${r.matchMethod || 'AUTOMATIC'}</td>
                        <td style="text-align:right">${getExportValue(r, 'income')}</td>
                    </tr>
                `).join('');
            }
        } else {
            tableHeader = `<tr><th>Data</th><th>Descrição</th><th>Centro de Custo</th><th style="text-align:right">Valor</th></tr>`;
            tableRows = processedResults.map(r => `
                <tr>
                    <td>${r.transaction.date}</td>
                    <td>${r.transaction.cleanedDescription || r.transaction.description}</td>
                    <td>${r.church.name !== '---' ? r.church.name : '-'}</td>
                    <td style="text-align:right">${getExportValue(r, 'expenses')}</td>
                </tr>
            `).join('');
        }

        const logoHtml = churchLogo 
            ? `<img src="${churchLogo}" class="church-logo" alt="Logo" />` 
            : '';

        let summaryHtml = '';
        if (summaryMetrics) {
            summaryHtml = `
                <div class="summary-grid">
                    <div class="summary-item">
                        <strong>Total</strong>
                        <span>${summaryMetrics.total.quantity}</span>
                        <small>${formatCurrency(summaryMetrics.total.value, language)}</small>
                    </div>
                    <div class="summary-item success">
                        <strong>Automático</strong>
                        <span>${summaryMetrics.auto.quantity}</span>
                        <small>${formatCurrency(summaryMetrics.auto.value, language)}</small>
                    </div>
                    <div class="summary-item info">
                        <strong>Manual</strong>
                        <span>${summaryMetrics.manual.quantity}</span>
                        <small>${formatCurrency(summaryMetrics.manual.value, language)}</small>
                    </div>
                    <div class="summary-item warning">
                        <strong>Pendente</strong>
                        <span>${summaryMetrics.pending.quantity}</span>
                        <small>${formatCurrency(summaryMetrics.pending.value, language)}</small>
                    </div>
                </div>
            `;
        } else {
            summaryHtml = `
                <div class="summary simple">
                    <div class="summary-item">
                        <strong>Registros</strong>
                        <span>${processedResults.length}</span>
                    </div>
                    <div class="summary-item">
                        <strong>Valor Total</strong>
                        <span>${formatCurrency(simpleTotalValue, language)}</span>
                    </div>
                </div>
            `;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Relatório - ${groupName}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
                        th { background-color: #f1f5f9; font-weight: 700; text-transform: uppercase; color: #475569; padding: 8px; text-align: left; }
                        td { border-bottom: 1px solid #e2e8f0; padding: 8px; color: #334155; }
                        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
                        .summary-item { border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; text-align: center; }
                        .summary-item strong { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
                        .summary-item span { display: block; font-size: 16px; font-weight: 800; color: #0f172a; }
                        .summary-item small { display: block; font-size: 11px; color: #64748b; font-family: monospace; margin-top: 2px; }
                        .header-container { display: flex; align-items: center; margin-bottom: 30px; gap: 20px; }
                        .church-logo { width: 60px; height: 60px; object-fit: contain; border-radius: 8px; }
                        .header-text h1 { margin: 0; font-size: 20px; font-weight: 900; color: #0f172a; }
                        .header-text .meta { font-size: 12px; color: #64748b; margin-top: 4px; }
                    </style>
                </head>
                <body>
                    <div class="header-container">
                        ${logoHtml}
                        <div class="header-text">
                            <h1>${groupName}</h1>
                            <div class="meta">Relatório de Conciliação • Gerado em ${date}</div>
                        </div>
                    </div>
                    
                    ${summaryHtml}

                    <table>
                        <thead>${tableHeader}</thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <script>
                        window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
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
                                ['Valor']: getExportValue(item, 'income'),
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
                            getExportValue(item, 'income'),
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

    // Only render if there are results after filtering
    if (processedResults.length === 0 && (searchQuery || searchFilters.filterBy !== 'none' || searchFilters.dateRange.start || searchFilters.valueFilter.operator !== 'any')) {
        return null;
    }

    const cardBg = isUnidentifiedIncome 
        ? 'bg-amber-50/20 border-l-4 border-l-amber-400 dark:border-l-amber-500 border-y border-r border-slate-100 dark:border-slate-700'
        : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700';
    
    // Dynamic styles for the header button content
    const headerContent = (
        <div className="flex flex-1 items-center justify-between w-full">
            {/* Left: Identity */}
            <div className="flex items-center gap-4 min-w-0">
                <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border
                    ${isUnidentifiedIncome 
                        ? 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' 
                        : 'bg-white text-slate-600 border-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                    }
                `}>
                    {isUnidentifiedIncome ? <ExclamationTriangleIcon className="w-5 h-5"/> : <BuildingOfficeIcon className="w-5 h-5"/>}
                </div>
                <div className="flex flex-col min-w-0 text-left">
                    <h4 className={`text-sm font-bold truncate max-w-[200px] md:max-w-md ${isUnidentifiedIncome ? 'text-amber-800 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>
                        {groupName}
                    </h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        {isUnidentifiedIncome ? 'Requer atenção imediata' : 'Registros processados'}
                    </span>
                </div>
            </div>

            {/* Middle: Progress Bar (Desktop only) */}
            <div className="hidden md:flex flex-col flex-1 px-8 max-w-xs">
                <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase mb-1">
                    <span>{completionPercentage.toFixed(0)}% Identificado</span>
                    <span>{processedResults.length} Total</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${isUnidentifiedIncome ? 'bg-amber-400' : 'bg-brand-blue'}`} 
                        style={{ width: `${completionPercentage}%` }}
                    ></div>
                </div>
            </div>

            {/* Right: Totals & Actions */}
            <div className="flex items-center gap-6">
                <div className="text-right">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                    <span className={`text-sm font-mono font-black ${isUnidentifiedIncome ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                        {formatCurrency(simpleTotalValue, language)}
                    </span>
                </div>
                
                {/* Expand Icon */}
                <div className={`
                    p-1.5 rounded-full transition-all duration-300
                    ${isCollapsed ? 'bg-transparent text-slate-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 transform rotate-180'}
                `}>
                    <ChevronDownIcon className="w-4 h-4" />
                </div>
            </div>
        </div>
    );

    return (
        <div className={`rounded-[1.5rem] overflow-hidden transition-all duration-300 ${cardBg} mb-3 shadow-sm hover:shadow-md group`} data-group-id={churchId}>
            <div className="relative">
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)} 
                    className="w-full px-5 py-4 flex items-center hover:bg-slate-50/50 dark:hover:bg-slate-700/10 transition-colors focus:outline-none"
                >
                    {headerContent}
                </button>

                {/* Floating Quick Actions (Hover Only) */}
                <div className="absolute top-1/2 -translate-y-1/2 right-16 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-1 rounded-full border border-slate-100 dark:border-slate-700 shadow-lg">
                    <button onClick={(e) => { e.stopPropagation(); handleDownload('xlsx', { groupName, results: processedResults, reportType }); }} className="p-2 rounded-full text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors" title="Baixar Excel">
                        <DocumentArrowDownIcon className="w-4 h-4"/>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); (window as any).handleUniversalPrint ? (window as any).handleUniversalPrint(churchId) : handlePrintGroup(); }} className="p-2 rounded-full text-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="Imprimir">
                        <PrinterIcon className="w-4 h-4"/>
                    </button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <button onClick={(e) => { e.stopPropagation(); openDeleteConfirmation({ type: 'report-group', id: churchId, name: `relatório de ${groupName}`, meta: { reportType }}); }} className="p-2 rounded-full text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors" title="Excluir Grupo">
                        <TrashIcon className="w-4 h-4"/>
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <div className="animate-fade-in border-t border-slate-100 dark:border-slate-700/50">
                    {/* MOVED: Summary Metrics to Top */}
                    {summaryMetrics && (
                        <div className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-700/50 p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <SummaryStat title="Total" quantity={summaryMetrics.total.quantity} value={summaryMetrics.total.value} percentage={100} language={language} theme="indigo" />
                                <SummaryStat title={t('reports.summary.autoConfirmed')} quantity={summaryMetrics.auto.quantity} value={summaryMetrics.auto.value} percentage={summaryMetrics.auto.percentage} language={language} theme="emerald" />
                                <SummaryStat title={t('reports.summary.manualConfirmed')} quantity={summaryMetrics.manual.quantity} value={summaryMetrics.manual.value} percentage={summaryMetrics.manual.percentage} language={language} theme="blue" />
                                <SummaryStat title={t('reports.summary.unidentifiedPending')} quantity={summaryMetrics.pending.quantity} value={summaryMetrics.pending.value} percentage={summaryMetrics.pending.percentage} language={language} theme="amber" />
                            </div>
                        </div>
                    )}

                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30 flex justify-end">
                        <div className="relative w-full max-w-[200px]">
                            <SearchIcon className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                className="block w-full pl-9 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] font-medium focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all placeholder:text-slate-400"
                                placeholder={t('common.search')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <XMarkIcon className="h-3 w-3" />
                                </button>
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
                    
                    {!summaryMetrics && (
                        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total: <span className="text-slate-900 dark:text-white">{processedResults.length}</span></span>
                            <span className="font-bold text-slate-900 dark:text-white font-mono">{formatCurrency(simpleTotalValue, language)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const ReportsView: React.FC = () => {
    const { 
        reportPreviewData, 
        openSaveReportModal, 
        discardCurrentReport, 
        openSearchFilters, 
        searchFilters,
        openRecompareModal // New action
    } = useContext(AppContext);
    
    const { t } = useTranslation();
    const { setActiveView } = useUI();

    const [activeTab, setActiveTab] = useState<'income' | 'expenses'>('income');

    // 1. Always call hooks, handle missing data safely with fallbacks
    // If no report data, we default to empty structures, but we DO NOT return early yet.
    const incomeGroups = reportPreviewData ? Object.keys(reportPreviewData.income) : [];
    const expenseGroups = reportPreviewData ? Object.keys(reportPreviewData.expenses) : [];
    const hasIncome = incomeGroups.length > 0;
    const hasExpenses = expenseGroups.length > 0;

    const handleSaveGlobalReport = () => {
        if (!reportPreviewData) return;
        const { income, expenses } = reportPreviewData;
        const resultsToSave = [...Object.values(income).flat(), ...Object.values(expenses).flat()];
        
        openSaveReportModal({
            type: 'global',
            results: resultsToSave,
            groupName: 'Geral'
        });
    };

    // 2. Call effects safely
    React.useEffect(() => {
        if (!reportPreviewData) return; // Guard inside effect
        if (!hasIncome && hasExpenses && activeTab === 'income') setActiveTab('expenses');
        if (hasIncome && !hasExpenses && activeTab === 'expenses') setActiveTab('income');
    }, [hasIncome, hasExpenses, activeTab, reportPreviewData]);

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

    // 3. Conditional rendering comes LAST, ensuring hooks order is preserved
    if (!reportPreviewData) {
        return <SavedReportsView />;
    }

    return (
        <div className="flex flex-col h-full animate-fade-in gap-4 pb-2">
            {/* Header */}
            <div className="flex-shrink-0 flex flex-col xl:flex-row xl:items-end justify-between gap-3 px-1">
                <div>
                    <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('reports.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1 max-w-xl">{t('reports.subtitle')}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    <button 
                        onClick={() => setActiveView('savedReports')}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-brand-blue dark:hover:text-blue-400 hover:border-brand-blue/30 shadow-sm"
                    >
                        <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                        <span>{t('nav.savedReports')}</span>
                    </button>

                    <button 
                        onClick={openRecompareModal}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 shadow-sm"
                        title="Reajustar parâmetros e processar novamente"
                    >
                        <ArrowPathIcon className="w-3.5 h-3.5" />
                        <span>Refazer</span>
                    </button>

                    <button 
                        onClick={openSearchFilters}
                        className="relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-brand-blue dark:hover:text-blue-400 hover:border-brand-blue/30 shadow-sm"
                    >
                        <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
                        <span>{t('search.filters')}</span>
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm border-2 border-white dark:border-slate-800">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    <button 
                        onClick={discardCurrentReport}
                        className="px-4 py-1.5 text-[10px] font-bold text-slate-500 hover:text-red-500 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all uppercase tracking-wide border border-transparent hover:border-red-100"
                    >
                        {t('common.close')}
                    </button>
                    <button 
                        onClick={handleSaveGlobalReport}
                        className="flex items-center gap-1.5 px-5 py-1.5 text-white bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] rounded-full shadow-md shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-wide text-[10px] font-bold"
                    >
                        <FloppyDiskIcon className="w-3.5 h-3.5" />
                        <span>{t('reports.saveReport')}</span>
                    </button>
                </div>
            </div>

            {/* Tabs & Content */}
            {(hasIncome && hasExpenses) && (
                <div className="flex-shrink-0 flex bg-white dark:bg-slate-800 p-0.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm w-fit mx-auto md:mx-0">
                    <button
                        onClick={() => setActiveTab('income')}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${activeTab === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                        <span>{t('upload.income')}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('expenses')}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${activeTab === 'expenses' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <UploadIcon className="w-3.5 h-3.5" />
                        <span>{t('upload.expenses')}</span>
                    </button>
                </div>
            )}

            {/* Report Content - Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3 pb-4">
                {activeTab === 'income' && incomeGroups.length > 0 && (
                    <>
                        {reportPreviewData && reportPreviewData.income['unidentified'] && reportPreviewData.income['unidentified'].length > 0 && (
                            <ReportGroup key="unidentified" churchId="unidentified" results={reportPreviewData.income['unidentified']} reportType="income" />
                        )}
                        {incomeGroups.filter(id => id !== 'unidentified').map(churchId => (
                            <ReportGroup key={churchId} churchId={churchId} results={(reportPreviewData?.income[churchId]) || []} reportType="income" />
                        ))}
                    </>
                )}

                {activeTab === 'expenses' && expenseGroups.length > 0 && (
                    expenseGroups.map(groupId => (
                        <ReportGroup key={groupId} churchId={groupId} results={(reportPreviewData?.expenses[groupId]) || []} reportType="expenses" />
                    ))
                )}
                
                {/* Empty state message when filters hide everything */}
                {activeTab === 'income' && incomeGroups.length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-xs italic">
                            Nenhum resultado encontrado com os filtros atuais.
                        </div>
                )}
            </div>
        </div>
    );
};
