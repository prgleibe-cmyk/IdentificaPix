
import React, { useContext, useMemo, useState, memo, useEffect, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { EditableReportTable } from '../components/reports/EditableReportTable';
import { SavedReportsView } from './SavedReportsView';
import { EmptyState } from '../components/EmptyState';
import { usePersistentState } from '../hooks/usePersistentState';
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
    ChevronLeftIcon, 
    FloppyDiskIcon, 
    ChartBarIcon, 
    UploadIcon, 
    ArrowLeftOnRectangleIcon, 
    AdjustmentsHorizontalIcon, 
    BuildingOfficeIcon, 
    ExclamationTriangleIcon, 
    ArrowPathIcon, 
    CheckBadgeIcon, 
    BanknotesIcon
} from '../components/Icons';
import { formatCurrency, formatDate } from '../utils/formatters';
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

const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((o, key) => (o && o[key] != null ? o[key] : null), obj);
};

// Componente Compacto de Métricas (Design Clean) - Versão Protegida
const CompactMetricsBar: React.FC<{ metrics: any, language: Language, isExpense: boolean }> = ({ metrics, language, isExpense }) => {
    // PROTEÇÃO CONTRA ERRO: Verifica se metrics e metrics.total existem antes de renderizar
    if (isExpense || !metrics || !metrics.total) return null;

    return (
        <div className="flex items-center gap-2 text-[9px] font-medium text-slate-600 dark:text-slate-300 overflow-x-auto custom-scrollbar pb-0.5">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                <span className="font-bold text-slate-700 dark:text-slate-200">Total:</span>
                <span className="text-slate-600 dark:text-slate-400">{metrics.total.quantity}</span>
                <span className="text-slate-300 dark:text-slate-600 mx-0.5">|</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(metrics.total.value, language)}</span>
            </div>
            
            {metrics.auto && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 whitespace-nowrap">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span className="text-emerald-700 dark:text-emerald-400">Auto: {metrics.auto.quantity}</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-500">({metrics.auto.percentage.toFixed(0)}%)</span>
                </div>
            )}

            {metrics.manual && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 whitespace-nowrap">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <span className="text-blue-700 dark:text-blue-400">Manual: {metrics.manual.quantity}</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-500">({metrics.manual.percentage.toFixed(0)}%)</span>
                </div>
            )}

            {metrics.pending && metrics.pending.quantity > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 whitespace-nowrap">
                    <ExclamationTriangleIcon className="w-3 h-3 text-amber-500" />
                    <span className="text-amber-700 dark:text-amber-400 font-bold">Pend: {metrics.pending.quantity}</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-500">({formatCurrency(metrics.pending.value, language)})</span>
                </div>
            )}
        </div>
    );
};

const ReportGroup: React.FC<{
    churchId: string;
    results: MatchResult[];
    reportType: 'income' | 'expenses';
    defaultOpen?: boolean;
}> = ({ churchId, results, reportType, defaultOpen = false }) => {
    const {
        churches,
        updateReportData,
        openDeleteConfirmation,
        searchFilters,
        openBulkManualIdentify,
        loadingAiId,
        openManualIdentify
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'transaction.date', direction: 'desc' });
    
    const isCollapsed = false;
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
                if (sortConfig.key === 'hasSuggestion') {
                    const valA = a.suggestion ? 1 : 0;
                    const valB = b.suggestion ? 1 : 0;
                    return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
                }

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
    
    const summaryMetrics = useMemo(() => {
        if (reportType === 'expenses') return null;
        
        const identifiedRows = processedResults.filter(r => r.status === 'IDENTIFICADO');
        const autoConfirmed = identifiedRows.filter(r => r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod);
        const manualConfirmed = identifiedRows.filter(r => r.matchMethod === 'MANUAL' || r.matchMethod === 'AI');
        const bankPendingRows = processedResults.filter(r => r.status === 'NÃO IDENTIFICADO');
        const listPendingRows = processedResults.filter(r => r.status === 'PENDENTE');
        const totalCount = processedResults.length;
        
        const getRowValue = (r: MatchResult) => {
            if (!r) return 0;
            if (r.transaction && Math.abs(r.transaction.amount) > 0) return r.transaction.amount;
            return r.contributorAmount || 0;
        };

        const valAuto = autoConfirmed.reduce((sum, r) => sum + getRowValue(r), 0);
        const valManual = manualConfirmed.reduce((sum, r) => sum + getRowValue(r), 0);
        const valBankPending = bankPendingRows.reduce((sum, r) => sum + (r.transaction?.amount || 0), 0);
        const valListPending = listPendingRows.reduce((sum, r) => sum + (r.contributorAmount || 0), 0);
        const totalPendingValue = valBankPending + valListPending;
        const totalValue = valAuto + valManual + totalPendingValue;
        const totalPendingCount = bankPendingRows.length + listPendingRows.length;

        return {
            auto: { quantity: autoConfirmed.length, value: valAuto, percentage: totalCount > 0 ? (autoConfirmed.length / totalCount) * 100 : 0 },
            manual: { quantity: manualConfirmed.length, value: valManual, percentage: totalCount > 0 ? (manualConfirmed.length / totalCount) * 100 : 0 },
            pending: { quantity: totalPendingCount, value: totalPendingValue, percentage: totalCount > 0 ? (totalPendingCount / totalCount) * 100 : 0 },
            total: { quantity: totalCount, value: totalValue, percentage: 100 }
        };
    }, [processedResults, reportType]);
    
    const simpleTotalValue = summaryMetrics ? summaryMetrics.total.value : processedResults.reduce((sum, r) => {
         if (reportType === 'income') {
             return sum + (Math.abs(r.transaction?.amount || 0) > 0 ? (r.transaction?.amount || 0) : (r.contributorAmount || 0));
         }
         return sum + (r.transaction?.amount || 0);
    }, 0);

    const getGroupName = (id: string): string => {
        if (id === 'unidentified') return t('reports.unidentifiedGroupTitle');
        if (id === 'all_expenses_group') return t('reports.expenseReportTitle');
        return churches.find(c => c.id === id)?.name || t('reports.unknownChurch');
    };

    const groupName = getGroupName(churchId);

    const handleBulkIdentify = () => {
        const transactions = processedResults.filter(r => r.status !== 'PENDENTE').map(r => r.transaction);
        openBulkManualIdentify(transactions);
    };

    const handleDownload = (format: 'xlsx') => {
        const wb = XLSX.utils.book_new();
        const wsData: any[][] = [
            [groupName],
            [`Gerado em: ${new Date().toLocaleString(language)}`],
            [`Registros: ${processedResults.length}`],
            [''],
            ['Data', reportType === 'income' ? 'Nome / Contribuinte' : 'Descrição', 'Tipo', 'Valor']
        ];

        processedResults.forEach(r => {
            const isPendingList = r.status === 'PENDENTE';
            const amount = isPendingList ? 0 : (reportType === 'income' ? (r.contributorAmount ?? r.transaction.amount) : r.transaction.amount);
            const mainName = reportType === 'income' ? (r.contributor?.cleanedName || r.contributor?.name || '---') : (r.transaction.cleanedDescription || r.transaction.description);
            const type = r.contributor?.contributionType || r.contributionType || r.transaction.contributionType || '---';

            wsData.push([formatDate(r.transaction.date), isPendingList ? `${mainName} (Não Localizado)` : mainName, type, amount]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws, "Relatório");
        XLSX.writeFile(wb, `${groupName.replace(/[^a-z0-9]/gi, '_')}_${reportType}.xlsx`);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const currentChurch = churches.find(c => c.id === churchId);
        const logoHtml = currentChurch?.logoUrl
            ? `<img src="${currentChurch.logoUrl}" style="max-height: 60px; max-width: 100px; object-fit: contain; margin-right: 15px;" />`
            : '';

        const tableRows = processedResults.map(r => {
            const isPendingList = r.status === 'PENDENTE';
            const amount = isPendingList ? 0 : (reportType === 'income' ? (r.contributorAmount ?? r.transaction.amount) : r.transaction.amount);
            const mainName = reportType === 'income' ? (r.contributor?.cleanedName || r.contributor?.name || '---') : (r.transaction.cleanedDescription || r.transaction.description);
            const type = r.contributor?.contributionType || r.contributionType || r.transaction.contributionType || '---';
            const formattedAmount = isPendingList ? `<span style="text-decoration: line-through; color: #94a3b8;">${formatCurrency(0, language)}</span>` : formatCurrency(amount, language);

            return `<tr><td style="font-family: monospace;">${formatDate(r.transaction.date)}</td><td>${mainName} ${isPendingList ? '<span style="font-size: 9px; color: red; font-style: italic;">(Não Localizado)</span>' : ''}</td><td>${type}</td><td style="text-align:right; font-family: monospace; font-weight: bold;">${formattedAmount}</td></tr>`;
        }).join('');

        let summaryHtml = '';
        if (summaryMetrics) {
            summaryHtml = `<div class="stats-grid"><div class="stat-box" style="border-color: #e2e8f0;"><div class="stat-title" style="color: #64748b;">Total</div><div class="stat-value" style="color: #0f172a;">${summaryMetrics.total.quantity}</div><div class="stat-amount" style="color: #334155;">${formatCurrency(summaryMetrics.total.value, language)}</div></div><div class="stat-box" style="border-color: #bbf7d0; background-color: #f0fdf4;"><div class="stat-title" style="color: #15803d;">Automático</div><div class="stat-value" style="color: #14532d;">${summaryMetrics.auto.quantity}</div><div class="stat-amount" style="color: #166534;">${formatCurrency(summaryMetrics.auto.value, language)}</div></div><div class="stat-box" style="border-color: #bfdbfe; background-color: #eff6ff;"><div class="stat-title" style="color: #1d4ed8;">Manual</div><div class="stat-value" style="color: #1e3a8a;">${summaryMetrics.manual.quantity}</div><div class="stat-amount" style="color: #1e40af;">${formatCurrency(summaryMetrics.manual.value, language)}</div></div><div class="stat-box" style="border-color: #fde68a; background-color: #fffbeb;"><div class="stat-title" style="color: #b45309;">Pendente</div><div class="stat-value" style="color: #78350f;">${summaryMetrics.pending.quantity}</div><div class="stat-amount" style="color: #92400e;">${formatCurrency(summaryMetrics.pending.value, language)}</div></div></div>`;
        } else {
            summaryHtml = `<div class="summary"><div class="summary-item"><span class="label">Total de Registros</span><span class="value">${processedResults.length}</span></div><div class="summary-item"><span class="label">Valor Total Acumulado</span><span class="value">${formatCurrency(simpleTotalValue, language)}</span></div></div>`;
        }

        printWindow.document.write(`<html><head><title>${groupName}</title><style>body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; } .header { border-bottom: 3px solid #0052cc; padding-bottom: 15px; margin-bottom: 30px; display: flex; align-items: center; justify-content: space-between; } .header-left { display: flex; align-items: center; } .header h1 { margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; } .header .meta { text-align: right; font-size: 10px; color: #64748b; font-weight: 600; } table { width: 100%; border-collapse: collapse; margin-top: 10px; } th { background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px 10px; text-align: left; font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1px; } td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; } .summary { margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 12px; display: flex; gap: 40px; } .summary-item { display: flex; flex-direction: column; } .summary-item .label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px; } .summary-item .value { font-size: 16px; font-weight: 800; color: #0f172a; } .stats-grid { display: flex; gap: 15px; margin-bottom: 20px; margin-top: 20px; } .stat-box { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; } .stat-title { font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; } .stat-value { font-size: 18px; font-weight: 800; line-height: 1; margin-bottom: 4px; } .stat-amount { font-size: 11px; font-weight: 600; font-family: monospace; } @media print { body { padding: 0; } @page { margin: 1.5cm; } }</style></head><body><div class="header"><div class="header-left">${logoHtml}<div><h1>${groupName}</h1><div style="font-size: 12px; font-weight: 600; color: #0052cc; margin-top: 4px;">Relatório de Conciliação Bancária</div></div></div><div class="meta">Gerado em: ${new Date().toLocaleString(language)}<br>Registros: ${processedResults.length}</div></div>${summaryHtml}<table><thead><tr><th style="width: 15%;">Data</th><th style="width: 45%;">${reportType === 'income' ? 'Nome / Contribuinte' : 'Descrição'}</th><th style="width: 20%;">Tipo</th><th style="text-align:right; width: 20%;">Valor</th></tr></thead><tbody>${tableRows}</tbody></table><div style="margin-top: 80px; display: flex; justify-content: space-around;"><div style="text-align: center;"><div style="width: 200px; border-top: 1px solid #000; margin-bottom: 8px;"></div><div style="font-size: 10px; font-weight: 700; text-transform: uppercase;">Tesouraria</div></div><div style="text-align: center;"><div style="width: 200px; border-top: 1px solid #000; margin-bottom: 8px;"></div><div style="font-size: 10px; font-weight: 700; text-transform: uppercase;">Responsável</div></div></div><script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };</script></body></html>`);
        printWindow.document.close();
    };

    const handleCustomEdit = useCallback((row: MatchResult) => {
        openManualIdentify(row.transaction.id);
    }, [openManualIdentify]);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-200 dark:border-slate-700" data-group-id={churchId}>
            {/* Header Clean - Integrado ao Card e Ultra Compacto - GRADIENTE APLICADO AQUI */}
            <div className="flex-shrink-0 px-3 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 bg-gradient-to-b from-slate-100 to-white dark:from-slate-900 dark:to-slate-800 z-10 rounded-t-2xl">
                
                {/* Lado Esquerdo: Identificação em Massa e Métricas */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-brand-blue"></div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide truncate max-w-[200px]">
                            {groupName}
                        </span>
                    </div>

                    {isUnidentifiedIncome && processedResults.length > 0 && (
                        <button onClick={handleBulkIdentify} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue hover:bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-sm hover:-translate-y-0.5 transition-all whitespace-nowrap">
                            <CheckBadgeIcon className="w-3.5 h-3.5" />
                            <span>Resolver ({processedResults.filter(r => r.status !== 'PENDENTE').length})</span>
                        </button>
                    )}
                    
                    {/* Proteção na renderização da barra de métricas */}
                    {summaryMetrics && summaryMetrics.total && <CompactMetricsBar metrics={summaryMetrics} language={language} isExpense={reportType === 'expenses'} />}
                </div>

                {/* Lado Direito: Busca e Ações - Visual Clean */}
                <div className="flex items-center gap-2">
                    <div className="relative w-32 md:w-48 transition-all">
                        <SearchIcon className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text" 
                            className="block w-full pl-8 pr-6 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-medium text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-400 shadow-sm" 
                            placeholder={t('common.search')} 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                        />
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><XMarkIcon className="h-3 w-3" /></button>}
                    </div>

                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 hidden md:block"></div>

                    <div className="flex gap-1">
                        <button onClick={() => handleDownload('xlsx')} className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 transition-colors shadow-sm" title="Baixar Excel">
                            <DocumentArrowDownIcon className="w-3.5 h-3.5"/>
                        </button>
                        <button onClick={handlePrint} className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 transition-colors shadow-sm" title="Imprimir">
                            <PrinterIcon className="w-3.5 h-3.5"/>
                        </button>
                        <button onClick={() => openDeleteConfirmation({ type: 'report-group', id: churchId, name: `relatório de ${groupName}`, meta: { reportType }})} className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 text-rose-500 transition-colors shadow-sm" title="Excluir Grupo">
                            <TrashIcon className="w-3.5 h-3.5"/>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabela (Ocupa o resto do espaço) */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-800 rounded-b-2xl">
                {processedResults.length > 0 ? (
                    <EditableReportTable 
                        data={processedResults} 
                        onRowChange={(updatedRow) => updateReportData(updatedRow, reportType)} 
                        reportType={reportType} 
                        sortConfig={sortConfig} 
                        onSort={handleSort}
                        loadingAiId={loadingAiId} 
                        onEdit={churchId === 'unidentified' ? handleCustomEdit : undefined}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/20 dark:bg-slate-900/10">
                        <SearchIcon className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-xs font-medium">Nenhum resultado encontrado.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export const ReportsView: React.FC = () => {
    const { 
        reportPreviewData, 
        churches, 
        activeReportId, 
        matchResults, 
        openSaveReportModal,
        saveCurrentReportChanges
    } = useContext(AppContext);
    
    const { t } = useTranslation();
    
    const [activeTab, setActiveTab] = useState<'churches' | 'unidentified' | 'expenses'>('churches');
    const [selectedChurchId, setSelectedChurchId] = useState<string>('');
    const [draggedId, setDraggedId] = useState<string | null>(null);

    // Derived Data
    const churchGroups = useMemo(() => {
        if (!reportPreviewData?.income) return [];
        return Object.entries(reportPreviewData.income)
            .filter(([id]) => id !== 'unidentified')
            .sort((a, b) => {
                const nameA = churches.find(c => c.id === a[0])?.name || '';
                const nameB = churches.find(c => c.id === b[0])?.name || '';
                return nameA.localeCompare(nameB);
            });
    }, [reportPreviewData, churches]);

    const unidentifiedData = useMemo(() => {
        return reportPreviewData?.income?.['unidentified'] || [];
    }, [reportPreviewData]);

    const expenseGroups = useMemo(() => {
        return Object.entries(reportPreviewData?.expenses || {});
    }, [reportPreviewData]);

    // Counts
    const churchCount = churchGroups.length;
    const unidentifiedCount = unidentifiedData.length;
    const expensesCount = expenseGroups.reduce((acc, [, items]) => acc + items.length, 0);

    // Initial Selection
    useEffect(() => {
        if (activeTab === 'churches' && churchGroups.length > 0) {
            if (!selectedChurchId || !churchGroups.some(([id]) => id === selectedChurchId)) {
                setSelectedChurchId(churchGroups[0][0]);
            }
        }
    }, [activeTab, churchGroups, selectedChurchId]);

    const handleSaveReport = () => {
        const allResults = [
            ...Object.values(reportPreviewData?.income || {}).flat(),
            ...Object.values(reportPreviewData?.expenses || {}).flat()
        ];
        
        openSaveReportModal({
            type: 'global',
            results: allResults as MatchResult[],
            groupName: 'Relatório Geral'
        });
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        setDraggedId(null);
    };

    // UNIFIED BUTTON COMPONENT - NEON VARIANT
    const UnifiedButton = ({ 
        onClick, 
        icon: Icon, 
        label, 
        count,
        isActive,
        isLast,
        variant = 'default'
    }: { 
        onClick: () => void, 
        icon: any, 
        label: string, 
        count?: number,
        isActive?: boolean,
        isLast?: boolean,
        variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning'
    }) => {
        // MAPA DE CORES: Garante visibilidade permanente
        const colorMap = {
            default: { 
                base: 'text-slate-300 hover:text-white', 
                active: 'text-white' 
            },
            primary: { 
                base: 'text-blue-400 hover:text-blue-300', 
                active: 'text-blue-300 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' 
            },
            success: { 
                base: 'text-emerald-400 hover:text-emerald-300', 
                active: 'text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' 
            },
            danger: { 
                base: 'text-rose-400 hover:text-rose-300', 
                active: 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]' 
            },
            warning: { 
                base: 'text-amber-400 hover:text-amber-300', 
                active: 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' 
            },
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
                    {count !== undefined && count > 0 && (
                        <span className={`
                            ml-1 px-1.5 py-0.5 rounded-full text-[9px] leading-none transition-colors
                            ${isActive 
                                ? 'bg-white/20 text-white' 
                                : 'bg-slate-800 text-slate-500 group-hover:text-slate-300'
                            }
                        `}>
                            {count}
                        </span>
                    )}
                </button>
                {!isLast && <div className="w-px h-3 bg-white/10 self-center"></div>}
            </>
        );
    };

    if (!reportPreviewData) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState 
                    icon={<ChartBarIcon className="w-12 h-12 text-brand-blue dark:text-blue-400" />} 
                    title={t('empty.reports.title')} 
                    message={t('empty.reports.message')} 
                    action={{ text: t('empty.dashboard.action'), onClick: () => {} }} 
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in gap-2 pb-1">
            
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 mt-1 bg-transparent min-h-[40px] relative">
                
                {/* Title */}
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none whitespace-nowrap hidden md:block">{t('reports.title')}</h2>
                
                {/* CENTER GROUP: Navigation Views (Dark/Slate Gradient) */}
                <div className="md:absolute md:left-1/2 md:-translate-x-1/2 flex items-center h-9 bg-gradient-to-r from-[#0F172A] to-[#334155] rounded-full shadow-lg border border-white/10 overflow-hidden overflow-x-auto custom-scrollbar p-0.5 w-full md:w-auto justify-center">
                    <UnifiedButton 
                        label="Igrejas" 
                        icon={BuildingOfficeIcon} 
                        count={churchCount} 
                        isActive={activeTab === 'churches'}
                        onClick={() => setActiveTab('churches')}
                        variant="primary"
                    />
                    <UnifiedButton 
                        label="Pendentes" 
                        icon={ExclamationTriangleIcon} 
                        count={unidentifiedCount} 
                        isActive={activeTab === 'unidentified'}
                        onClick={() => setActiveTab('unidentified')}
                        variant="warning"
                    />
                    <UnifiedButton 
                        label="Saídas" 
                        icon={BanknotesIcon} 
                        count={expensesCount} 
                        isActive={activeTab === 'expenses'}
                        onClick={() => setActiveTab('expenses')}
                        variant="danger"
                        isLast={true}
                    />
                </div>

                {/* RIGHT GROUP: Actions (Green/Emerald Gradient) */}
                <div className="flex items-center h-9 bg-gradient-to-r from-[#064E3B] to-[#10B981] rounded-full shadow-lg border border-emerald-500/30 overflow-hidden overflow-x-auto custom-scrollbar p-0.5 w-full md:w-auto ml-auto">
                    {activeReportId && (
                        <UnifiedButton 
                            label="Salvar Alt." 
                            icon={FloppyDiskIcon} 
                            isActive={true} 
                            onClick={saveCurrentReportChanges}
                            variant="default"
                        />
                    )}
                    
                    <UnifiedButton 
                        label={t('reports.saveReport')} 
                        icon={DocumentDuplicateIcon} 
                        isLast={true}
                        onClick={handleSaveReport}
                        variant="default"
                    />
                </div>
            </div>

            {activeTab === 'churches' && churchGroups.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 custom-scrollbar min-h-[28px] px-1">
                    {churchGroups.map(([churchId, results]) => {
                        const resultsArray = results as MatchResult[];
                        const isActive = selectedChurchId === churchId;
                        const churchName = resultsArray[0]?.church?.name || t('reports.unknownChurch');
                        const isDraggingSelf = draggedId === churchId;
                        
                        return (
                            <button
                                key={churchId}
                                onClick={() => setSelectedChurchId(churchId)}
                                draggable="true"
                                onDragStart={(e) => handleDragStart(e, churchId)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, churchId)}
                                className={`
                                    flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all text-[9px] font-bold uppercase cursor-move shadow-sm
                                    active:cursor-grabbing hover:scale-105 whitespace-nowrap
                                    ${isActive 
                                        ? 'bg-white text-brand-blue border-brand-blue ring-1 ring-brand-blue/20 z-10' 
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }
                                    dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300
                                    ${isDraggingSelf ? 'opacity-50 scale-95 border-dashed border-slate-400' : ''}
                                `}
                                title="Arraste para reordenar"
                            >
                                <span className="truncate max-w-[120px]">{churchName}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[8px] leading-none ${isActive ? 'bg-blue-50 text-brand-blue' : 'bg-slate-100 text-slate-500'}`}>
                                    {resultsArray.length}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-1 pb-1">
                {activeTab === 'churches' && (
                    <div className="flex-1 min-h-0 flex flex-col animate-fade-in">
                        {churchGroups.length > 0 ? (
                            churchGroups
                                .filter(([id]) => id === selectedChurchId)
                                .map(([churchId, results]) => (
                                    <ReportGroup key={churchId} churchId={churchId} results={results as MatchResult[]} reportType="income" defaultOpen={true} />
                                ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white/50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                <BuildingOfficeIcon className="w-10 h-10 mb-2 opacity-20" />
                                <p className="text-xs font-medium">Nenhum relatório disponível.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'unidentified' && (
                    <div className="flex-1 min-h-0 flex flex-col animate-fade-in">
                        {unidentifiedData.length > 0 ? (
                            <ReportGroup churchId="unidentified" results={unidentifiedData} reportType="income" defaultOpen={true} />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-emerald-500 bg-white/50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-emerald-100 dark:border-emerald-800/30 h-full">
                                <CheckBadgeIcon className="w-10 h-10 mb-2 opacity-50" />
                                <p className="text-xs font-bold">Tudo certo!</p>
                                <p className="text-[10px] opacity-70">Não há itens pendentes.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'expenses' && (
                    <div className="flex-1 min-h-0 flex flex-col animate-fade-in">
                        {expenseGroups.length > 0 ? (
                            expenseGroups.map(([groupId, results]) => (
                                <ReportGroup key={groupId} churchId={groupId} results={results as MatchResult[]} reportType="expenses" defaultOpen={true} />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white/50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 h-full">
                                <BanknotesIcon className="w-10 h-10 mb-2 opacity-20" />
                                <p className="text-xs font-medium">Nenhum relatório de saídas.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
