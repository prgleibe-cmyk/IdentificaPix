import React, { useContext, useMemo, useState, memo, useEffect } from 'react';
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

// Componente Compacto de Métricas (Design High Contrast)
const CompactMetricsBar: React.FC<{ metrics: any, language: Language, isExpense: boolean }> = ({ metrics, language, isExpense }) => {
    if (isExpense) return null;

    return (
        <div className="flex items-center gap-2 text-[10px] font-medium text-slate-600 dark:text-slate-300 overflow-x-auto custom-scrollbar pb-1">
            {/* Total Geral - White Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white dark:bg-slate-800 border border-blue-200 dark:border-slate-600 whitespace-nowrap shadow-sm">
                <span className="font-bold text-slate-700 dark:text-slate-200">Total:</span>
                <span className="text-slate-600 dark:text-slate-400">{metrics.total.quantity}</span>
                <span className="text-slate-300 dark:text-slate-600 mx-0.5">|</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(metrics.total.value, language)}</span>
            </div>
            
            {/* Auto (Verde) - White Pill with Green Accent */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800 whitespace-nowrap shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-emerald-700 dark:text-emerald-400">Auto: {metrics.auto.quantity}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-500">({metrics.auto.percentage.toFixed(0)}%)</span>
            </div>

            {/* Manual (Azul) - White Pill with Blue Accent */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800 whitespace-nowrap shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <span className="text-blue-700 dark:text-blue-400">Manual: {metrics.manual.quantity}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-500">({metrics.manual.percentage.toFixed(0)}%)</span>
            </div>

            {/* Pendente (Amarelo) - White Pill with Amber Accent */}
            {metrics.pending.quantity > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800 whitespace-nowrap shadow-sm">
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
        openBulkManualIdentify
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'transaction.date', direction: 'desc' });
    
    // Always open in this new layout
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
            if (Math.abs(r.transaction.amount) > 0) return r.transaction.amount;
            return r.contributorAmount || 0;
        };

        const valAuto = autoConfirmed.reduce((sum, r) => sum + getRowValue(r), 0);
        const valManual = manualConfirmed.reduce((sum, r) => sum + getRowValue(r), 0);
        const valBankPending = bankPendingRows.reduce((sum, r) => sum + r.transaction.amount, 0);
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
             return sum + (Math.abs(r.transaction.amount) > 0 ? r.transaction.amount : (r.contributorAmount || 0));
         }
         return sum + r.transaction.amount;
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

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700" data-group-id={churchId}>
            {/* Header - Alterado para Azul Médio (Blue-100/Blue-200) para contraste */}
            <div className="flex-shrink-0 px-4 py-2 border-b border-blue-200 dark:border-slate-700 flex items-center justify-between gap-4 bg-[#DBEAFE]/80 dark:bg-slate-900 z-10 backdrop-blur-sm">
                {/* Lado Esquerdo: Identificação em Massa e Métricas */}
                <div className="flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
                    {isUnidentifiedIncome && processedResults.length > 0 && (
                        <button onClick={handleBulkIdentify} className="flex items-center gap-1.5 px-3 py-1 bg-brand-blue hover:bg-blue-600 text-white rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm hover:-translate-y-0.5 transition-all whitespace-nowrap">
                            <CheckBadgeIcon className="w-3.5 h-3.5" />
                            <span>Resolver ({processedResults.filter(r => r.status !== 'PENDENTE').length})</span>
                        </button>
                    )}
                    
                    {summaryMetrics && <CompactMetricsBar metrics={summaryMetrics} language={language} isExpense={reportType === 'expenses'} />}
                </div>

                {/* Lado Direito: Busca e Ações - Visual Clean */}
                <div className="flex items-center gap-2">
                    <div className="relative w-48 transition-all focus-within:w-64">
                        <SearchIcon className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text" 
                            className="block w-full pl-9 pr-7 py-1 bg-white dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-full text-[11px] font-medium text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-400 shadow-sm" 
                            placeholder={t('common.search')} 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                        />
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><XMarkIcon className="h-3 w-3" /></button>}
                    </div>

                    <div className="h-4 w-px bg-blue-300 dark:bg-slate-700 mx-1"></div>

                    <button onClick={handleDownload} className="p-1.5 rounded-lg bg-white/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 dark:text-emerald-400 transition-colors shadow-sm" title="Baixar Excel">
                        <DocumentArrowDownIcon className="w-4 h-4"/>
                    </button>
                    <button onClick={handlePrint} className="p-1.5 rounded-lg bg-white/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:text-blue-400 transition-colors shadow-sm" title="Imprimir">
                        <PrinterIcon className="w-4 h-4"/>
                    </button>
                    <button onClick={() => openDeleteConfirmation({ type: 'report-group', id: churchId, name: `relatório de ${groupName}`, meta: { reportType }})} className="p-1.5 rounded-lg bg-white/50 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 dark:text-rose-400 transition-colors shadow-sm" title="Excluir Grupo">
                        <TrashIcon className="w-4 h-4"/>
                    </button>
                </div>
            </div>

            {/* Tabela (Ocupa o resto do espaço) */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {processedResults.length > 0 ? (
                    <EditableReportTable data={processedResults} onRowChange={(updatedRow) => updateReportData(updatedRow, reportType)} reportType={reportType} sortConfig={sortConfig} onSort={handleSort} />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/20 dark:bg-slate-900/10">
                        <SearchIcon className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-xs font-medium">Nenhum resultado encontrado.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export const ReportsView: React.FC = () => {
    const { reportPreviewData, openSaveReportModal, matchResults } = useContext(AppContext);
    const { t, language } = useTranslation();
    const { setActiveView } = useUI();
    const [activeTab, setActiveTab] = useState<'churches' | 'unidentified' | 'expenses'>('churches');
    const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
    
    // DRAG AND DROP STATE
    const [churchOrder, setChurchOrder] = usePersistentState<string[]>('report-tab-order', []);
    const [draggedId, setDraggedId] = useState<string | null>(null);

    if (!reportPreviewData) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState icon={<ChartBarIcon className="w-12 h-12 text-brand-blue dark:text-blue-400" />} title={t('empty.reports.title')} message={t('empty.reports.message')} action={{ text: t('empty.dashboard.action'), onClick: () => setActiveView('upload') }} />
            </div>
        );
    }

    const { income, expenses } = reportPreviewData;
    
    const unidentifiedData = (income['unidentified'] || []) as MatchResult[];
    
    // Sorted Church Groups with Drag & Drop Logic
    const churchGroups = useMemo(() => {
        let groups = Object.entries(income).filter(([key]) => key !== 'unidentified');

        // 1. Default Sort (Alphabetical)
        groups.sort((a, b) => {
            const nameA = (a[1] as MatchResult[])?.[0]?.church?.name || '';
            const nameB = (b[1] as MatchResult[])?.[0]?.church?.name || '';
            return nameA.localeCompare(nameB);
        });

        // 2. Custom Sort Override based on persisted order
        if (churchOrder.length > 0) {
            groups.sort((a, b) => {
                const indexA = churchOrder.indexOf(a[0]);
                const indexB = churchOrder.indexOf(b[0]);

                if (indexA !== -1 && indexB !== -1) return indexA - indexB; // Both in list, preserve order
                if (indexA !== -1) return -1; // A in list, B not -> A first
                if (indexB !== -1) return 1;  // B in list, A not -> B first
                return 0; // Neither in list -> alphabetical wins
            });
        }
        return groups;
    }, [income, churchOrder]);
    
    const expenseGroups = Object.entries(expenses) as [string, MatchResult[]][];

    // Metrics
    const churchCount = churchGroups.length;
    const unidentifiedCount = unidentifiedData.length;
    const expensesCount = expenseGroups.reduce((acc, curr) => acc + curr[1].length, 0);

    // Initial load logic: Select the first church if available
    useEffect(() => {
        if (activeTab === 'churches' && !selectedChurchId && churchGroups.length > 0) {
            setSelectedChurchId(churchGroups[0][0]);
        }
    }, [activeTab, churchGroups, selectedChurchId]);

    const handleSaveReport = () => {
        openSaveReportModal({
            type: 'global',
            groupName: 'Relatório Geral',
            results: matchResults
        });
    };

    // --- Drag & Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
        // Optional: Custom Drag Image could be set here
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('text/plain');
        if (!sourceId || sourceId === targetId) return;

        // Get current visual order IDs
        const currentIds = churchGroups.map(g => g[0]);
        const fromIndex = currentIds.indexOf(sourceId);
        const toIndex = currentIds.indexOf(targetId);

        if (fromIndex === -1 || toIndex === -1) return;

        // Move item in a copy of the ID list
        const newOrder = [...currentIds];
        const [removed] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, removed);

        // Update persistent state
        setChurchOrder(newOrder);
        setDraggedId(null);
    };

    const TabButton = ({ id, label, icon: Icon, count, colorClass, activeColorClass }: { id: typeof activeTab, label: string, icon: any, count: number, colorClass: string, activeColorClass: string }) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 border text-[10px] font-bold uppercase tracking-wide
                    ${isActive 
                        ? `${activeColorClass} shadow-sm` 
                        : `bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700`
                    }
                `}
            >
                <Icon className={`w-3 h-3 ${isActive ? 'text-current' : 'text-slate-400'}`} />
                <span>{label}</span>
                {count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                        {count}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div className="flex flex-col h-full animate-fade-in gap-2 pb-2">
            {/* Header Ultra Compacto */}
            <div className="flex-shrink-0 flex items-center justify-between px-1 h-10">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('reports.title')}</h2>
                    <div className="h-4 w-px bg-slate-300 dark:bg-slate-600"></div>
                    {/* MAIN TAB NAVIGATION BAR (Inline with Title) */}
                    <div className="flex items-center gap-2">
                        <TabButton 
                            id="churches" 
                            label="Igrejas" 
                            icon={BuildingOfficeIcon} 
                            count={churchCount} 
                            colorClass="text-brand-blue"
                            activeColorClass="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-md shadow-blue-500/20"
                        />
                        <TabButton 
                            id="unidentified" 
                            label="Pendentes" 
                            icon={ExclamationTriangleIcon} 
                            count={unidentifiedCount} 
                            colorClass="text-amber-500"
                            activeColorClass="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-md shadow-amber-500/20"
                        />
                        <TabButton 
                            id="expenses" 
                            label="Saídas" 
                            icon={BanknotesIcon} 
                            count={expensesCount} 
                            colorClass="text-red-500"
                            activeColorClass="bg-gradient-to-r from-red-500 to-rose-600 text-white border-transparent shadow-md shadow-red-500/20"
                        />
                    </div>
                </div>
                
                <button onClick={handleSaveReport} className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] text-white rounded-full font-bold text-[10px] uppercase shadow-md hover:-translate-y-0.5 transition-all active:scale-95">
                    <FloppyDiskIcon className="w-3 h-3" />
                    <span>{t('reports.saveReport')}</span>
                </button>
            </div>

            {/* SECONDARY NAVIGATION (SUB-TABS) FOR CHURCHES - DRAGGABLE */}
            {activeTab === 'churches' && churchGroups.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar border-b border-slate-100 dark:border-slate-800/50 min-h-[28px]">
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
                                    flex-shrink-0 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border transition-all text-[9px] font-bold uppercase cursor-move
                                    active:cursor-grabbing hover:scale-105
                                    ${isActive 
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-brand-blue dark:text-blue-400 border-brand-blue/30 dark:border-blue-800 shadow-sm' 
                                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }
                                    ${isDraggingSelf ? 'opacity-50 scale-95 border-dashed border-slate-400' : ''}
                                `}
                                title="Arraste para reordenar"
                            >
                                <span className="truncate max-w-[120px]">{churchName}</span>
                                <span className={`px-1 py-0 rounded-full text-[8px] ${isActive ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                                    {resultsArray.length}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                
                {/* IGREJAS TAB */}
                {activeTab === 'churches' && (
                    <div className="flex-1 min-h-0 flex flex-col animate-fade-in">
                        {churchGroups.length > 0 ? (
                            // Renderiza APENAS o grupo selecionado
                            churchGroups
                                .filter(([id]) => id === selectedChurchId)
                                .map(([churchId, results]) => (
                                    <ReportGroup key={churchId} churchId={churchId} results={results as MatchResult[]} reportType="income" defaultOpen={true} />
                                ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white/50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                <BuildingOfficeIcon className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-medium">Nenhum relatório de igreja disponível.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* PENDENTES TAB */}
                {activeTab === 'unidentified' && (
                    <div className="flex-1 min-h-0 flex flex-col animate-fade-in">
                        {unidentifiedData.length > 0 ? (
                            <ReportGroup churchId="unidentified" results={unidentifiedData} reportType="income" defaultOpen={true} />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-2xl border-2 border-dashed border-emerald-100 dark:border-emerald-800/30 h-full">
                                <CheckBadgeIcon className="w-12 h-12 mb-3 opacity-50" />
                                <p className="text-sm font-bold">Tudo certo!</p>
                                <p className="text-xs opacity-70">Não há itens pendentes de identificação.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* SAIDAS TAB */}
                {activeTab === 'expenses' && (
                    <div className="flex-1 min-h-0 flex flex-col animate-fade-in">
                        {expenseGroups.length > 0 ? (
                            expenseGroups.map(([groupId, results]) => (
                                <ReportGroup key={groupId} churchId={groupId} results={results} reportType="expenses" defaultOpen={true} />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white/50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 h-full">
                                <BanknotesIcon className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-medium">Nenhum relatório de saídas disponível.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};