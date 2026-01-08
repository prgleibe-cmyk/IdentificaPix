
import React, { useState, useContext, useMemo, useRef, useEffect, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useUI } from '../contexts/UIContext';
import { formatCurrency } from '../utils/formatters';
import { supabase } from '../services/supabaseClient'; 
import { 
    TrophyIcon, 
    TableCellsIcon, 
    PlusCircleIcon, 
    PhotoIcon, 
    TrashIcon, 
    XMarkIcon, 
    ChevronUpIcon, 
    ChevronDownIcon, 
    ArrowsRightLeftIcon,
    DocumentDuplicateIcon,
    ArrowPathIcon,
    FloppyDiskIcon,
    PrinterIcon
} from '../components/Icons';
import { MatchResult, SpreadsheetData, ManualRow, ColumnDef } from '../types';
import { analysisProcessor, SortConfig } from '../services/analysisProcessor';
import { rankingService } from '../services/rankingService';
import { printService } from '../services/printService';
import { PLACEHOLDER_CHURCH, groupResultsByChurch } from '../services/processingService';

const autoResizeTextarea = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
};

export const SmartAnalysisView: React.FC = () => {
    const { t, language } = useTranslation();
    const { 
        matchResults, 
        setMatchResults, 
        setReportPreviewData, 
        setHasActiveSession,
        savedReports, 
        openSaveReportModal, 
        activeSpreadsheetData, 
        activeReportId,
        setActiveReportId, 
        overwriteSavedReport,
        churches 
    } = useContext(AppContext);
    const { showToast, setIsLoading } = useUI();
    const [activeTemplate, setActiveTemplate] = useState<'ranking' | 'manual_structure'>('ranking');

    const [reportTitle, setReportTitle] = useState('Relatório Financeiro');
    const [reportLogo, setReportLogo] = useState<string | null>(null);
    const [signatures, setSignatures] = useState<string[]>(['Tesoureiro', 'Pastor Responsável']);
    const [manualRows, setManualRows] = useState<ManualRow[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(false);
    
    const [columns, setColumns] = useState<ColumnDef[]>([
        { id: 'index', label: 'Pos', type: 'index', editable: false, removable: false, visible: true },
        { id: 'description', label: 'Igreja / Congregação', type: 'text', editable: true, removable: false, visible: true },
        { id: 'income', label: 'Entradas', type: 'currency', editable: true, removable: false, visible: true },
        { id: 'expense', label: 'Saídas', type: 'currency', editable: true, removable: false, visible: true },
        { id: 'balance', label: 'Saldo', type: 'computed', editable: false, removable: false, visible: true },
        { id: 'qty', label: 'Qtd', type: 'number', editable: true, removable: false, visible: true },
    ]);
    
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    
    const [sumModal, setSumModal] = useState<{ isOpen: boolean, rowId: string, colId: string, currentValue: number } | null>(null);
    const [sumValue, setSumValue] = useState('');

    const [showReportSelector, setShowReportSelector] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Carrega planilha salva se houver (Modo Edição de Planilha Salva)
    useEffect(() => {
        if (activeSpreadsheetData && activeReportId) {
            setManualRows(activeSpreadsheetData.rows);
            setColumns(activeSpreadsheetData.columns);
            setReportTitle(activeSpreadsheetData.title);
            setSignatures(activeSpreadsheetData.signatures || []);
            setReportLogo(activeSpreadsheetData.logo);
            setActiveTemplate('manual_structure');
        }
    }, [activeSpreadsheetData, activeReportId]);

    // Função centralizada para processar e exibir o ranking
    const generateRankingFromData = useCallback((data: MatchResult[], reportName: string) => {
        setIsRankingLoading(true);
        setManualRows([]); // Feedback visual imediato

        setTimeout(() => {
            try {
                const { rows, columns, title } = rankingService.generateRanking(data, churches, reportName);
                
                setColumns(columns);
                setManualRows(rows);
                setReportTitle(title);
                setActiveTemplate('ranking');
                
                if (rows.length === 0) {
                    showToast("O relatório foi carregado, mas nenhum dado qualificado para ranking foi encontrado.", "error");
                }
            } catch (error) {
                console.error("Erro ao gerar ranking:", error);
                showToast("Erro ao processar dados para o ranking.", "error");
            } finally {
                setIsRankingLoading(false);
            }
        }, 50); 
    }, [churches, showToast]);

    const handleRankingClick = () => {
        if (matchResults.length > 0 && activeReportId) {
             generateRankingFromData(matchResults, '');
             showToast("Ranking gerado com dados do relatório ativo.", "success");
             return;
        }
        if (matchResults.length > 0 && !activeReportId) {
             generateRankingFromData(matchResults, 'Sessão Atual');
             showToast("Ranking gerado com dados da sessão atual.", "success");
             return;
        }
        setShowReportSelector(true);
    };

    const handleManualClick = () => {
        if (activeReportId) setActiveReportId(null);
        setActiveTemplate('manual_structure');
        setManualRows([]);
        setReportTitle("Relatório Manual");
        setColumns(analysisProcessor.createDefaultColumns());
        showToast("Nova planilha criada.", "success");
    };

    const handleSelectReport = async (report: any) => {
        setShowReportSelector(false);
        setIsLoading(true);
        try {
            let results: MatchResult[] | undefined = report.data?.results;
            if (!results) {
                const { data, error } = await supabase.from('saved_reports').select('data').eq('id', report.id).single();
                if (error) throw error;
                if (data) {
                    const parsedData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                    results = parsedData?.results;
                }
            }

            if (results && Array.isArray(results) && results.length > 0) {
                const hydratedResults = results.map((r: any) => {
                    const churchId = r.church?.id || r._churchId;
                    const realChurch = churches.find(c => c.id === churchId);
                    const finalChurch = realChurch || r.church || PLACEHOLDER_CHURCH;
                    return {
                        ...r,
                        church: finalChurch,
                        contributor: r.contributor ? { ...r.contributor, church: finalChurch } : null
                    };
                });

                setMatchResults(hydratedResults);
                setReportPreviewData({
                    income: groupResultsByChurch(hydratedResults.filter((r: any) => r.transaction.amount > 0 || r.status === 'PENDENTE')),
                    expenses: { 'all_expenses_group': hydratedResults.filter((r: any) => r.transaction.amount < 0) }
                });
                setActiveReportId(report.id);
                setHasActiveSession(true);
                generateRankingFromData(hydratedResults, report.name);
                showToast(`Relatório "${report.name}" carregado e ranking gerado.`, "success");
            } else {
                showToast("Este relatório não contém dados válidos ou está vazio.", "error");
            }
        } catch (error: any) {
            console.error("Erro ao carregar relatório:", error);
            showToast("Erro ao processar relatório: " + error.message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setReportLogo(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleAddRow = () => {
        const newRow = analysisProcessor.createEmptyRow(columns);
        setManualRows([...manualRows, newRow]);
    };

    const updateRow = (id: string, field: string, value: any) => {
        setManualRows(prev => prev.map(row => row.id !== id ? row : { ...row, [field]: value }));
    };

    const handleDeleteRow = (id: string) => {
        setManualRows(prev => prev.filter(r => r.id !== id));
    };

    const handleSort = (columnId: string) => {
        setSortConfig(current => ({
            key: columnId,
            direction: current?.key === columnId && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleAddColumn = () => {
        const newId = `custom_${Date.now()}`;
        const newCol: ColumnDef = { id: newId, label: 'Nova Coluna', type: 'text', editable: true, removable: true, visible: true };
        setColumns(prev => [...prev, newCol]);
    };

    const handleRemoveColumn = (colId: string) => {
        setColumns(prev => prev.filter(c => c.id !== colId));
    };

    const updateColumnLabel = (colId: string, newLabel: string) => {
        setColumns(prev => prev.map(c => c.id === colId ? { ...c, label: newLabel } : c));
    };

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
        const addedAmount = analysisProcessor.parseBRLInput(sumValue);
        const newValue = sumModal.currentValue + addedAmount;
        updateRow(sumModal.rowId, sumModal.colId, newValue);
        closeSumModal();
    };

    const sortedRows = useMemo(() => {
        return analysisProcessor.sortRows(manualRows, sortConfig);
    }, [manualRows, sortConfig]);

    const summaryData = useMemo(() => {
        return analysisProcessor.calculateSummary(manualRows);
    }, [manualRows]);

    const handleAddSignature = () => setSignatures(prev => [...prev, 'Nova Assinatura']);
    const handleUpdateSignature = (index: number, value: string) => {
        const newSigs = [...signatures];
        newSigs[index] = value;
        setSignatures(newSigs);
    };
    const handleDeleteSignature = (index: number) => setSignatures(prev => prev.filter((_, i) => i !== index));
    
    const handleSave = () => {
        const spreadsheetData: SpreadsheetData = {
            title: reportTitle,
            logo: reportLogo,
            columns,
            rows: manualRows,
            signatures
        };

        if (activeReportId) {
            overwriteSavedReport(activeReportId, [], spreadsheetData);
        } else {
            openSaveReportModal({
                type: 'spreadsheet',
                groupName: reportTitle,
                spreadsheetData: spreadsheetData,
                results: [] 
            });
        }
    };

    const handlePrint = () => {
        const spreadsheetData: SpreadsheetData = {
            title: reportTitle,
            logo: reportLogo,
            columns,
            rows: manualRows,
            signatures
        };
        printService.printSpreadsheet(spreadsheetData);
    };

    return (
        <div className="flex flex-col h-full animate-fade-in gap-3 pb-2">
            
            {/* Top Bar / Navigation */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 flex-shrink-0 px-1">
                <div>
                    <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('smart_analysis.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">{t('smart_analysis.subtitle')}</p>
                </div>

                <div className="md:absolute md:left-1/2 md:-translate-x-1/2 flex items-center gap-3 justify-center">
                    <button 
                        onClick={handleRankingClick} 
                        className={`
                            relative flex items-center justify-center gap-2 px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 group border
                            ${activeTemplate === 'ranking' 
                                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-violet-500/30 border-transparent transform scale-105' 
                                : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-violet-600 border-slate-200 dark:border-slate-700'
                            }
                        `}
                    >
                        <TrophyIcon className={`w-3.5 h-3.5 ${activeTemplate === 'ranking' ? 'text-amber-300 stroke-[2]' : ''}`} />
                        <span>Gerar Ranking</span>
                    </button>

                    <button 
                        onClick={handleManualClick}
                        className={`
                            relative flex items-center justify-center gap-2 px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 group border
                            ${activeTemplate === 'manual_structure'
                                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-cyan-500/30 border-transparent transform scale-105'
                                : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-cyan-600 border-slate-200 dark:border-slate-700'
                            }
                        `}
                    >
                        <TableCellsIcon className="w-3.5 h-3.5" />
                        <span>Nova Planilha</span>
                    </button>
                </div>

                {/* Right Actions: Icons Group */}
                <div className="flex items-center ml-auto">
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <button 
                            onClick={handlePrint}
                            className="p-2 text-slate-500 hover:text-brand-blue hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-all"
                            title="Imprimir"
                        >
                            <PrinterIcon className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1"></div>
                        <button 
                            onClick={handleSave}
                            className={`p-2 rounded-full transition-all ${
                                activeReportId 
                                ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20' 
                                : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }`}
                            title={activeReportId ? 'Salvar Alterações' : 'Salvar Relatório'}
                        >
                            <FloppyDiskIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* --- UNIFIED MANUAL REPORT BUILDER --- */}
            <div 
                className="flex-1 bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col p-4 md:p-6 relative animate-fade-in-up"
            >
                
                {/* REPORT HEADER SECTION */}
                <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-4">
                    <div className="flex items-center gap-4 w-full">
                        <div 
                            className="w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-brand-blue group relative overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors flex-shrink-0"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {reportLogo ? (
                                <img src={reportLogo} alt="Logo" className="w-full h-full object-contain" />
                            ) : (
                                <PhotoIcon className="w-8 h-8 text-slate-300 group-hover:text-brand-blue transition-colors" />
                            )}
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                        </div>

                        <div className="flex-1">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 ml-1">
                                TÍTULO DO RELATÓRIO
                            </label>
                            <input 
                                type="text" 
                                value={reportTitle}
                                onChange={(e) => setReportTitle(e.target.value)}
                                className="text-xl md:text-2xl font-black text-slate-800 dark:text-white bg-transparent border-none p-0 focus:ring-0 placeholder:text-slate-300 w-full outline-none leading-tight"
                                placeholder="DIGITE UM TÍTULO"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                        <button onClick={handleAddColumn} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 hover:from-slate-500 hover:via-slate-600 hover:to-slate-700 border border-slate-500 text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-slate-500/20 transition-all hover:shadow-xl active:scale-95">
                            <ArrowsRightLeftIcon className="w-3.5 h-3.5" /> <span>Nova Coluna</span>
                        </button>
                        <button onClick={handleAddRow} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0F4C75] to-[#3282B8] hover:from-[#165D8C] hover:to-[#4FA2D6] border border-[#0F4C75] text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-cyan-900/20 transition-all hover:shadow-xl active:scale-95">
                            <PlusCircleIcon className="w-4 h-4" /> <span>Adicionar Linha</span>
                        </button>
                    </div>
                </div>

                {/* TABLE AREA */}
                <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 dark:border-slate-700 rounded-2xl mb-4 bg-white dark:bg-slate-900/50 relative">
                    {isRankingLoading && (
                        <div className="absolute inset-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                            <ArrowPathIcon className="w-10 h-10 animate-spin mb-3 text-brand-blue" />
                            <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Processando Ranking...</p>
                        </div>
                    )}

                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                {columns.map(col => (
                                    <th key={col.id} className={`px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest group ${['income','expense','balance'].includes(col.id) ? 'text-right' : col.id === 'index' ? 'text-center w-16' : ''}`}>
                                        <div className={`flex items-center gap-2 ${['income','expense','balance'].includes(col.id) ? 'justify-end' : col.id === 'index' ? 'justify-center' : 'justify-start'}`}>
                                            {col.removable ? (
                                                <input 
                                                    type="text" 
                                                    value={col.label} 
                                                    onChange={(e) => updateColumnLabel(col.id, e.target.value)}
                                                    className="bg-transparent outline-none w-24 text-center border-b border-transparent focus:border-brand-blue"
                                                />
                                            ) : (
                                                <span className="cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" onClick={() => handleSort(col.id)}>
                                                    {col.label}
                                                </span>
                                            )}
                                            <button onClick={() => handleSort(col.id)} className={`transition-colors ${sortConfig?.key === col.id ? 'text-brand-blue' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}>
                                                {sortConfig?.key === col.id && sortConfig.direction === 'desc' ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronUpIcon className="w-3 h-3" />}
                                            </button>
                                            {col.removable && (
                                                <button onClick={() => handleRemoveColumn(col.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <XMarkIcon className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                ))}
                                <th className="w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {manualRows.length > 0 ? (
                                sortedRows.map((row, index) => (
                                    <tr key={row.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        {columns.map(col => {
                                            if (col.id === 'index') {
                                                return <td key={col.id} className="px-6 py-4 text-center text-xs font-bold text-slate-500">{index + 1}</td>;
                                            }
                                            if (col.type === 'computed' && col.id === 'balance') {
                                                return (
                                                    <td key={col.id} className="px-6 py-4 text-right text-xs font-black text-slate-900 dark:text-white font-mono">
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
                                                                className="opacity-0 group-hover/cell:opacity-100 p-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-brand-blue hover:bg-blue-50 transition-all shadow-sm"
                                                                title="Somar valor"
                                                                tabIndex={-1}
                                                            >
                                                                <PlusCircleIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <input 
                                                                type="text"
                                                                value={analysisProcessor.formatBRLInput(val)}
                                                                onChange={(e) => updateRow(row.id, col.id, analysisProcessor.parseBRLInput(e.target.value))}
                                                                className={`w-28 bg-transparent font-bold text-xs text-right focus:outline-none font-mono ${colorClass}`}
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
                                                        className={`w-full bg-transparent font-bold text-slate-700 dark:text-slate-200 text-xs focus:outline-none ${col.id === 'qty' ? 'text-center' : 'uppercase'}`}
                                                        placeholder={col.label.toUpperCase()}
                                                    />
                                                </td>
                                            );
                                        })}
                                        <td className="px-2 py-4 text-center">
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
                        <tfoot className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-800 dark:text-white">
                            <tr>
                                {columns.map(col => {
                                    if (col.id === 'index') return <td key={col.id} className="px-6 py-4"></td>;
                                    
                                    if (col.id === 'description') {
                                        return <td key={col.id} className="px-6 py-4 uppercase tracking-widest text-right pr-4">RESUMO GERAL:</td>;
                                    }

                                    if (col.id === 'income') {
                                        return <td key={col.id} className="px-6 py-4 text-right text-emerald-700 dark:text-emerald-400">{formatCurrency(summaryData.income, language)}</td>;
                                    }
                                    if (col.id === 'expense') {
                                        return <td key={col.id} className="px-6 py-4 text-right text-red-700 dark:text-red-400">{formatCurrency(summaryData.expense, language)}</td>;
                                    }
                                    if (col.id === 'balance') {
                                        const bal = summaryData.income - summaryData.expense;
                                        return <td key={col.id} className="px-6 py-4 text-right text-brand-blue dark:text-blue-400">{formatCurrency(bal, language)}</td>;
                                    }
                                    if (col.id === 'qty') {
                                         return <td key={col.id} className="px-6 py-4 text-center">{summaryData.qty}</td>;
                                    }

                                    return <td key={col.id} className="px-6 py-4"></td>;
                                })}
                                <td className="px-2 py-4"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* FOOTER / SIGNATURES SECTION */}
                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">ASSINATURAS (RODAPÉ)</p>
                    <div className="flex flex-wrap items-end gap-8">
                        {signatures.map((sig, index) => (
                            <div key={index} className="flex-1 min-w-[200px] max-w-xs group relative flex flex-col justify-end">
                                <div className="w-full border-t border-slate-800 dark:border-slate-400 mb-3"></div>
                                <textarea 
                                    value={sig}
                                    onChange={(e) => handleUpdateSignature(index, e.target.value)}
                                    onInput={(e) => autoResizeTextarea(e.currentTarget)}
                                    rows={1}
                                    className="w-full text-center font-bold text-xs text-slate-600 dark:text-slate-300 bg-transparent focus:outline-none uppercase resize-none overflow-hidden"
                                    placeholder={`CARGO / NOME\nINFO ADICIONAL`}
                                    style={{ minHeight: '24px' }}
                                />
                                <button onClick={() => handleDeleteSignature(index)} className="absolute -top-6 right-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1">
                                    <XMarkIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        <button onClick={handleAddSignature} className="h-10 px-6 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-[10px] font-bold text-slate-400 hover:text-brand-blue hover:border-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all uppercase tracking-wide flex items-center gap-2 mb-1">
                            <PlusCircleIcon className="w-3.5 h-3.5" /> <span>Adicionar</span>
                        </button>
                    </div>
                </div>

                {/* SUMMATION MODAL OVERLAY */}
                {sumModal && (
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50 animate-fade-in">
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
                                    <input autoFocus type="text" value={analysisProcessor.formatBRLInput(analysisProcessor.parseBRLInput(sumValue))} onChange={(e) => setSumValue(e.target.value)} className="w-full pl-8 pr-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-lg font-bold text-emerald-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="0,00" />
                                </div>
                                <button type="submit" className="w-full py-3 bg-brand-blue hover:bg-blue-600 text-white rounded-xl font-bold uppercase text-xs tracking-wide shadow-lg transition-all active:scale-95">Confirmar Soma</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* --- Report Selector Modal --- */}
            {showReportSelector && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
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
