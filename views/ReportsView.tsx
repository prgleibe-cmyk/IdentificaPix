
import React, { useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { EmptyState } from '../components/EmptyState';
import { EditableReportTable } from '../components/reports/EditableReportTable';
import { 
    ChartBarIcon, 
    BuildingOfficeIcon, 
    ExclamationTriangleIcon, 
    BanknotesIcon, 
    FloppyDiskIcon, 
    DocumentDuplicateIcon,
    MagnifyingGlassIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    PrinterIcon,
    DocumentArrowDownIcon,
    ArrowPathIcon,
    RectangleStackIcon
} from '../components/Icons';
import { formatCurrency, formatDate } from '../utils/formatters';
import { MatchResult } from '../types';

export const ReportsView: React.FC = () => {
    const { 
        reportPreviewData, 
        activeReportId, 
        saveCurrentReportChanges, 
        openSaveReportModal, 
        matchResults,
        updateReportData,
        loadingAiId,
        openSmartEdit
    } = useContext(AppContext);
    
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();
    
    // Categorias Principais (Adicionado 'general')
    const [activeCategory, setActiveCategory] = useState<'general' | 'churches' | 'unidentified' | 'expenses'>('general');
    
    // ID do Relatório Específico Selecionado (Ex: ID da Igreja)
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // --- EFEITO: Seleção Inicial Automática ---
    useEffect(() => {
        if (!reportPreviewData) return;

        if (activeCategory === 'general') {
            setSelectedReportId('general_all');
        } else if (activeCategory === 'churches') {
            const churchIds = Object.keys(reportPreviewData.income).filter(k => k !== 'unidentified').sort();
            if (churchIds.length > 0) {
                if (!selectedReportId || !churchIds.includes(selectedReportId) || selectedReportId === 'general_all') {
                    setSelectedReportId(churchIds[0]);
                }
            } else {
                setSelectedReportId(null);
            }
        } else if (activeCategory === 'unidentified') {
            setSelectedReportId('unidentified');
        } else if (activeCategory === 'expenses') {
            setSelectedReportId('all_expenses_group');
        }
    }, [activeCategory, reportPreviewData]);

    // --- DADOS CALCULADOS ---
    const churchList = useMemo(() => {
        if (!reportPreviewData?.income) return [];
        return Object.entries(reportPreviewData.income)
            .filter(([id]) => id !== 'unidentified')
            .map(([id, results]) => {
                const res = results as MatchResult[];
                return {
                    id,
                    name: res[0]?.church?.name || 'Igreja Desconhecida',
                    count: res.length,
                    total: res.reduce((sum, r) => sum + r.transaction.amount, 0)
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [reportPreviewData]);

    const counts = useMemo(() => {
        // Flatten all income for general count
        const general = reportPreviewData ? Object.values(reportPreviewData.income).flat().length : 0;
        const churches = churchList.length;
        const pending = reportPreviewData?.income['unidentified']?.length || 0;
        const expenses = reportPreviewData?.expenses['all_expenses_group']?.length || 0;
        return { general, churches, pending, expenses };
    }, [churchList, reportPreviewData]);

    // Dados da Tabela Ativa
    const activeData = useMemo(() => {
        if (!reportPreviewData) return [];
        
        let data: MatchResult[] = [];
        
        if (activeCategory === 'general') {
            // Combina tudo de income (Igrejas + Não Identificados)
            data = (Object.values(reportPreviewData.income) as MatchResult[][]).flat();
        } else if (activeCategory === 'expenses') {
            data = reportPreviewData.expenses['all_expenses_group'] || [];
        } else if (selectedReportId) {
            data = reportPreviewData.income[selectedReportId] || [];
        }

        // Filtragem local por termo de busca
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(r => 
                (r.transaction.description || '').toLowerCase().includes(lower) ||
                (r.contributor?.name || '').toLowerCase().includes(lower) ||
                (r.contributor?.cleanedName || '').toLowerCase().includes(lower)
            );
        }

        return data;
    }, [reportPreviewData, selectedReportId, activeCategory, searchTerm]);

    const activeReportType = activeCategory === 'expenses' ? 'expenses' : 'income';

    // Totais do Relatório Ativo
    const activeSummary = useMemo(() => {
        const count = activeData.length;
        
        // CALCULO DO TOTAL GERAL DA TABELA
        const total = activeData.reduce((sum, r) => {
            const amount = r.status === 'PENDENTE' 
                ? (r.contributorAmount || r.contributor?.amount || 0) 
                : r.transaction.amount;
            return sum + amount;
        }, 0);
        
        // Filtros
        const pendingTxs = activeData.filter(r => r.status === 'PENDENTE' || r.status === 'NÃO IDENTIFICADO');
        const autoTxs = activeData.filter(r => r.status === 'IDENTIFICADO' && r.matchMethod !== 'MANUAL');
        const manualTxs = activeData.filter(r => r.status === 'IDENTIFICADO' && r.matchMethod === 'MANUAL');

        const pending = pendingTxs.length;
        const pendingValue = pendingTxs.reduce((sum, r) => {
             const val = r.status === 'PENDENTE' ? (r.contributorAmount || r.contributor?.amount || 0) : r.transaction.amount;
             return sum + val;
        }, 0);

        const auto = autoTxs.length;
        const autoValue = autoTxs.reduce((sum, r) => sum + r.transaction.amount, 0);

        const manual = manualTxs.length;
        const manualValue = manualTxs.reduce((sum, r) => sum + r.transaction.amount, 0);

        return { 
            count, total, 
            pending, pendingValue, 
            auto, autoValue, 
            manual, manualValue 
        };
    }, [activeData]);

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortedData = useMemo(() => {
        if (!sortConfig) return activeData;
        return [...activeData].sort((a, b) => {
            let valA: any;
            let valB: any;

            if (sortConfig.key.includes('.')) {
                const parts = sortConfig.key.split('.');
                valA = parts.reduce((obj: any, k) => obj?.[k], a);
                valB = parts.reduce((obj: any, k) => obj?.[k], b);
            } else {
                valA = (a as any)[sortConfig.key];
                valB = (b as any)[sortConfig.key];
            }

            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [activeData, sortConfig]);

    const handleSaveReport = () => {
        const resultsToSave = matchResults;
        openSaveReportModal({
            type: 'global',
            results: resultsToSave,
            groupName: 'Geral'
        });
    };

    const handleDownload = () => {
        const headers = ["Data", "Descrição", "Tipo", "Status", "Valor", "Igreja"]; // Added Church
        const csvContent = [
            headers.join(";"),
            ...sortedData.map(r => {
                const isGhost = r.status === 'PENDENTE';
                const date = formatDate(isGhost ? (r.contributor?.date || r.transaction.date) : r.transaction.date);
                const desc = (r.contributor?.cleanedName || r.transaction.description).replace(/;/g, ' ');
                const type = (r.contributor?.contributionType || r.transaction.contributionType || "").replace(/;/g, ' ');
                const status = r.status === 'IDENTIFICADO' ? (r.matchMethod || 'AUTO') : r.status;
                const church = (r.church?.name || '---').replace(/;/g, ' ');
                const rawAmount = isGhost ? (r.contributorAmount || r.contributor?.amount || 0) : r.transaction.amount;
                const amount = Number(rawAmount).toFixed(2).replace('.', ',');
                
                return [`"${date}"`, `"${desc}"`, `"${type}"`, `"${status}"`, `"${amount}"`, `"${church}"`].join(";");
            })
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `relatorio_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const title = activeCategory === 'general' ? 'Relatório Geral de Entradas' 
            : activeCategory === 'churches' 
            ? (churchList.find(c => c.id === selectedReportId)?.name || 'Relatório de Igreja')
            : activeCategory === 'unidentified' ? 'Transações Pendentes' : 'Saídas e Despesas';

        const tableRows = sortedData.map(r => {
            const isGhost = r.status === 'PENDENTE';
            const date = formatDate(isGhost ? (r.contributor?.date || r.transaction.date) : r.transaction.date);
            const name = r.contributor?.cleanedName || r.contributor?.name || r.transaction.cleanedDescription || r.transaction.description;
            const amountVal = isGhost ? (r.contributorAmount || r.contributor?.amount || 0) : r.transaction.amount;
            const amount = formatCurrency(amountVal, language);
            const type = r.contributor?.contributionType || r.transaction.contributionType || '---';
            const status = r.status === 'IDENTIFICADO' ? (r.matchMethod || 'AUTO') : r.status;
            const churchName = r.church?.name || '-';

            return `
                <tr>
                    <td>${date}</td>
                    <td>${name}</td>
                    <td style="font-size: 9px;">${churchName}</td>
                    <td style="text-align: center;">${type}</td>
                    <td style="text-align: center;">${status}</td>
                    <td style="text-align: right;">${amount}</td>
                </tr>
            `;
        }).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>${title} - IdentificaPix</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; }
                        h1 { font-size: 20px; margin-bottom: 5px; text-transform: uppercase; }
                        p { margin: 0 0 20px 0; color: #64748b; font-size: 12px; }
                        .summary { display: flex; gap: 20px; margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
                        .summary-item { display: flex; flex-direction: column; }
                        .summary-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; }
                        .summary-value { font-size: 14px; font-weight: bold; color: #0f172a; }
                        table { width: 100%; border-collapse: collapse; font-size: 11px; }
                        th { text-align: left; background: #f1f5f9; padding: 8px; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 10px; color: #475569; }
                        td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
                        tr:nth-child(even) { background: #f8fafc; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <p>Gerado em: ${new Date().toLocaleString()}</p>
                    
                    <div class="summary">
                        <div class="summary-item">
                            <span class="summary-label">Quantidade</span>
                            <span class="summary-value">${activeSummary.count}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Total</span>
                            <span class="summary-value">${formatCurrency(activeSummary.total, language)}</span>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width: 12%">Data</th>
                                <th style="width: 35%">Nome / Descrição</th>
                                <th style="width: 20%">Igreja</th>
                                <th style="width: 10%; text-align: center;">Tipo</th>
                                <th style="width: 10%; text-align: center;">Status</th>
                                <th style="width: 13%; text-align: right;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleRowChange = (updatedRow: MatchResult) => {
        updateReportData(updatedRow); // Updated to use single arg atomic update
    };

    const handleEdit = (row: MatchResult) => {
        openSmartEdit(row);
    };

    // Componente de Botão de Categoria (Compacto e com Gradiente)
    const CategoryPill = ({ id, label, count, icon: Icon }: any) => {
        const isActive = activeCategory === id;
        
        let activeClass = "";
        let iconClass = "";
        
        if (id === 'general') {
            activeClass = "bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-md shadow-slate-500/30";
            iconClass = isActive ? "text-white" : "text-slate-600 dark:text-slate-300";
        } else if (id === 'churches') {
            activeClass = "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30";
            iconClass = isActive ? "text-white" : "text-blue-500";
        } else if (id === 'unidentified') {
            activeClass = "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/30";
            iconClass = isActive ? "text-white" : "text-amber-500";
        } else {
            activeClass = "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-red-500/30";
            iconClass = isActive ? "text-white" : "text-rose-500";
        }

        const baseClass = "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700";

        return (
            <button
                onClick={() => setActiveCategory(id)}
                className={`
                    relative flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 text-[10px] font-bold uppercase tracking-wide
                    ${isActive ? `${activeClass} transform scale-105 z-10 border-transparent` : baseClass}
                `}
            >
                <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
                <span>{label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] leading-none ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-500'}`}>
                    {count}
                </span>
            </button>
        );
    };

    // Componente de Botão de Igreja (Compacto)
    const ChurchChip: React.FC<{ item: { id: string; name: string; count: number; total: number } }> = ({ item }) => {
        const isSelected = selectedReportId === item.id;
        return (
            <button
                onClick={() => setSelectedReportId(item.id)}
                className={`
                    flex-shrink-0 flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-200 text-xs
                    ${isSelected 
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 shadow-sm ring-1 ring-blue-100 dark:from-blue-900/40 dark:to-indigo-900/40 dark:border-blue-800 dark:text-blue-300' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-slate-500'
                    }
                `}
            >
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_5px_rgba(37,99,235,0.6)]"></div>}
                <span className="font-bold truncate max-w-[150px]">{item.name}</span>
                <span className={`px-1.5 rounded text-[10px] font-bold ${isSelected ? 'bg-white/50 dark:bg-black/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                    {item.count}
                </span>
            </button>
        );
    };

    if (!reportPreviewData) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState
                    icon={<ChartBarIcon className="w-12 h-12 text-brand-blue dark:text-blue-400" />}
                    title={t('empty.reports.title')}
                    message={t('empty.reports.message')}
                    action={{
                        text: t('empty.dashboard.saved.action'),
                        onClick: () => setActiveView('upload'),
                    }}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in gap-2 pb-2 px-1">
            
            {/* 1. TOP BAR COMPACTADA: Title & Controls */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('reports.title')}</h2>
                    
                    {/* CATEGORY TABS (Compact) */}
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-0.5 rounded-full border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
                        <CategoryPill 
                            id="general" 
                            label="Geral" 
                            count={counts.general} 
                            icon={RectangleStackIcon} 
                        />
                        <CategoryPill 
                            id="churches" 
                            label="Igrejas" 
                            count={counts.churches} 
                            icon={BuildingOfficeIcon} 
                        />
                        <CategoryPill 
                            id="unidentified" 
                            label="Pendentes" 
                            count={counts.pending} 
                            icon={ExclamationTriangleIcon} 
                        />
                        <CategoryPill 
                            id="expenses" 
                            label="Saídas" 
                            count={counts.expenses} 
                            icon={BanknotesIcon} 
                        />
                    </div>
                </div>

                {/* ACTIONS (RIGHT) - Separated buttons for clear function distinction */}
                <div className="flex items-center gap-2 w-full md:w-auto ml-auto">
                    
                    {/* BUTTON GROUP: Toolset (Update, Download, Print) */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full p-1 mr-2 border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setActiveView('upload')} // REDIRECT TO UPLOAD VIEW
                            className="p-1.5 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-all"
                            title="Atualizar Fonte de Dados (Gerenciar Arquivos)"
                        >
                            <ArrowPathIcon className="w-4 h-4" />
                        </button>
                        <div className="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
                        <button 
                            onClick={handleDownload}
                            className="p-1.5 rounded-full text-slate-400 hover:text-brand-blue hover:bg-white dark:hover:bg-slate-700 transition-all"
                            title="Baixar CSV"
                        >
                            <DocumentArrowDownIcon className="w-4 h-4" />
                        </button>
                        <div className="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
                        <button 
                            onClick={handlePrint}
                            className="p-1.5 rounded-full text-slate-400 hover:text-brand-blue hover:bg-white dark:hover:bg-slate-700 transition-all"
                            title="Imprimir"
                        >
                            <PrinterIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Botão Salvar Alterações */}
                    {activeReportId && (
                        <button 
                            onClick={saveCurrentReportChanges}
                            className="relative flex items-center justify-center gap-2 px-4 py-2 rounded-full text-[10px] uppercase font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 transition-all active:scale-95"
                        >
                            <FloppyDiskIcon className="w-3.5 h-3.5" />
                            <span>Salvar Alt.</span>
                        </button>
                    )}

                    {/* Botão Salvar Novo Relatório */}
                    <button 
                        onClick={handleSaveReport}
                        className="relative flex items-center justify-center gap-2 px-6 py-2 rounded-full text-[10px] uppercase font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 transition-all active:scale-95"
                    >
                        <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                        <span>{t('reports.saveReport')}</span>
                    </button>
                </div>
            </div>

            {/* 2. CHURCH SELECTOR (Ultra Compact Horizontal Scroll) */}
            {activeCategory === 'churches' && (
                <div className="w-full">
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto custom-scrollbar pb-2 px-1 touch-pan-x">
                        {churchList.length > 0 ? (
                            churchList.map(item => <ChurchChip key={item.id} item={item} />)
                        ) : (
                            <span className="text-xs text-slate-400 italic px-2">Nenhuma igreja identificada.</span>
                        )}
                    </div>
                </div>
            )}

            {/* 3. REPORT CONTENT (Maximized Vertical Space) */}
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card overflow-hidden flex flex-col relative">
                
                {/* 3.1. Report Header / Stats Strip (Condensed) */}
                <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0 backdrop-blur-sm">
                    
                    <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${activeCategory === 'unidentified' ? 'bg-amber-100 text-amber-600' : activeCategory === 'expenses' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                            {activeCategory === 'unidentified' ? <ExclamationTriangleIcon className="w-4 h-4"/> : activeCategory === 'expenses' ? <BanknotesIcon className="w-4 h-4"/> : <BuildingOfficeIcon className="w-4 h-4"/>}
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wide">
                                {activeCategory === 'general' ? 'Todas as Entradas (Completo)' : 
                                 activeCategory === 'churches' 
                                    ? churchList.find(c => c.id === selectedReportId)?.name || 'Selecione uma Igreja'
                                    : activeCategory === 'unidentified' ? 'Transações Pendentes' : 'Saídas e Despesas'
                                }
                            </h3>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mt-0.5">
                                <span>Total: {activeSummary.count}</span>
                                <span className="w-px h-2 bg-slate-300"></span>
                                <span className={`${activeCategory === 'expenses' ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {formatCurrency(activeSummary.total, language)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stats Pills & Search (Compact) */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <div className="flex gap-2">
                            {/* AUTO PILL */}
                            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg">
                                <div className="flex flex-col leading-none">
                                    <span className="text-[8px] font-black uppercase tracking-wide opacity-70">Auto</span>
                                    <span className="text-[10px] font-bold">{activeSummary.auto}</span>
                                </div>
                                <span className="text-[10px] font-bold font-mono text-emerald-800 border-l border-emerald-200 pl-2">
                                    {formatCurrency(activeSummary.autoValue, language)}
                                </span>
                            </div>

                            {/* MANUAL PILL */}
                            <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg">
                                <div className="flex flex-col leading-none">
                                    <span className="text-[8px] font-black uppercase tracking-wide opacity-70">Manual</span>
                                    <span className="text-[10px] font-bold">{activeSummary.manual}</span>
                                </div>
                                <span className="text-[10px] font-bold font-mono text-blue-800 border-l border-blue-200 pl-2">
                                    {formatCurrency(activeSummary.manualValue, language)}
                                </span>
                            </div>

                            {/* PENDING PILL (Exibido apenas se > 0) */}
                            {activeSummary.pending > 0 && (
                                <div className="flex items-center gap-2 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg">
                                    <div className="flex flex-col leading-none">
                                        <span className="text-[8px] font-black uppercase tracking-wide opacity-70">Pend</span>
                                        <span className="text-[10px] font-bold">{activeSummary.pending}</span>
                                    </div>
                                    <span className="text-[10px] font-bold font-mono text-amber-800 border-l border-amber-200 pl-2">
                                        {formatCurrency(activeSummary.pendingValue, language)}
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>

                        <div className="relative group">
                            <MagnifyingGlassIcon className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors" />
                            <input 
                                type="text" 
                                placeholder="Pesquisar..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-7 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-medium focus:ring-1 focus:ring-brand-blue/30 focus:border-brand-blue outline-none w-24 focus:w-40 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* 3.2. Table Area (Takes remaining space) */}
                <div className="flex-1 min-h-0 relative">
                    {sortedData.length > 0 ? (
                        <div className="absolute inset-0">
                            <EditableReportTable 
                                data={sortedData}
                                onRowChange={handleRowChange}
                                reportType={activeReportType}
                                sortConfig={sortConfig}
                                onSort={handleSort}
                                loadingAiId={loadingAiId}
                                onEdit={handleEdit}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <p className="text-xs italic">Nenhum dado encontrado para esta seleção.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
