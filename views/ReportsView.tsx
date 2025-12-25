
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
    ArrowPathIcon,
    CheckBadgeIcon
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
            subValue: 'text-indigo-700 dark:text-indigo-200'
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
        searchFilters,
        openBulkManualIdentify
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'transaction.date', direction: 'desc' });
    const [isCollapsed, setIsCollapsed] = useState(true);

    const safeResults = useMemo(() => Array.isArray(results) ? results : [], [results]);

    const processedResults = useMemo(() => {
        let filteredData = [...safeResults];

        if (searchFilters.dateRange.start || searchFilters.dateRange.end) {
            const startDate = searchFilters.dateRange.start ? new Date(searchFilters.dateRange.start).getTime() : null;
            const endDate = searchFilters.dateRange.end ? new Date(searchFilters.dateRange.end).getTime() + 86400000 : null;
            filteredData = filteredData.filter(r => {
                const txDate = parseDate(r.transaction.date)?.getTime();
                if (!txDate) return false;
                if (startDate && txDate < startDate) return false;
                if (endDate && txDate >= endDate) return false;
                return true;
            });
        }

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

        if (searchFilters.filterBy === 'church' && searchFilters.churchIds.length > 0) {
            filteredData = filteredData.filter(r => searchFilters.churchIds.includes(r.church.id));
        }

        if (searchFilters.filterBy === 'contributor' && searchFilters.contributorName.trim()) {
             filteredData = filteredData.filter(r => filterByUniversalQuery(r, searchFilters.contributorName));
        }

        if (searchQuery.trim()) {
            filteredData = filteredData.filter(r => filterByUniversalQuery(r, searchQuery));
        }

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
                    return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
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
            auto: { quantity: autoConfirmedCount, value: autoConfirmedValue, percentage: totalCount > 0 ? (autoConfirmedCount / totalCount) * 100 : 0 },
            manual: { quantity: manualConfirmedCount, value: manualConfirmedValue, percentage: totalCount > 0 ? (manualConfirmedCount / totalCount) * 100 : 0 },
            pending: { quantity: pendingCount, value: pendingValue, percentage: totalCount > 0 ? (pendingCount / totalCount) * 100 : 0 },
            total: { quantity: totalCount, value: totalValue, percentage: 100 }
        };
    }, [processedResults, isSimpleGroup]);
    
    const simpleTotalValue = processedResults.reduce((sum, r) => sum + r.transaction.amount, 0);

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

    const handleBulkIdentify = () => {
        const transactions = processedResults.map(r => r.transaction);
        openBulkManualIdentify(transactions);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const tableRows = processedResults.map(r => {
            const amount = reportType === 'income' 
                ? (r.contributorAmount ?? r.transaction.amount)
                : r.transaction.amount;
            
            const mainName = reportType === 'income' 
                ? (r.contributor?.cleanedName || r.contributor?.name || '---') 
                : (r.transaction.cleanedDescription || r.transaction.description);

            return `
                <tr>
                    <td style="font-family: monospace;">${r.transaction.date}</td>
                    <td>${mainName}</td>
                    <td style="text-align:right; font-family: monospace; font-weight: bold;">${formatCurrency(amount, language)}</td>
                    <td style="text-align:center; font-size: 9px;">${r.status}</td>
                </tr>
            `;
        }).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>${groupName}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; }
                        .header { border-bottom: 3px solid #0052cc; padding-bottom: 15px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                        .header h1 { margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; }
                        .header .meta { text-align: right; font-size: 10px; color: #64748b; font-weight: 600; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th { background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px 10px; text-align: left; font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1px; }
                        td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
                        .summary { margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 12px; display: flex; gap: 40px; }
                        .summary-item { display: flex; flex-direction: column; }
                        .summary-item .label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
                        .summary-item .value { font-size: 16px; font-weight: 800; color: #0f172a; }
                        @media print {
                            body { padding: 0; }
                            @page { margin: 1.5cm; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <h1>${groupName}</h1>
                            <div style="font-size: 12px; font-weight: 600; color: #0052cc; margin-top: 4px;">Relatório de Conciliação Bancária</div>
                        </div>
                        <div class="meta">
                            Gerado em: ${new Date().toLocaleString(language)}<br>
                            Registros: ${processedResults.length}
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 15%;">Data</th>
                                <th>${reportType === 'income' ? 'Contribuinte / Nome' : 'Descrição da Transação'}</th>
                                <th style="text-align:right; width: 20%;">Valor</th>
                                <th style="text-align:center; width: 15%;">Status</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>

                    <div class="summary">
                         <div class="summary-item">
                            <span class="label">Total de Registros</span>
                            <span class="value">${processedResults.length}</span>
                        </div>
                        <div class="summary-item">
                            <span class="label">Valor Total Acumulado</span>
                            <span class="value">${formatCurrency(simpleTotalValue, language)}</span>
                        </div>
                    </div>

                    <div style="margin-top: 80px; display: flex; justify-content: space-around;">
                        <div style="text-align: center;">
                            <div style="width: 200px; border-top: 1px solid #000; margin-bottom: 8px;"></div>
                            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase;">Tesouraria</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 200px; border-top: 1px solid #000; margin-bottom: 8px;"></div>
                            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase;">Responsável</div>
                        </div>
                    </div>

                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleDownload = (format: 'xlsx' | 'pdf', groupData?: { groupName: string; results: MatchResult[]; reportType: 'income' | 'expenses' }) => {
        const dataToExport = groupData ? [groupData] : [{ groupName, results: processedResults, reportType }];
        if (format === 'xlsx') {
            const wb = XLSX.utils.book_new();
            dataToExport.forEach(group => {
                const mappedData = group.results.map(item => {
                    if (group.reportType === 'income') {
                         if (isUnidentifiedIncome) {
                            return { [t('table.date')]: item.transaction.date, [t('table.name')]: item.transaction.cleanedDescription || item.transaction.description, ['Valor']: item.transaction.amount };
                        }
                        return { [t('table.date')]: item.transaction.date, [t('table.contributor')]: item.contributor?.cleanedName || item.contributor?.name || '---', [t('table.description')]: item.transaction.description, [t('table.percentage')]: item.similarity != null ? `${item.similarity.toFixed(0)}%` : '0%', [t('table.amount')]: item.transaction.amount, [t('table.status')]: t(item.status === 'IDENTIFICADO' ? 'table.status.identified' : 'table.status.unidentified') };
                    } else {
                        return { [t('table.date')]: item.transaction.date, [t('table.description')]: item.transaction.cleanedDescription || item.transaction.description, [t('table.amount')]: item.transaction.amount, [t('table.costCenter')]: item.church.name !== '---' ? item.church.name : '' };
                    }
                });
                const sheet = XLSX.utils.json_to_sheet(mappedData);
                XLSX.utils.book_append_sheet(wb, sheet, group.groupName.replace(/[:\\/?*[\]]/g, '').substring(0, 31));
            });
            XLSX.writeFile(wb, `${groupName}.xlsx`);
        } else {
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
                        body = group.results.map(item => [item.transaction.date, item.transaction.cleanedDescription || item.transaction.description, item.transaction.amount]);
                    } else {
                        head = [[t('table.date'), t('table.contributor'), t('table.amount'), t('table.status')]];
                        body = group.results.map(item => [item.transaction.date, item.contributor?.cleanedName || item.contributor?.name || '---', item.transaction.amount, t(item.status === 'IDENTIFICADO' ? 'table.status.identified' : 'table.status.unidentified')]);
                    }
                } else {
                    head = [[t('table.date'), t('table.description'), t('table.amount'), t('table.costCenter')]];
                    body = group.results.map(item => [item.transaction.date, item.transaction.cleanedDescription || item.transaction.description, item.transaction.amount, item.church.name !== '---' ? item.church.name : '']);
                }
                (doc as any).autoTable({ startY: yPos, head, body, theme: 'grid', styles: { fontSize: 10 }, headStyles: { fillColor: [30, 41, 59] } });
                yPos = (doc as any).autoTable.previous.finalY + 10;
            });
            doc.save(`${groupName}.pdf`);
        }
    };

    // Removed the "return null" blocking to allow "No Results" placeholder to show if filtered
    // This fixes the issue where filtering might hide the group entirely if results are 0
    if (safeResults.length === 0) {
        return null;
    }

    const cardBg = isUnidentifiedIncome 
        ? 'bg-white dark:bg-slate-800 border-l-[6px] border-l-amber-500 border-y border-r border-amber-100 dark:border-amber-900/50 shadow-xl shadow-amber-500/5'
        : 'bg-white dark:bg-slate-800 border-l-[6px] border-l-brand-blue border-y border-r border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg transition-all duration-300';
    
    const headerContent = (
        <div className="flex flex-1 items-center justify-between w-full">
            <div className="flex items-center gap-4 min-w-0">
                <div className={`
                    w-11 h-11 rounded-xl flex items-center justify-center text-lg shadow-sm border transition-transform group-hover:scale-105
                    ${isUnidentifiedIncome 
                        ? 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' 
                        : 'bg-blue-50 text-brand-blue border-blue-100 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                    }
                `}>
                    {isUnidentifiedIncome ? <ExclamationTriangleIcon className="w-5 h-5"/> : <BuildingOfficeIcon className="w-5 h-5"/>}
                </div>
                <div className="flex flex-col min-w-0 text-left">
                    <h4 className={`text-base font-black truncate max-w-[200px] md:max-w-md tracking-tight ${isUnidentifiedIncome ? 'text-amber-900 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                        {groupName}
                    </h4>
                    <span className={`text-[10px] uppercase font-bold tracking-widest ${isUnidentifiedIncome ? 'text-amber-600 dark:text-amber-500/70' : 'text-slate-400 dark:text-slate-500'}`}>
                        {isUnidentifiedIncome ? 'Requer atenção imediata' : 'Registros processados'}
                    </span>
                </div>
            </div>

            <div className="hidden md:flex flex-col flex-1 px-10 max-w-sm">
                <div className="flex justify-between text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1.5 tracking-wider">
                    <span className={isUnidentifiedIncome ? 'text-amber-600' : 'text-brand-blue'}>{completionPercentage.toFixed(0)}% IDENTIFICADO</span>
                    <span>{safeResults.length} TOTAL</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                    <div 
                        className={`h-full rounded-full transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) ${isUnidentifiedIncome ? 'bg-amber-500' : 'bg-brand-blue'}`} 
                        style={{ width: `${completionPercentage}%` }}
                    ></div>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="text-right">
                    <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Total Acumulado</span>
                    <span className={`text-lg font-mono font-black tracking-tighter ${isUnidentifiedIncome ? 'text-amber-600 dark:text-amber-400' : 'text-brand-blue dark:text-white'}`}>
                        {formatCurrency(simpleTotalValue, language)}
                    </span>
                </div>
                
                <div className={`
                    p-2 rounded-full transition-all duration-300
                    ${isCollapsed ? 'bg-slate-50 dark:bg-slate-800 text-slate-400' : 'bg-brand-blue text-white shadow-lg transform rotate-180'}
                `}>
                    <ChevronDownIcon className="w-4 h-4" />
                </div>
            </div>
        </div>
    );

    return (
        <div className={`rounded-2xl overflow-hidden mb-5 ${cardBg} group translate-y-0 hover:-translate-y-0.5`} data-group-id={churchId}>
            <div className="relative">
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)} 
                    className={`w-full px-6 py-5 flex items-center transition-colors focus:outline-none ${isCollapsed ? 'hover:bg-slate-50/30 dark:hover:bg-slate-700/10' : 'bg-slate-50/80 dark:bg-slate-800/80'}`}
                >
                    {headerContent}
                </button>

                <div className="absolute top-1/2 -translate-y-1/2 right-16 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm p-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-xl z-20">
                    <button onClick={(e) => { e.stopPropagation(); handleDownload('xlsx'); }} className="p-2 rounded-full text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors" title="Baixar Excel">
                        <DocumentArrowDownIcon className="w-4 h-4"/>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handlePrint(); }} className="p-2 rounded-full text-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="Imprimir">
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

                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 bg-slate-100/50 dark:bg-slate-900/50 flex justify-between items-center">
                        <div className="flex-1">
                            {isUnidentifiedIncome && processedResults.length > 0 && (
                                <button 
                                    onClick={handleBulkIdentify}
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 active:scale-95 transition-all"
                                >
                                    <CheckBadgeIcon className="w-3.5 h-3.5" />
                                    <span>Identificar {processedResults.length} {searchQuery ? 'filtrados' : 'pendentes'} como...</span>
                                </button>
                            )}
                        </div>
                        
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

                    {processedResults.length > 0 ? (
                        <EditableReportTable
                            data={processedResults}
                            onRowChange={(updatedRow) => updateReportData(updatedRow, reportType)}
                            reportType={reportType}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                        />
                    ) : (
                        <div className="py-12 text-center bg-slate-50/30 dark:bg-slate-900/10">
                            <SearchIcon className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                            <p className="text-slate-400 text-xs font-medium">Nenhum resultado para "{searchQuery}" neste grupo.</p>
                            <button onClick={() => setSearchQuery('')} className="mt-2 text-brand-blue text-[10px] font-bold uppercase tracking-widest hover:underline">Limpar busca</button>
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
        openRecompareModal,
        churches
    } = useContext(AppContext);
    
    const { t } = useTranslation();
    const { setActiveView } = useUI();

    const [activeTab, setActiveTab] = useState<'income' | 'expenses'>('income');

    // Separate groups for safer rendering
    const unidentifiedIncome = useMemo(() => {
        if (!reportPreviewData?.income['unidentified']) return null;
        return {
            id: 'unidentified',
            results: reportPreviewData.income['unidentified']
        };
    }, [reportPreviewData]);

    const churchIncomeGroups = useMemo(() => {
        if (!reportPreviewData) return [];
        return Object.keys(reportPreviewData.income)
            .filter(id => id !== 'unidentified')
            .sort((a, b) => {
                const churchA = churches.find(c => c.id === a)?.name || '';
                const churchB = churches.find(c => c.id === b)?.name || '';
                return churchA.localeCompare(churchB);
            })
            .map(id => ({
                id,
                results: reportPreviewData.income[id]
            }));
    }, [reportPreviewData, churches]);

    const expenseGroups = reportPreviewData ? Object.keys(reportPreviewData.expenses) : [];
    const hasIncome = (unidentifiedIncome?.results?.length ?? 0) > 0 || churchIncomeGroups.length > 0;
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

    // Auto-switch tabs if data only exists in one type
    React.useEffect(() => {
        if (!reportPreviewData) return;
        // Logic simplified: only switch if CURRENT view is empty but other has data
        if (activeTab === 'income' && !hasIncome && hasExpenses) setActiveTab('expenses');
        if (activeTab === 'expenses' && !hasExpenses && hasIncome) setActiveTab('income');
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

    if (!reportPreviewData) {
        return <SavedReportsView />;
    }

    return (
        <div className="flex flex-col h-full animate-fade-in gap-4 pb-2">
            <div className="flex-shrink-0 bg-slate-50 dark:bg-[#0B1120] p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-500">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('reports.title')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 max-w-xl font-medium">{t('reports.subtitle')}</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                        <button 
                            onClick={() => setActiveView('savedReports')}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-brand-blue dark:hover:text-blue-400 hover:border-brand-blue/30 shadow-sm"
                        >
                            <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                            <span>{t('nav.savedReports')}</span>
                        </button>

                        <button 
                            onClick={openRecompareModal}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 shadow-sm"
                        >
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                            <span>Refazer</span>
                        </button>

                        <button 
                            onClick={openSearchFilters}
                            className="relative flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-brand-blue dark:hover:text-blue-400 hover:border-brand-blue/30 shadow-sm"
                        >
                            <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
                            <span>{t('search.filters')}</span>
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm border-2 border-white dark:border-slate-800">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>

                        <button 
                            onClick={discardCurrentReport}
                            className="px-4 py-2 text-[10px] font-bold text-slate-500 hover:text-red-500 bg-transparent rounded-full transition-all uppercase tracking-wide border border-transparent hover:border-red-100"
                        >
                            {t('common.close')}
                        </button>
                        <button 
                            onClick={handleSaveGlobalReport}
                            className="flex items-center gap-2 px-6 py-2.5 text-white bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] rounded-full shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-widest text-[10px] font-black"
                        >
                            <FloppyDiskIcon className="w-3.5 h-3.5" />
                            <span>{t('reports.saveReport')}</span>
                        </button>
                    </div>
                </div>

                {(hasIncome && hasExpenses) && (
                    <div className="mt-6 flex bg-slate-100 dark:bg-slate-900 p-1 rounded-full border border-slate-200 dark:border-slate-800 shadow-inner w-fit">
                        <button
                            onClick={() => setActiveTab('income')}
                            className={`flex items-center gap-1.5 px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'income' ? 'bg-white text-emerald-600 dark:bg-slate-800 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                            <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                            <span>{t('upload.income')}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('expenses')}
                            className={`flex items-center gap-1.5 px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'expenses' ? 'bg-white text-rose-600 dark:bg-slate-800 dark:text-rose-400 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                            <UploadIcon className="w-3.5 h-3.5" />
                            <span>{t('upload.expenses')}</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4 pb-10">
                {activeTab === 'income' && (
                    <>
                        {/* Always show unidentified group if it exists */}
                        {unidentifiedIncome && (
                            <ReportGroup 
                                key="unidentified"
                                churchId="unidentified"
                                results={unidentifiedIncome.results}
                                reportType="income"
                            />
                        )}
                        
                        {/* Show church groups */}
                        {churchIncomeGroups.map(group => (
                            <ReportGroup 
                                key={group.id} 
                                churchId={group.id} 
                                results={group.results} 
                                reportType="income" 
                            />
                        ))}
                    </>
                )}

                {activeTab === 'expenses' && expenseGroups.length > 0 && (
                    expenseGroups.map(groupId => (
                        <ReportGroup key={groupId} churchId={groupId} results={(reportPreviewData?.expenses[groupId]) || []} reportType="expenses" />
                    ))
                )}
                
                {((activeTab === 'income' && !hasIncome) || (activeTab === 'expenses' && !hasExpenses)) && (
                    <div className="text-center py-20 bg-white/50 dark:bg-slate-800/30 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center">
                        <SearchIcon className="w-10 h-10 text-slate-300 mb-3" />
                        <p className="text-slate-500 font-bold text-sm">Nenhum resultado encontrado.</p>
                        <p className="text-slate-400 text-[10px] uppercase font-bold mt-1 tracking-widest">Tente remover alguns filtros</p>
                    </div>
                )}
            </div>
        </div>
    );
};
