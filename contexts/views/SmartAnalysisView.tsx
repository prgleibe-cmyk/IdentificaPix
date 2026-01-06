
import React, { useState, useContext, useMemo, useRef, useEffect, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useUI } from '../contexts/UIContext';
import { formatCurrency } from '../utils/formatters';
import { supabase } from '../services/supabaseClient'; 
import { 
    TrophyIcon, 
    TableCellsIcon, 
    PrinterIcon, 
    PlusCircleIcon, 
    PhotoIcon, 
    TrashIcon, 
    XMarkIcon, 
    ChevronUpIcon, 
    ChevronDownIcon, 
    ArrowsRightLeftIcon,
    DocumentDuplicateIcon,
    ArrowPathIcon,
    FloppyDiskIcon
} from '../components/Icons';
import { MatchResult } from '../types';

interface ManualRow {
    id: string;
    description: string;
    income: number;
    expense: number;
    qty: number;
    // Support for dynamic columns
    [key: string]: any; 
}

interface ColumnDef {
    id: string;
    label: string;
    type: 'text' | 'currency' | 'number' | 'computed' | 'index';
    editable: boolean;
    removable: boolean;
    visible: boolean;
}

// --- Helper: Format BRL Input ---
const formatBRLInput = (value: number | undefined): string => {
    if (value === undefined || value === null) return '0,00';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// --- Helper: Parse BRL Input ---
const parseBRLInput = (value: string): number => {
    const digits = value.replace(/\D/g, '');
    return parseInt(digits || '0') / 100;
};

export const SmartAnalysisView: React.FC = () => {
    const { t, language } = useTranslation();
    const { matchResults, savedReports, openSaveReportModal } = useContext(AppContext);
    const { showToast, setIsLoading } = useUI();
    const [activeTemplate, setActiveTemplate] = useState<'ranking' | 'manual_structure'>('ranking');

    // --- State for Report Builder ---
    const [reportTitle, setReportTitle] = useState('Relatório Financeiro');
    const [reportLogo, setReportLogo] = useState<string | null>(null);
    const [signatures, setSignatures] = useState<string[]>(['Tesoureiro', 'Pastor Responsável']);
    const [manualRows, setManualRows] = useState<ManualRow[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(false);
    
    // --- Table Configuration State ---
    const [columns, setColumns] = useState<ColumnDef[]>([
        { id: 'index', label: 'Pos', type: 'index', editable: false, removable: false, visible: true },
        { id: 'description', label: 'Igreja / Congregação', type: 'text', editable: true, removable: false, visible: true },
        { id: 'income', label: 'Entradas', type: 'currency', editable: true, removable: false, visible: true },
        { id: 'expense', label: 'Saídas', type: 'currency', editable: true, removable: false, visible: true },
        { id: 'balance', label: 'Saldo', type: 'computed', editable: false, removable: false, visible: true },
        { id: 'qty', label: 'Qtd', type: 'number', editable: true, removable: false, visible: true },
    ]);
    
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    
    // Summation Modal State
    const [sumModal, setSumModal] = useState<{ isOpen: boolean, rowId: string, colId: string, currentValue: number } | null>(null);
    const [sumValue, setSumValue] = useState('');

    // --- Ranking Feature State ---
    const [showReportSelector, setShowReportSelector] = useState(false);
    const [targetReportData, setTargetReportData] = useState<MatchResult[] | null>(null);
    const [selectedReportName, setSelectedReportName] = useState<string>('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Processor: Ranking Logic (Optimized & Async) ---
    const processRanking = useCallback((data: MatchResult[], reportName: string) => {
        setIsRankingLoading(true);
        // Atualiza referências para reprocessamentos futuros
        setTargetReportData(data);
        setSelectedReportName(reportName);

        // setTimeout garante que a UI atualize para o estado de loading antes de travar no processamento
        setTimeout(() => {
            const stats = new Map<string, { id: string, name: string, income: number, expense: number, count: number }>();
            
            // Loop otimizado (for-of) ao invés de map/reduce aninhados
            for (const row of data) {
                // Filtro rápido de status
                if (row.status !== 'IDENTIFICADO' && row.status !== 'PENDENTE') continue;

                const church = row.church || (row.contributor as any)?.church;
                let cId = church?.id || (row.contributor as any)?._churchId;
                let cName = church?.name || (row.contributor as any)?._churchName;

                // Ignora grupos inválidos
                if (!cId || cId === 'unidentified' || cId === 'placeholder') continue;

                cName = cName || 'Igreja Desconhecida';

                if(!stats.has(cId)) {
                    stats.set(cId, {
                        id: cId,
                        name: cName,
                        income: 0,
                        expense: 0,
                        count: 0
                    });
                }
                
                const entry = stats.get(cId)!;
                entry.count++;
                
                let amount = 0;
                if (row.transaction && Math.abs(row.transaction.amount) > 0) {
                    amount = row.transaction.amount;
                } else if (row.contributorAmount) {
                    amount = row.contributorAmount;
                } else if (row.contributor && row.contributor.amount) {
                    amount = row.contributor.amount;
                }
                
                const safeAmount = Number(amount) || 0;

                if (safeAmount > 0) {
                    entry.income += safeAmount;
                } else {
                    entry.expense += Math.abs(safeAmount);
                }
            }
            
            // Consolidação e Ordenação
            const result = Array.from(stats.values())
                .map(item => ({...item, balance: item.income - item.expense}))
                .sort((a,b) => b.balance - a.balance);
                
            // Configuração da Tabela para Ranking
            setColumns([
                { id: 'index', label: 'Pos', type: 'index', editable: false, removable: false, visible: true },
                { id: 'description', label: 'Igreja / Congregação', type: 'text', editable: true, removable: false, visible: true },
                { id: 'income', label: 'Entradas', type: 'currency', editable: true, removable: false, visible: true },
                { id: 'expense', label: 'Saídas', type: 'currency', editable: true, removable: false, visible: true },
                { id: 'balance', label: 'Saldo', type: 'computed', editable: false, removable: false, visible: true },
                { id: 'qty', label: 'Qtd', type: 'number', editable: true, removable: false, visible: true },
            ]);

            // Popula linhas
            setManualRows(result.map(r => ({
                id: r.id,
                description: r.name,
                income: r.income,
                expense: r.expense,
                qty: r.count
            })));

            // Ajusta Título
            setReportTitle(reportName ? `Ranking: ${reportName}` : 'Ranking Geral (Sessão Atual)');
            setActiveTemplate('ranking');
            setIsRankingLoading(false);
        }, 50); // Delay mínimo para render
    }, []);

    // --- Ranking Button Handler ---
    const handleRankingClick = () => {
        if (savedReports.length === 0 && matchResults.length === 0) {
            showToast("Necessário ter dados ativos ou relatórios salvos para gerar o Ranking.", "error");
            return;
        }
        
        // Se já tem dados carregados ou sessão ativa, ativa o modo Ranking
        if (matchResults.length > 0 && !targetReportData) {
             processRanking(matchResults, '');
             showToast("Processando dados da sessão atual...", "success");
        } else if (targetReportData) {
             processRanking(targetReportData, selectedReportName);
        } else {
             setShowReportSelector(true);
        }
    };

    // --- Reset / Manual Button Handler ---
    const handleManualClick = () => {
        setActiveTemplate('manual_structure');
        // Reset to blank slate
        setManualRows([]);
        setReportTitle("Relatório Manual");
        // RESTORED FULL COLUMN STRUCTURE
        setColumns([
            { id: 'index', label: 'Item', type: 'index', editable: false, removable: false, visible: true },
            { id: 'description', label: 'Descrição', type: 'text', editable: true, removable: false, visible: true },
            { id: 'income', label: 'Entradas', type: 'currency', editable: true, removable: false, visible: true },
            { id: 'expense', label: 'Saídas', type: 'currency', editable: true, removable: false, visible: true },
            { id: 'balance', label: 'Saldo', type: 'computed', editable: false, removable: false, visible: true },
            { id: 'qty', label: 'Qtd', type: 'number', editable: true, removable: false, visible: true },
        ]);
        setTargetReportData(null);
        setSelectedReportName('');
        showToast("Nova planilha criada.", "success");
    };

    const handleSelectReport = async (report: any) => {
        setIsLoading(true);
        try {
            let results: MatchResult[] | undefined = report.data?.results;

            // LAZY LOAD
            if (!results) {
                const { data, error } = await supabase
                    .from('saved_reports')
                    .select('data')
                    .eq('id', report.id)
                    .single();
                
                if (error) throw error;
                
                if (data) {
                    const parsedData = typeof data.data === 'string' 
                        ? JSON.parse(data.data) 
                        : data.data;
                    results = parsedData?.results;
                }
            }

            if (results && Array.isArray(results)) {
                setShowReportSelector(false);
                processRanking(results, report.name);
                showToast(`Relatório "${report.name}" carregado.`, "success");
            } else {
                showToast("Este relatório não contém dados válidos.", "error");
            }
        } catch (error: any) {
            console.error("Erro ao carregar relatório:", error);
            showToast("Erro ao processar relatório: " + error.message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Core Handlers ---
    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setReportLogo(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleAddRow = () => {
        const newRow: ManualRow = {
            id: `row-${Date.now()}`,
            description: '',
            income: 0,
            expense: 0,
            qty: 0,
            ...columns.reduce((acc, col) => {
                if (col.removable) acc[col.id] = ''; 
                return acc;
            }, {} as any)
        };
        setManualRows([...manualRows, newRow]);
    };

    const updateRow = (id: string, field: string, value: any) => {
        setManualRows(prev => prev.map(row => {
            if (row.id !== id) return row;
            return { ...row, [field]: value };
        }));
    };

    const handleDeleteRow = (id: string) => {
        setManualRows(prev => prev.filter(r => r.id !== id));
    };

    // --- Column Management ---
    const handleSort = (columnId: string) => {
        setSortConfig(current => {
            if (current?.key === columnId) {
                return { key: columnId, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key: columnId, direction: 'desc' };
        });
    };

    const handleAddColumn = () => {
        const newId = `custom_${Date.now()}`;
        const newCol: ColumnDef = {
            id: newId,
            label: 'Nova Coluna',
            type: 'text',
            editable: true,
            removable: true,
            visible: true
        };
        setColumns(prev => [...prev, newCol]);
    };

    const handleRemoveColumn = (colId: string) => {
        setColumns(prev => prev.filter(c => c.id !== colId));
    };

    const updateColumnLabel = (colId: string, newLabel: string) => {
        setColumns(prev => prev.map(c => c.id === colId ? { ...c, label: newLabel } : c));
    };

    // --- Summation Modal ---
    const openSumModal = (rowId: string, colId: string, currentValue: number) => {
        setSumModal({ isOpen: true, rowId, colId, currentValue });
        setSumValue('');
    };

    const closeSumModal = () => {
        setSumModal(null);
        setSumValue('');
    };

    const confirmSum = (e: React.FormEvent) => {
        e.preventDefault();
        if (!sumModal) return;
        
        const addedAmount = parseBRLInput(sumValue);
        const newValue = sumModal.currentValue + addedAmount;
        
        updateRow(sumModal.rowId, sumModal.colId, newValue);
        closeSumModal();
    };

    // --- Derived Sorted Rows ---
    const sortedRows = useMemo(() => {
        let rows = [...manualRows];
        if (sortConfig) {
            rows.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                
                if (sortConfig.key === 'balance') {
                    valA = a.income - a.expense;
                    valB = b.income - b.expense;
                }

                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return rows;
    }, [manualRows, sortConfig]);

    // --- Signature Handlers ---
    const handleAddSignature = () => setSignatures(prev => [...prev, 'Nova Assinatura']);
    const handleUpdateSignature = (index: number, value: string) => {
        const newSigs = [...signatures];
        newSigs[index] = value;
        setSignatures(newSigs);
    };
    const handleDeleteSignature = (index: number) => setSignatures(prev => prev.filter((_, i) => i !== index));
    
    // --- Save Handler ---
    const handleSave = () => {
        openSaveReportModal({
            type: 'spreadsheet',
            groupName: reportTitle,
            spreadsheetData: {
                title: reportTitle,
                logo: reportLogo,
                columns,
                rows: manualRows,
                signatures
            },
            results: [] // Satisfy type check, though unused for spreadsheet type
        });
    };

    const handlePrint = () => window.print();

    // UNIFIED BUTTON COMPONENT
    const UnifiedButton = ({ onClick, icon: Icon, label, isActive, isLast, customTextColor }: any) => {
        // Cor base definida por prop ou default branca
        // Quando ativo, aumenta brilho/escala
        const baseColorClass = customTextColor || 'text-white';
        const currentClass = isActive ? `${baseColorClass} font-black scale-105 drop-shadow-md` : `${baseColorClass} font-bold hover:scale-105 hover:brightness-125`;

        return (
            <>
                <button onClick={onClick} className={`relative flex-1 flex items-center justify-center gap-2 px-6 h-full text-[10px] uppercase transition-all duration-300 outline-none group whitespace-nowrap ${currentClass}`}>
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
                    <span className="hidden sm:inline">{label}</span>
                </button>
                {!isLast && <div className="w-px h-3 bg-white/10 self-center"></div>}
            </>
        );
    };

    return (
        <div className="flex flex-col h-full animate-fade-in gap-3 pb-2">
            
            {/* Top Bar / Navigation */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 flex-shrink-0 px-1 print:hidden relative">
                <div>
                    <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('smart_analysis.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">{t('smart_analysis.subtitle')}</p>
                </div>

                {/* GRUPO CENTRAL: Ações de Criação (Roxo/Violeta) */}
                <div className="md:absolute md:left-1/2 md:-translate-x-1/2 flex items-center h-9 bg-gradient-to-r from-[#2E1065] to-[#7C3AED] rounded-full shadow-lg border border-white/20 overflow-hidden overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-0.5 justify-center">
                    <UnifiedButton 
                        onClick={handleRankingClick} 
                        isActive={activeTemplate === 'ranking'}
                        icon={TrophyIcon}
                        label="Gerar Ranking"
                        customTextColor="text-amber-300" // Ouro/Troféu
                    />
                    <UnifiedButton 
                        onClick={handleManualClick}
                        isActive={activeTemplate === 'manual_structure'}
                        icon={TableCellsIcon}
                        label="Nova Planilha"
                        customTextColor="text-cyan-300" // Ciano/Dados
                        isLast={true}
                    />
                </div>

                {/* GRUPO DIREITO: Ações de Persistência (Verde/Esmeralda) */}
                <div className="flex items-center h-9 bg-gradient-to-r from-[#064E3B] to-[#10B981] rounded-full shadow-lg border border-white/20 overflow-hidden overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-0.5 ml-auto">
                    <UnifiedButton 
                        onClick={handleSave}
                        icon={FloppyDiskIcon}
                        label="Salvar"
                        customTextColor="text-white" // Branco/Segurança
                    />
                    <UnifiedButton 
                        onClick={handlePrint}
                        icon={PrinterIcon}
                        label="Imprimir"
                        customTextColor="text-slate-200" // Cinza/Papel
                        isLast={true}
                    />
                </div>
            </div>

            {/* --- UNIFIED MANUAL REPORT BUILDER --- */}
            {/* This block is ALWAYS rendered. Data is injected via state. */}
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col p-8 relative animate-fade-in-up print:shadow-none print:border-none print:rounded-none">
                
                {/* REPORT HEADER SECTION */}
                <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-6">
                        {/* Logo Placeholder */}
                        <div 
                            className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-brand-blue group relative overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors print:border-none"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {reportLogo ? (
                                <img src={reportLogo} alt="Logo" className="w-full h-full object-contain" />
                            ) : (
                                <PhotoIcon className="w-8 h-8 text-slate-300 group-hover:text-brand-blue transition-colors print:hidden" />
                            )}
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                        </div>

                        {/* Title Editable */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 print:hidden">
                                TÍTULO DO RELATÓRIO
                            </label>
                            <input 
                                type="text" 
                                value={reportTitle}
                                onChange={(e) => setReportTitle(e.target.value)}
                                className="text-3xl font-black text-slate-800 dark:text-white bg-transparent border-none p-0 focus:ring-0 placeholder:text-slate-300 w-full outline-none print:text-black"
                                placeholder="DIGITE UM TÍTULO"
                            />
                        </div>
                    </div>

                    {/* TABLE CONTROLS */}
                    <div className="flex gap-2 print:hidden">
                        <button onClick={handleAddColumn} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 hover:from-slate-500 hover:via-slate-600 hover:to-slate-700 border border-slate-500 text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-slate-500/20 transition-all hover:shadow-xl active:scale-95">
                            <ArrowsRightLeftIcon className="w-3.5 h-3.5" /> <span>Nova Coluna</span>
                        </button>
                        <button onClick={handleAddRow} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0F4C75] to-[#3282B8] hover:from-[#165D8C] hover:to-[#4FA2D6] border border-[#0F4C75] text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-cyan-900/20 transition-all hover:shadow-xl active:scale-95">
                            <PlusCircleIcon className="w-4 h-4" /> <span>Adicionar Linha</span>
                        </button>
                    </div>
                </div>

                {/* TABLE AREA */}
                <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 dark:border-slate-700 rounded-2xl mb-8 bg-white dark:bg-slate-900/50 relative print:overflow-visible print:border-none print:h-auto">
                    {/* LOADING OVERLAY */}
                    {isRankingLoading && (
                        <div className="absolute inset-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 print:hidden">
                            <ArrowPathIcon className="w-10 h-10 animate-spin mb-3 text-brand-blue" />
                            <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Processando Ranking...</p>
                        </div>
                    )}

                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700 print:static print:bg-transparent print:border-black">
                            <tr>
                                {columns.map(col => (
                                    <th key={col.id} className={`px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest group ${['income','expense','balance'].includes(col.id) ? 'text-right' : col.id === 'index' ? 'text-center w-16' : ''} print:text-black print:border-b print:border-black`}>
                                        <div className={`flex items-center gap-2 ${['income','expense','balance'].includes(col.id) ? 'justify-end' : col.id === 'index' ? 'justify-center' : 'justify-start'}`}>
                                            {col.removable ? (
                                                <input 
                                                    type="text" 
                                                    value={col.label} 
                                                    onChange={(e) => updateColumnLabel(col.id, e.target.value)}
                                                    className="bg-transparent outline-none w-24 text-center border-b border-transparent focus:border-brand-blue print:border-none"
                                                />
                                            ) : (
                                                <span className="cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors print:cursor-default" onClick={() => handleSort(col.id)}>
                                                    {col.label}
                                                </span>
                                            )}
                                            <button onClick={() => handleSort(col.id)} className={`transition-colors print:hidden ${sortConfig?.key === col.id ? 'text-brand-blue' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}>
                                                {sortConfig?.key === col.id && sortConfig.direction === 'desc' ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronUpIcon className="w-3 h-3" />}
                                            </button>
                                            {col.removable && (
                                                <button onClick={() => handleRemoveColumn(col.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                                                    <XMarkIcon className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                ))}
                                <th className="w-10 print:hidden"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 print:divide-slate-300">
                            {manualRows.length > 0 ? (
                                sortedRows.map((row, index) => (
                                    <tr key={row.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors print:hover:bg-transparent">
                                        {columns.map(col => {
                                            if (col.id === 'index') {
                                                return <td key={col.id} className="px-6 py-4 text-center text-xs font-bold text-slate-500 print:text-black">{index + 1}</td>;
                                            }
                                            if (col.type === 'computed' && col.id === 'balance') {
                                                return (
                                                    <td key={col.id} className="px-6 py-4 text-right text-xs font-black text-slate-900 dark:text-white font-mono print:text-black">
                                                        {formatCurrency(row.income - row.expense, language)}
                                                    </td>
                                                );
                                            }
                                            if (col.type === 'currency') {
                                                const isIncome = col.id === 'income';
                                                const isExpense = col.id === 'expense';
                                                const val = row[col.id] as number;
                                                const colorClass = isIncome ? 'text-emerald-600 dark:text-emerald-400' : isExpense ? 'text-red-600 dark:text-red-400' : 'text-slate-700';
                                                
                                                return (
                                                    <td key={col.id} className="px-6 py-4 text-right relative group/cell">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button 
                                                                onClick={() => openSumModal(row.id, col.id, val)}
                                                                className="opacity-0 group-hover/cell:opacity-100 p-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-brand-blue hover:bg-blue-50 transition-all shadow-sm print:hidden"
                                                                title="Somar valor"
                                                                tabIndex={-1}
                                                            >
                                                                <PlusCircleIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <input 
                                                                type="text"
                                                                value={formatBRLInput(val)}
                                                                onChange={(e) => updateRow(row.id, col.id, parseBRLInput(e.target.value))}
                                                                className={`w-28 bg-transparent font-bold text-xs text-right focus:outline-none font-mono ${colorClass} print:text-black`}
                                                            />
                                                        </div>
                                                    </td>
                                                );
                                            }
                                            return (
                                                <td key={col.id} className="px-6 py-4">
                                                    <input 
                                                        value={row[col.id] || ''} 
                                                        onChange={(e) => updateRow(row.id, col.id, col.type === 'number' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value)}
                                                        className={`w-full bg-transparent font-bold text-slate-700 dark:text-slate-200 text-xs focus:outline-none ${col.id === 'qty' ? 'text-center' : 'uppercase'} print:text-black`}
                                                        placeholder={col.label.toUpperCase()}
                                                    />
                                                </td>
                                            );
                                        })}
                                        <td className="px-2 py-4 text-center print:hidden">
                                            <button onClick={() => handleDeleteRow(row.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all" title="Remover Linha">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                !isRankingLoading && (
                                    <tr>
                                        <td colSpan={columns.length + 1} className="py-12 text-center text-slate-400 text-xs italic">
                                            Nenhuma linha adicionada. Clique em "Adicionar Linha" ou "Gerar Ranking" para começar.
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                {/* FOOTER / SIGNATURES SECTION */}
                <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-700 print:border-black">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 print:hidden">ASSINATURAS (RODAPÉ)</p>
                    <div className="flex flex-wrap items-end gap-8">
                        {signatures.map((sig, index) => (
                            <div key={index} className="flex-1 min-w-[200px] max-w-xs group relative">
                                <div className="w-full border-t border-slate-800 dark:border-slate-400 mb-3 print:border-black"></div>
                                <input 
                                    value={sig}
                                    onChange={(e) => handleUpdateSignature(index, e.target.value)}
                                    className="w-full text-center font-bold text-xs text-slate-600 dark:text-slate-300 bg-transparent focus:outline-none uppercase print:text-black"
                                    placeholder="CARGO / NOME"
                                />
                                <button onClick={() => handleDeleteSignature(index)} className="absolute -top-6 right-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1 print:hidden">
                                    <XMarkIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        <button onClick={handleAddSignature} className="h-10 px-6 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-[10px] font-bold text-slate-400 hover:text-brand-blue hover:border-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all uppercase tracking-wide flex items-center gap-2 mb-1 print:hidden">
                            <PlusCircleIcon className="w-3.5 h-3.5" /> <span>Adicionar</span>
                        </button>
                    </div>
                </div>

                {/* SUMMATION MODAL OVERLAY */}
                {sumModal && (
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50 animate-fade-in print:hidden">
                        <form onSubmit={confirmSum} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-80 animate-scale-in">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <PlusCircleIcon className="w-4 h-4 text-brand-blue" />
                                    Adicionar Valor
                                </h4>
                                <button type="button" onClick={closeSumModal} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-4 h-4" /></button>
                            </div>
                            <div className="space-y-4">
                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-center">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Valor Atual</p>
                                    <p className="text-xl font-mono font-black text-slate-700 dark:text-slate-300">{formatCurrency(sumModal.currentValue, language)}</p>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">+</span>
                                    <input autoFocus type="text" value={formatBRLInput(parseBRLInput(sumValue))} onChange={(e) => setSumValue(e.target.value)} className="w-full pl-8 pr-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-lg font-bold text-emerald-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="0,00" />
                                </div>
                                <button type="submit" className="w-full py-3 bg-brand-blue hover:bg-blue-600 text-white rounded-xl font-bold uppercase text-xs tracking-wide shadow-lg transition-all active:scale-95">Confirmar Soma</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* --- Report Selector Modal --- */}
            {showReportSelector && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in print:hidden">
                    <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh] overflow-hidden animate-scale-in">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white">Selecionar Relatório</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Escolha a base de dados para o ranking.</p>
                            </div>
                            <button onClick={() => setShowReportSelector(false)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/20">
                            {savedReports.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">Nenhum relatório salvo encontrado.</div>
                            ) : (
                                <div className="space-y-2">
                                    {savedReports.map(report => (
                                        <button 
                                            key={report.id}
                                            onClick={() => handleSelectReport(report)}
                                            className="w-full text-left p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-blue dark:hover:border-brand-blue hover:shadow-md transition-all group flex items-center justify-between"
                                        >
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-700 dark:text-white group-hover:text-brand-blue transition-colors">{report.name}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                                                    <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                                                    <span>•</span>
                                                    <span>{report.recordCount} registros</span>
                                                </p>
                                            </div>
                                            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-400 group-hover:bg-blue-50 group-hover:text-brand-blue transition-colors">
                                                <DocumentDuplicateIcon className="w-5 h-5" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
