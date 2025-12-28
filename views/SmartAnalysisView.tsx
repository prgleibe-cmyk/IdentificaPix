
import React, { useContext, useState, useMemo, useEffect, useRef } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { 
    PresentationChartLineIcon, 
    CircleStackIcon, 
    TrophyIcon, 
    RectangleStackIcon, 
    DocumentArrowDownIcon,
    TableCellsIcon,
    PlusCircleIcon,
    TrashIcon,
    PrinterIcon,
    FloppyDiskIcon,
    ArrowPathIcon,
    PhotoIcon,
    XMarkIcon,
    BanknotesIcon
} from '../components/Icons';
import { formatCurrency } from '../utils/formatters';
import * as XLSX from 'xlsx';
import { MatchResult, Church, Transaction } from '../types';

// Shared Row Interface for both modes
interface EditableRow {
    id: string;
    churchName: string;
    income: string;  // String for input handling
    expense: string; // String for input handling
    count: string;
}

// Calculator State Interface
interface CalculatorState {
    isOpen: boolean;
    rowId: string | null;
    field: 'income' | 'expense' | null;
    currentTotal: number;
    mode: 'ranking' | 'manual'; // Track which state to update
}

// Helper para converter string BR (1.000,00) ou US (1000.00) para Float JS
const parseBrValue = (val: string | number): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    
    // Remove tudo que não for número, vírgula, ponto ou sinal de menos
    let clean = val.replace(/[^0-9.,-]/g, '');
    
    // Se tiver vírgula, assume que é decimal BR
    if (clean.includes(',')) {
        // Remove pontos de milhar (1.000 -> 1000)
        clean = clean.replace(/\./g, '');
        // Troca vírgula por ponto decimal (1000,50 -> 1000.50)
        clean = clean.replace(',', '.');
    }
    
    return parseFloat(clean) || 0;
};

export const SmartAnalysisView: React.FC = () => {
    const { savedReports, matchResults, hasActiveSession, openSaveReportModal } = useContext(AppContext);
    const { t, language } = useTranslation();
    
    // Configuration State
    const [selectedReportId, setSelectedReportId] = useState<string>('current');
    const [activeTemplate, setActiveTemplate] = useState<string | null>('ranking'); // Default to ranking for immediate view
    
    // Data States
    const [manualRows, setManualRows] = useState<EditableRow[]>([]);
    const [rankingRows, setRankingRows] = useState<EditableRow[]>([]);
    
    // Report Customization State
    const [reportTitle, setReportTitle] = useState('Relatório Financeiro');
    const [reportLogo, setReportLogo] = useState<string | null>(null);
    const [signatures, setSignatures] = useState<string[]>(['Tesoureiro', 'Pastor Responsável']);

    // Calculator Modal State
    const [calculator, setCalculator] = useState<CalculatorState>({
        isOpen: false,
        rowId: null,
        field: null,
        currentTotal: 0,
        mode: 'manual'
    });
    const [valueToAdd, setValueToAdd] = useState('');

    // --- INITIALIZATION EFFECTS ---

    // 1. Initialize Manual Rows (Empty Template)
    useEffect(() => {
        if (activeTemplate === 'manual_structure' && manualRows.length === 0) {
            setManualRows([
                { id: '1', churchName: '', income: '', expense: '', count: '' },
                { id: '2', churchName: '', income: '', expense: '', count: '' },
                { id: '3', churchName: '', income: '', expense: '', count: '' },
            ]);
            setReportTitle('Planilha Manual');
        } else if (activeTemplate === 'ranking') {
             // Keep title consistent if switching back, unless user changed it manually (simple check)
             if (reportTitle === 'Planilha Manual') setReportTitle('Ranking Financeiro');
        }
    }, [activeTemplate]);

    // 2. Initialize Ranking Rows (From Data)
    const sourceOptions = useMemo(() => {
        const options = [];
        if (hasActiveSession && matchResults.length > 0) {
            options.push({ id: 'current', label: 'Sessão Atual (Não salvo)', count: matchResults.length });
        }
        savedReports.forEach(rep => {
            options.push({ 
                id: rep.id, 
                label: `${rep.name} (${new Date(rep.createdAt).toLocaleDateString()})`, 
                count: rep.recordCount 
            });
        });
        return options;
    }, [hasActiveSession, matchResults, savedReports]);

    const selectedData = useMemo(() => {
        if (selectedReportId === 'current') return matchResults;
        const report = savedReports.find(r => r.id === selectedReportId);
        return report?.data?.results || [];
    }, [selectedReportId, matchResults, savedReports]);

    // Effect to populate Ranking Rows when template is 'ranking' or source changes
    useEffect(() => {
        if (activeTemplate === 'ranking') {
            
            // Aggregate Data
            const churchStats = new Map<string, { income: number, expense: number, count: number }>();
            selectedData.forEach(result => {
                const churchName = result.church?.name || 'Não Identificado';
                const amount = result.transaction.amount; 
                const current = churchStats.get(churchName) || { income: 0, expense: 0, count: 0 };
                
                if (amount > 0) current.income += amount;
                else current.expense += Math.abs(amount);
                
                current.count += 1;
                churchStats.set(churchName, current);
            });

            const rows: EditableRow[] = Array.from(churchStats.entries()).map(([name, stats], index) => ({
                id: `rank-${index}-${Date.now()}`,
                churchName: name,
                income: stats.income.toFixed(2).replace('.', ','), // Format inicial BR
                expense: stats.expense.toFixed(2).replace('.', ','), // Format inicial BR
                count: stats.count.toString()
            }));

            // Initial Sort by Balance
            rows.sort((a, b) => {
                const balA = parseBrValue(a.income) - parseBrValue(a.expense);
                const balB = parseBrValue(b.income) - parseBrValue(b.expense);
                return balB - balA;
            });

            setRankingRows(rows);
        }
    }, [activeTemplate, selectedData, selectedReportId]);


    // --- GENERIC ROW HANDLERS ---

    const getActiveRows = () => activeTemplate === 'ranking' ? rankingRows : manualRows;
    const setActiveRows = (newRows: EditableRow[] | ((prev: EditableRow[]) => EditableRow[])) => {
        if (activeTemplate === 'ranking') setRankingRows(newRows);
        else setManualRows(newRows);
    };

    const handleRowChange = (id: string, field: keyof EditableRow, value: string) => {
        setActiveRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
    };

    const handleAddRow = () => {
        setActiveRows(prev => [...prev, { 
            id: `new-${Date.now()}`, 
            churchName: '', 
            income: '', 
            expense: '', 
            count: '' 
        }]);
    };

    const handleDeleteRow = (id: string) => {
        setActiveRows(prev => prev.filter(row => row.id !== id));
    };

    const handleSortRows = () => {
        setActiveRows(prev => {
            const sorted = [...prev].sort((a, b) => {
                const balanceA = parseBrValue(a.income) - parseBrValue(a.expense);
                const balanceB = parseBrValue(b.income) - parseBrValue(b.expense);
                return balanceB - balanceA; // Descending
            });
            return sorted;
        });
    };

    // --- CALCULATOR LOGIC ---
    const openCalculator = (rowId: string, field: 'income' | 'expense', currentValue: string) => {
        setCalculator({
            isOpen: true,
            rowId,
            field,
            currentTotal: parseBrValue(currentValue),
            mode: activeTemplate === 'ranking' ? 'ranking' : 'manual'
        });
        setValueToAdd('');
    };

    const closeCalculator = () => {
        setCalculator(prev => ({ ...prev, isOpen: false }));
        setValueToAdd('');
    };

    const confirmCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        // Aceita vírgula no input do modal também
        const add = parseBrValue(valueToAdd);
        if (isNaN(add) || !calculator.rowId || !calculator.field) return;

        const newTotal = calculator.currentTotal + add;
        const formattedTotal = newTotal.toFixed(2).replace('.', ','); // Volta para BR para o input
        
        // Update the specific state based on mode captured when opening
        if (calculator.mode === 'ranking') {
            setRankingRows(prev => prev.map(row => row.id === calculator.rowId ? { ...row, [calculator.field!]: formattedTotal } : row));
        } else {
            setManualRows(prev => prev.map(row => row.id === calculator.rowId ? { ...row, [calculator.field!]: formattedTotal } : row));
        }
        
        closeCalculator();
    };

    // --- EXPORT & PRINT HELPERS ---

    const getExportData = () => {
        const rows = getActiveRows();
        return rows
            .filter(row => row.churchName.trim() !== '')
            .map((row, index) => {
                const income = parseBrValue(row.income);
                const expense = parseBrValue(row.expense);
                return {
                    pos: index + 1,
                    name: row.churchName,
                    income,
                    expense,
                    balance: income - expense,
                    count: parseInt(row.count) || 0
                };
            });
    };

    const handleDownload = () => {
        const wb = XLSX.utils.book_new();
        const wsData = [
            [reportTitle],
            ['Gerado em: ' + new Date().toLocaleDateString()],
            [''], 
            ["Pos", "Igreja / Congregação", "Entradas (R$)", "Saídas (R$)", "Saldo Final (R$)", "Qtd"]
        ];

        getExportData().forEach(item => {
            wsData.push([
                item.pos.toString(),
                item.name,
                item.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                item.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                item.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                item.count.toString()
            ]);
        });

        // Signatures
        wsData.push(['']);
        wsData.push(['']);
        wsData.push(['Assinaturas:']);
        signatures.forEach(sig => {
            wsData.push(['__________________________']);
            wsData.push([sig]);
            wsData.push(['']);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

        XLSX.utils.book_append_sheet(wb, ws, "Relatório");
        XLSX.writeFile(wb, `${reportTitle.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const rowsHtml = getExportData().map(r => `
            <tr>
                <td style="text-align:center">${r.pos}</td>
                <td>${r.name}</td>
                <td style="text-align:right">${formatCurrency(r.income, language)}</td>
                <td style="text-align:right">${formatCurrency(r.expense, language)}</td>
                <td style="text-align:right; font-weight:bold; color: ${r.balance < 0 ? 'red' : 'inherit'};">${formatCurrency(r.balance, language)}</td>
                <td style="text-align:center">${r.count}</td>
            </tr>
        `).join('');

        const logoHtml = reportLogo ? `<img src="${reportLogo}" class="logo" />` : '';
        const signaturesHtml = signatures.map(sig => `
            <div class="signature-box">
                <div class="line"></div>
                <div class="role">${sig}</div>
            </div>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>${reportTitle}</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; color: #1f2937; }
                        .header { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 40px; text-align: center; }
                        .logo { max-height: 80px; max-width: 150px; object-fit: contain; }
                        h1 { font-size: 24px; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
                        .date { font-size: 12px; color: #6b7280; margin-top: 5px; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 40px; }
                        th { background: #f3f4f6; text-align: left; padding: 10px; border-bottom: 2px solid #e5e7eb; font-weight: bold; text-transform: uppercase; font-size: 10px; color: #4b5563; }
                        td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
                        tr:nth-child(even) { background-color: #f9fafb; }
                        .footer { margin-top: 60px; display: flex; justify-content: space-around; flex-wrap: wrap; gap: 40px; page-break-inside: avoid; }
                        .signature-box { text-align: center; min-width: 200px; }
                        .line { border-top: 1px solid #000; margin-bottom: 8px; width: 100%; }
                        .role { font-size: 12px; font-weight: bold; text-transform: uppercase; }
                        @media print { body { padding: 0; } th { -webkit-print-color-adjust: exact; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${logoHtml}
                        <div>
                            <h1>${reportTitle}</h1>
                            <div class="date">Gerado em ${new Date().toLocaleDateString()}</div>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="text-align:center">Pos</th>
                                <th>Igreja / Congregação</th>
                                <th style="text-align:right">Entradas</th>
                                <th style="text-align:right">Saídas</th>
                                <th style="text-align:right">Saldo</th>
                                <th style="text-align:center">Qtd</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="footer">${signaturesHtml}</div>
                    <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleSave = () => {
        const data = getExportData();
        const mockResults: MatchResult[] = data.map(item => ({
            transaction: {
                id: `smart-${Math.random()}`,
                date: new Date().toLocaleDateString('pt-BR'),
                description: 'Lançamento Smart',
                amount: item.balance,
                cleanedDescription: 'Lançamento Smart',
                originalAmount: String(item.balance)
            },
            contributor: null,
            status: 'IDENTIFICADO',
            church: {
                id: `smart-church-${Math.random()}`,
                name: item.name,
                address: '',
                logoUrl: '',
                pastor: ''
            },
            matchMethod: 'MANUAL',
            similarity: 100,
            contributorAmount: item.income
        }));

        openSaveReportModal({
            type: 'global',
            groupName: activeTemplate === 'ranking' ? 'Ranking' : 'Manual',
            results: mockResults
        });
    };

    // --- OTHER HANDLERS ---
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => setReportLogo(event.target?.result as string);
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleSignatureChange = (index: number, value: string) => {
        const newSignatures = [...signatures];
        newSignatures[index] = value;
        setSignatures(newSignatures);
    };

    const handleAddSignature = () => setSignatures([...signatures, 'Nova Assinatura']);
    const handleRemoveSignature = (index: number) => setSignatures(signatures.filter((_, i) => i !== index));

    return (
        <div className="flex flex-col h-full animate-fade-in gap-3 pb-2">
            
            {/* Header & Controls Combined */}
            <div className="flex-shrink-0 flex flex-col xl:flex-row xl:items-end justify-between gap-4 px-1">
                <div>
                    <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">
                        {t('smart_analysis.title')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1 max-w-2xl">
                        {t('smart_analysis.subtitle')}
                    </p>
                </div>

                {/* Right Side Controls */}
                <div className="flex flex-wrap items-center gap-2">
                    
                    {/* Source Selector (Pill) */}
                    <div className={`relative ${activeTemplate === 'manual_structure' ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CircleStackIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        </div>
                        <select 
                            value={selectedReportId}
                            onChange={(e) => setSelectedReportId(e.target.value)}
                            className="pl-8 pr-8 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[10px] font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-violet-500 outline-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                        >
                            {sourceOptions.length === 0 && <option disabled>Nenhum dado</option>}
                            {sourceOptions.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Mode Toggle (Segmented Pill) */}
                    <div className="flex bg-white dark:bg-slate-800 p-0.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                        <button
                            onClick={() => setActiveTemplate('ranking')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${activeTemplate === 'ranking' ? 'bg-slate-100 dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                            <TrophyIcon className="w-3 h-3" />
                            <span>Ranking</span>
                        </button>
                        <button
                            onClick={() => setActiveTemplate('manual_structure')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${activeTemplate === 'manual_structure' ? 'bg-slate-100 dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                            <TableCellsIcon className="w-3 h-3" />
                            <span>Manual</span>
                        </button>
                    </div>

                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 hidden sm:block mx-1"></div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={handleSortRows}
                            className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-full text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all shadow-sm"
                            title="Classificar por Saldo"
                        >
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            onClick={handleSave}
                            className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all shadow-sm"
                            title="Salvar no Sistema"
                        >
                            <FloppyDiskIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            onClick={handlePrint}
                            className="p-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-full text-brand-blue dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all shadow-sm"
                            title="Imprimir"
                        >
                            <PrinterIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-full font-bold text-[10px] uppercase shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 transition-all"
                        >
                            <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Excel</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area - Full Width */}
            <div className="flex-1 flex flex-col bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl rounded-[1.5rem] shadow-xl border border-white/50 dark:border-white/5 overflow-hidden relative min-h-0">
                
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-[80px] pointer-events-none -mr-20 -mt-20"></div>

                {activeTemplate ? (
                    <div className="flex-1 flex flex-col p-4 relative z-10 overflow-hidden">
                        
                        {/* --- CUSTOMIZATION HEADER (Logo/Title/Add Button) --- */}
                        <div className="flex-shrink-0 mb-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row gap-3 items-center justify-between">
                            <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                                {/* Logo Upload */}
                                <div className="relative group cursor-pointer w-12 h-12 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center hover:border-violet-500 transition-colors overflow-hidden bg-white dark:bg-slate-900 shadow-sm shrink-0">
                                    {reportLogo ? (
                                        <>
                                            <img src={reportLogo} alt="Logo" className="w-full h-full object-contain" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                <PhotoIcon className="w-5 h-5" />
                                            </div>
                                        </>
                                    ) : (
                                        <PhotoIcon className="w-5 h-5 text-slate-400 group-hover:text-violet-500" />
                                    )}
                                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>
                                
                                {/* Title Input */}
                                <div className="flex-1 w-full">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 block">Título do Relatório</label>
                                    <input 
                                        type="text" 
                                        value={reportTitle}
                                        onChange={(e) => setReportTitle(e.target.value)}
                                        className="w-full text-lg font-black text-slate-800 dark:text-white bg-transparent border-b border-transparent hover:border-slate-200 focus:border-violet-500 outline-none transition-colors placeholder:text-slate-300 pb-0.5"
                                        placeholder="Digite o título do relatório..."
                                    />
                                </div>
                            </div>

                            {/* Add Row Button - Moved to Top Right */}
                            <button 
                                onClick={handleAddRow}
                                className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold text-white bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] rounded-full shadow-md shadow-blue-500/30 hover:-translate-y-0.5 transition-all uppercase tracking-wide transform active:scale-[0.98]"
                            >
                                <PlusCircleIcon className="w-3 h-3" />
                                <span>Adicionar Linha</span>
                            </button>
                        </div>

                        {/* --- UNIFIED EDITABLE TABLE --- */}
                        <div className="flex-1 min-h-0 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col mb-3">
                            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                                <table className="w-full text-xs relative">
                                    <thead className="sticky top-0 z-10 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-700">
                                        <tr>
                                            <th className="px-3 py-2 text-left w-12">Pos</th>
                                            <th className="px-3 py-2 text-left">Igreja / Congregação</th>
                                            <th className="px-3 py-2 text-right w-24">Entradas</th>
                                            <th className="px-3 py-2 text-right w-24">Saídas</th>
                                            <th className="px-3 py-2 text-right w-24 bg-slate-100/50 dark:bg-slate-700/30">Saldo</th>
                                            <th className="px-3 py-2 text-center w-16">Qtd</th>
                                            <th className="px-3 py-2 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {getActiveRows().map((row, index) => {
                                            const balance = parseBrValue(row.income) - parseBrValue(row.expense);
                                            return (
                                                <tr key={row.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                                    <td className="px-3 py-1.5 text-slate-400 dark:text-slate-600 font-mono text-center font-bold">
                                                        {index + 1}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <input 
                                                            type="text" 
                                                            value={row.churchName}
                                                            onChange={(e) => handleRowChange(row.id, 'churchName', e.target.value)}
                                                            placeholder="Nome da Igreja..."
                                                            className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-violet-500 outline-none transition-colors py-1 font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-300"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <div className="relative flex items-center">
                                                            <input 
                                                                type="text"
                                                                inputMode="decimal" 
                                                                value={row.income}
                                                                onChange={(e) => handleRowChange(row.id, 'income', e.target.value)}
                                                                placeholder="0,00"
                                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-violet-500 outline-none transition-colors py-1 text-right font-mono text-emerald-600 dark:text-emerald-400 placeholder:text-slate-300 pr-6"
                                                            />
                                                            <button 
                                                                onClick={() => openCalculator(row.id, 'income', row.income)}
                                                                className="absolute right-0 p-0.5 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Adicionar valor (Soma)"
                                                            >
                                                                <PlusCircleIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <div className="relative flex items-center">
                                                            <input 
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={row.expense}
                                                                onChange={(e) => handleRowChange(row.id, 'expense', e.target.value)}
                                                                placeholder="0,00"
                                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-violet-500 outline-none transition-colors py-1 text-right font-mono text-red-500 placeholder:text-slate-300 pr-6"
                                                            />
                                                            <button 
                                                                onClick={() => openCalculator(row.id, 'expense', row.expense)}
                                                                className="absolute right-0 p-0.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Adicionar valor (Soma)"
                                                            >
                                                                <PlusCircleIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className={`px-3 py-1.5 text-right font-mono font-bold bg-slate-50/50 dark:bg-slate-700/30 ${balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>
                                                        {formatCurrency(balance, language)}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <input 
                                                            type="number" 
                                                            value={row.count}
                                                            onChange={(e) => handleRowChange(row.id, 'count', e.target.value)}
                                                            placeholder="0"
                                                            className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-violet-500 outline-none transition-colors py-1 text-center font-mono text-slate-600 dark:text-slate-400 placeholder:text-slate-300"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <button 
                                                            onClick={() => handleDeleteRow(row.id)}
                                                            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Remover linha"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* --- SHARED FOOTER: Signatures --- */}
                        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 pt-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Assinaturas (Rodapé)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {signatures.map((sig, idx) => (
                                    <div key={idx} className="relative group">
                                        <input 
                                            type="text"
                                            value={sig}
                                            onChange={(e) => handleSignatureChange(idx, e.target.value)}
                                            className="w-full p-2 text-xs text-center border-t border-slate-300 dark:border-slate-600 bg-transparent focus:border-violet-500 outline-none transition-colors font-medium text-slate-700 dark:text-slate-200"
                                            placeholder="Cargo / Nome"
                                        />
                                        <button 
                                            onClick={() => handleRemoveSignature(idx)}
                                            className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-100 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 shadow-sm"
                                        >
                                            <XMarkIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={handleAddSignature}
                                    className="h-8 border border-dashed border-slate-300 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-violet-500 hover:border-violet-500 transition-all text-[10px] font-bold uppercase tracking-wide hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                    + Adicionar
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-60">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <PresentationChartLineIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-400 dark:text-slate-500">Selecione um Modelo na Barra Superior</h3>
                    </div>
                )}
            </div>

            {/* Calculator Modal */}
            {calculator.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 animate-scale-in">
                        <form onSubmit={confirmCalculation}>
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                                            <BanknotesIcon className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Adicionar Valor</h3>
                                    </div>
                                    <button type="button" onClick={closeCalculator} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Atual</p>
                                        <p className="text-2xl font-black text-slate-700 dark:text-slate-200 font-mono">
                                            {formatCurrency(calculator.currentTotal, language)}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Valor a Somar</label>
                                        <div className="relative">
                                            <PlusCircleIcon className="w-5 h-5 text-emerald-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                            <input 
                                                type="text" 
                                                inputMode="decimal"
                                                value={valueToAdd} 
                                                onChange={(e) => setValueToAdd(e.target.value)} 
                                                className="block w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-lg font-bold text-slate-800 dark:text-white focus:border-indigo-500 focus:ring-0 outline-none transition-all placeholder:text-slate-300"
                                                placeholder="0,00"
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {valueToAdd && !isNaN(parseBrValue(valueToAdd)) && (
                                        <div className="flex justify-between items-center px-2 pt-1 text-xs font-medium">
                                            <span className="text-slate-400">Novo Total:</span>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                {formatCurrency(calculator.currentTotal + parseBrValue(valueToAdd), language)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-900/30 px-6 py-4 flex justify-end space-x-3 rounded-b-[2rem] border-t border-slate-100 dark:border-slate-700/50">
                                <button type="button" onClick={closeCalculator} className="px-5 py-2.5 text-xs font-bold rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all uppercase tracking-wide">{t('common.cancel')}</button>
                                <button type="submit" disabled={!valueToAdd} className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] rounded-full shadow-lg shadow-blue-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide">
                                    Somar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
