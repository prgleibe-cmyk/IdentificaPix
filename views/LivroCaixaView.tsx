import React, { useState, useContext, useMemo, useRef, useEffect, memo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { ExportService } from '../services/ExportService';
import { ChurchClosingModal } from '../components/modals/ChurchClosingModal';
import { 
    BookOpen, 
    Building2, 
    Search, 
    Download, 
    Printer, 
    RefreshCw, 
    ChevronDown, 
    ArrowUpRight, 
    ArrowDownRight, 
    DollarSign, 
    FileText, 
    FileSpreadsheet, 
    FileCode,
    Filter,
    Calendar,
    Sparkles,
    RotateCcw,
    CheckCircle2,
    ArrowRight,
    Check
} from 'lucide-react';

export const LivroCaixaView: React.FC = memo(() => {
    const { showToast } = useUI();
    const context = useContext(AppContext);
    const { user, subscription } = useAuth();

    const now = useMemo(() => new Date(), []);
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectionMode, setSelectionMode] = useState<'month' | 'dates'>('month');
    const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');

    const monthsList = [
        { val: 1, name: 'Janeiro' },
        { val: 2, name: 'Fevereiro' },
        { val: 3, name: 'Março' },
        { val: 4, name: 'Abril' },
        { val: 5, name: 'Maio' },
        { val: 6, name: 'Junho' },
        { val: 7, name: 'Julho' },
        { val: 8, name: 'Agosto' },
        { val: 9, name: 'Setembro' },
        { val: 10, name: 'Outubro' },
        { val: 11, name: 'Novembro' },
        { val: 12, name: 'Dezembro' }
    ];

    const yearsList = [2027, 2026, 2025, 2024];
    
    // Multi-select church filter
    const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>([]);
    const [isChurchDropdownOpen, setIsChurchDropdownOpen] = useState<boolean>(false);

    // Export dropdown state
    const [showExportLivroCaixa, setShowExportLivroCaixa] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [isClosingModalOpen, setIsClosingModalOpen] = useState<boolean>(false);

    const churchDropdownRef = useRef<HTMLDivElement>(null);
    const exportLivroCaixaRef = useRef<HTMLDivElement>(null);

    const isSecondaryUser = (subscription?.ownerId && subscription.ownerId !== user?.id) &&
        subscription?.role !== 'owner' &&
        subscription?.role !== 'admin' &&
        subscription?.role !== 'principal';

    const perms = (subscription?.permissions || {}) as Record<string, any>;
    const canDownload = !isSecondaryUser || (perms.baixar_arquivo !== false && perms.downloadFile !== false);
    const canPrint = !isSecondaryUser || (perms.imprimir !== false && perms.printReport !== false);

    const allowedChurchIds = useMemo(() => {
        if (!isSecondaryUser) return null;
        return subscription?.congregationIds || [];
    }, [isSecondaryUser, subscription?.congregationIds]);

    const churches = useMemo(() => {
        const raw = context?.churches || [];
        if (!isSecondaryUser || !allowedChurchIds || allowedChurchIds.length === 0) return raw;
        return raw.filter((c: any) => allowedChurchIds.includes(c.id));
    }, [context?.churches, isSecondaryUser, allowedChurchIds]);

    const reportData = context?.reportData || [];
    const isHydratingFromCloud = context?.isHydratingFromCloud || context?.isHydrating || false;

    // Click outside listener
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (churchDropdownRef.current && !churchDropdownRef.current.contains(event.target as Node)) {
                setIsChurchDropdownOpen(false);
            }
            if (exportLivroCaixaRef.current && !exportLivroCaixaRef.current.contains(event.target as Node)) {
                setShowExportLivroCaixa(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatBRL = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    const formatDateBRL = (dateStr: string) => {
        if (!dateStr) return '-';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    const getChurchName = (cId: string) => {
        return churches.find((c: any) => c.id === cId)?.name || 'Igreja Sede';
    };

    const toggleChurchSelection = (churchId: string) => {
        if (churchId === 'ALL') {
            setSelectedChurchIds([]);
            return;
        }
        setSelectedChurchIds(prev => {
            if (prev.includes(churchId)) {
                return prev.filter(id => id !== churchId);
            } else {
                return [...prev, churchId];
            }
        });
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            if (typeof context?.triggerSync === 'function') {
                context.triggerSync();
            }
            if (typeof context?.hydrate === 'function') {
                await context.hydrate();
            }
            showToast('Livro Caixa recarregado com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao recarregar Livro Caixa:', err);
            showToast('Erro ao recarregar os dados.', 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto-initialize custom dates when switching to period mode
    useEffect(() => {
        if (selectionMode === 'dates') {
            if (!customStartDate) {
                const start = context?.searchFilters?.dateRange?.start || `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
                setCustomStartDate(start);
            }
            if (!customEndDate) {
                const todayIso = new Date().toISOString().split('T')[0];
                const end = context?.searchFilters?.dateRange?.end || todayIso;
                setCustomEndDate(end);
            }
        }
    }, [selectionMode, customStartDate, customEndDate, selectedYear, selectedMonth, context?.searchFilters]);

    // Filter reportData
    const filteredReportData = useMemo(() => {
        return reportData.filter((item: any) => {
            if (isSecondaryUser && allowedChurchIds && allowedChurchIds.length > 0) {
                const itemChurchId = item.churchId || item.church;
                if (itemChurchId && !allowedChurchIds.includes(itemChurchId)) return false;
            }

            if (selectedChurchIds.length > 0) {
                const itemChurchId = item.churchId;
                const itemChurchName = item.church;
                const matchesAny = selectedChurchIds.some(cId => {
                    if (itemChurchId && itemChurchId === cId) return true;
                    const chObj = churches.find((c: any) => c.id === cId);
                    return chObj && (itemChurchName === chObj.name || itemChurchId === chObj.id);
                });
                if (!matchesAny) return false;
            }

            if (item.date) {
                const itemDateIso = item.date.includes('T') ? item.date.split('T')[0] : item.date;
                if (selectionMode === 'month') {
                    const parts = itemDateIso.split('-');
                    if (parts.length === 3) {
                        const txYear = Number(parts[0]);
                        const txMonth = Number(parts[1]);
                        if (txYear !== selectedYear || txMonth !== selectedMonth) return false;
                    }
                } else if (selectionMode === 'dates') {
                    if (customStartDate && itemDateIso < customStartDate) return false;
                    if (customEndDate && itemDateIso > customEndDate) return false;
                }
            }

            if (searchTerm.trim()) {
                const query = searchTerm.toLowerCase();
                const textToSearch = [
                    item.desc, item.description, item.historico,
                    item.payer, item.contribuinte, item.nome,
                    item.category, item.categoria,
                    getChurchName(item.churchId)
                ].filter(Boolean).join(' ').toLowerCase();

                if (!textToSearch.includes(query)) return false;
            }

            return true;
        });
    }, [reportData, selectedChurchIds, selectionMode, selectedMonth, selectedYear, customStartDate, customEndDate, searchTerm, isSecondaryUser, allowedChurchIds, churches]);

    const financialTotals = useMemo(() => {
        let income = 0;
        let expenses = 0;

        filteredReportData.forEach((tx: any) => {
            const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);
            const isExp = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));

            if (isExp) {
                expenses += amt;
            } else {
                income += amt;
            }
        });

        return {
            income,
            expenses,
            balance: income - expenses,
            totalTransactions: filteredReportData.length
        };
    }, [filteredReportData]);

    // Detalhado RESUMO financeiro do Livro Caixa
    const summaryBreakdown = useMemo(() => {
        let saldoAnterior = 0;
        let entradasDinheiro = 0;
        let entradasPix = 0;
        let entradasOutras = 0;
        let transfRecebidas = 0;

        let saidasDinheiro = 0;
        let saidasPix = 0;
        let saidasBoletoFaturas = 0;
        let saidasOutras = 0;
        let transfEnviadas = 0;

        // Cálculo do Saldo Anterior (se houver data de início)
        if (selectionMode === 'dates' && customStartDate) {
            reportData.forEach((item: any) => {
                const itemDate = item.date ? (item.date.includes('T') ? item.date.split('T')[0] : item.date) : '';
                if (itemDate && itemDate < customStartDate) {
                    const amt = Math.abs(Number(item.amount) || Number(item.val) || 0);
                    const isExp = item.type === 'expense' || Number(item.amount) < 0 || (item.category && item.category.toLowerCase().includes('saida'));
                    if (isExp) {
                        saldoAnterior -= amt;
                    } else {
                        saldoAnterior += amt;
                    }
                }
            });
        }

        filteredReportData.forEach((item: any) => {
            const amt = Math.abs(Number(item.amount) || Number(item.val) || 0);
            const pm = (item.paymentMethod || item.forma || '').toString().toUpperCase();
            const cat = (item.category || item.categoria || '').toString().toUpperCase();
            const desc = (item.desc || item.description || item.historico || '').toString().toUpperCase();
            const isExp = item.type === 'expense' || Number(item.amount) < 0 || cat.includes('SAIDA') || cat.includes('SAÍDA');

            const isTransf = pm.includes('TRANSFER') || pm.includes('TED') || pm.includes('DOC') || cat.includes('TRANSFER') || desc.includes('TRANSFER');

            if (isExp) {
                if (isTransf) {
                    transfEnviadas += amt;
                } else if (pm.includes('DINHEIRO') || pm.includes('ESPÉCIE') || pm.includes('ESPECIE')) {
                    saidasDinheiro += amt;
                } else if (pm.includes('PIX')) {
                    saidasPix += amt;
                } else if (pm.includes('BOLETO') || pm.includes('FATURA') || pm.includes('CARTÃO') || pm.includes('CARTAO')) {
                    saidasBoletoFaturas += amt;
                } else {
                    saidasOutras += amt;
                }
            } else {
                if (isTransf) {
                    transfRecebidas += amt;
                } else if (pm.includes('DINHEIRO') || pm.includes('ESPÉCIE') || pm.includes('ESPECIE')) {
                    entradasDinheiro += amt;
                } else if (pm.includes('PIX')) {
                    entradasPix += amt;
                } else {
                    entradasOutras += amt;
                }
            }
        });

        const totalEntradas = entradasDinheiro + entradasPix + entradasOutras;
        const totalSaidas = saidasDinheiro + saidasPix + saidasBoletoFaturas + saidasOutras;

        const totalEntradasPlusTransf = totalEntradas + transfRecebidas;
        const totalSaidasPlusTransf = totalSaidas + transfEnviadas;

        const saldoFinal = saldoAnterior + totalEntradasPlusTransf - totalSaidasPlusTransf;

        return {
            saldoAnterior,
            entradasDinheiro,
            entradasPix,
            totalEntradas,
            saidasDinheiro,
            saidasPix,
            saidasBoletoFaturas,
            totalSaidas,
            transfRecebidas,
            transfEnviadas,
            totalEntradasPlusTransf,
            totalSaidasPlusTransf,
            saldoFinal
        };
    }, [reportData, filteredReportData, selectionMode, customStartDate]);

    const handleExportLivroCaixa = (format: 'pdf' | 'excel' | 'csv' | 'ofx') => {
        setShowExportLivroCaixa(false);
        if (!canDownload) {
            showToast('Você não tem permissão para baixar arquivos ou relatórios.', 'error');
            return;
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        
        if (format === 'pdf') {
            ExportService.downloadLivroCaixaPdf(filteredReportData, churches, 'Livro Caixa - Extrato Analítico', `livro_caixa_${dateStr}.pdf`, selectedChurchIds[0]);
        } else if (format === 'excel') {
            ExportService.downloadLivroCaixaExcel(filteredReportData, churches, `livro_caixa_${dateStr}.xlsx`);
        } else if (format === 'csv') {
            ExportService.downloadLivroCaixaCsv(filteredReportData, churches, `livro_caixa_${dateStr}.csv`);
        } else if (format === 'ofx') {
            ExportService.downloadLivroCaixaOfx(filteredReportData, churches, `livro_caixa_${dateStr}.ofx`);
        }
        showToast(`Livro Caixa exportado em formato ${format.toUpperCase()} com sucesso!`, 'success');
    };

    const handlePrint = () => {
        if (!canPrint) {
            showToast('Você não tem permissão para imprimir relatórios.', 'error');
            return;
        }
        window.print();
    };

    return (
        <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full h-full flex flex-col animate-fade-in pb-4">
            {/* Header Card */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl text-white shadow-md shadow-orange-500/20 shrink-0">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                                Livro Caixa
                            </h1>
                            <p className="text-xs text-slate-400">
                                Detalhamento individualizado de todas as entradas e saídas financeiras da igreja.
                            </p>
                        </div>
                    </div>

                    {!isSecondaryUser && (
                        <button
                            type="button"
                            onClick={() => setIsClosingModalOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-xl shadow-xs hover:opacity-95 transition-all tracking-wider uppercase cursor-pointer border border-orange-400/30 active:scale-95 shrink-0 self-start sm:self-auto"
                            title="Realizar Fechamento & Transferir Saldo"
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>Fechamento</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4 md:p-6 shadow-sm flex-1 min-h-0 flex flex-col space-y-4 overflow-y-auto custom-scrollbar">
                {/* Control & Filter Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-orange-500" />
                            Lançamentos de Caixa
                        </h3>
                        <p className="text-xs text-slate-400">Histórico de entradas e saídas registradas.</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                        {/* Search */}
                        <div className="relative flex-1 md:w-52">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Buscar no Livro Caixa..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-3 py-1.5 w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500"
                            />
                        </div>

                        {/* Date Range Filter Box (Mês / Período) */}
                        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs shadow-xs">
                            <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 p-0.5 rounded-lg font-bold shadow-xs border border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode('month')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        selectionMode === 'month'
                                            ? 'bg-orange-500 text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    Mês
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode('dates')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        selectionMode === 'dates'
                                            ? 'bg-orange-500 text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    Período
                                </button>
                            </div>

                            {selectionMode === 'month' ? (
                                <div className="flex items-center gap-1">
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white px-2.5 py-1 rounded-lg text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
                                    >
                                        {monthsList.map(m => (
                                            <option key={m.val} value={m.val}>{m.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white px-2.5 py-1 rounded-lg text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
                                    >
                                        {yearsList.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-white px-2 py-1 rounded-lg text-xs focus:outline-none focus:border-orange-500"
                                    />
                                    <span className="text-slate-400 font-bold text-[10px] uppercase">até</span>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-white px-2 py-1 rounded-lg text-xs focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Multi-Select Church Filter */}
                        <div className="relative" ref={churchDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsChurchDropdownOpen(!isChurchDropdownOpen)}
                                className="px-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                            >
                                <Building2 className="w-3.5 h-3.5 text-orange-500" />
                                <span>
                                    {selectedChurchIds.length === 0 
                                        ? 'Todas as Igrejas' 
                                        : selectedChurchIds.length === 1 
                                        ? getChurchName(selectedChurchIds[0]) 
                                        : `${selectedChurchIds.length} Igrejas Selecionadas`}
                                </span>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            </button>

                            {isChurchDropdownOpen && (
                                <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 p-3 z-50 text-xs space-y-2 animate-scale-in">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/5">
                                        <span className="font-bold text-slate-800 dark:text-white uppercase text-[10px]">Filtrar por Igrejas</span>
                                        {selectedChurchIds.length > 0 && (
                                            <button 
                                                onClick={() => setSelectedChurchIds([])}
                                                className="text-[10px] text-orange-600 dark:text-orange-400 font-bold hover:underline"
                                            >
                                                Selecionar Todas
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pt-1">
                                        <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedChurchIds.length === 0}
                                                onChange={() => setSelectedChurchIds([])}
                                                className="accent-orange-500 rounded"
                                            />
                                            <span className="font-bold text-slate-800 dark:text-white">Todas as Igrejas</span>
                                        </label>

                                        {churches.map((c: any) => {
                                            const isChecked = selectedChurchIds.includes(c.id);
                                            return (
                                                <label key={c.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleChurchSelection(c.id)}
                                                        className="accent-orange-500 rounded"
                                                    />
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{c.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Recarregar Button */}
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing || isHydratingFromCloud}
                            className="px-3 py-1.5 bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Recarregar dados do Livro Caixa"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isHydratingFromCloud ? 'animate-spin text-orange-500' : ''}`} />
                            <span className="hidden sm:inline text-xs font-semibold">Recarregar</span>
                        </button>

                        {/* Export & Print Menu */}
                        <div className="relative" ref={exportLivroCaixaRef}>
                            <button
                                onClick={() => setShowExportLivroCaixa(!showExportLivroCaixa)}
                                className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Exportar Livro Caixa</span>
                                <ChevronDown className="w-3 h-3 ml-0.5" />
                            </button>

                            {showExportLivroCaixa && (
                                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 py-2 z-50 text-xs text-slate-700 dark:text-slate-200 animate-scale-in">
                                    <div className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">Formatos Livro Caixa</div>
                                    <button
                                        onClick={() => handleExportLivroCaixa('pdf')}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                    >
                                        <FileText className="w-4 h-4 text-red-500" />
                                        <span>Baixar como PDF</span>
                                    </button>
                                    <button
                                        onClick={() => handleExportLivroCaixa('excel')}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                    >
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                                        <span>Baixar como Excel (.xlsx)</span>
                                    </button>
                                    <button
                                        onClick={() => handleExportLivroCaixa('csv')}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                    >
                                        <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                                        <span>Baixar como CSV</span>
                                    </button>
                                    <button
                                        onClick={() => handleExportLivroCaixa('ofx')}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-semibold transition-colors"
                                    >
                                        <FileCode className="w-4 h-4 text-purple-500" />
                                        <span>Baixar como OFX (ERP/Contábil)</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handlePrint}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Imprimir Relatório"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir</span>
                        </button>
                    </div>
                </div>

                {/* Financial Totals Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-emerald-200/60 dark:border-emerald-950 bg-emerald-50/40 dark:bg-emerald-950/20 flex justify-between items-center">
                        <div>
                            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400 block">Entradas Totais</span>
                            <span className="text-xl font-mono font-black text-emerald-700 dark:text-emerald-300">{formatBRL(financialTotals.income)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <ArrowUpRight className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="p-4 rounded-xl border border-rose-200/60 dark:border-rose-950 bg-rose-50/40 dark:bg-rose-950/20 flex justify-between items-center">
                        <div>
                            <span className="text-[10px] uppercase font-black tracking-wider text-rose-600 dark:text-rose-400 block">Saídas Totais</span>
                            <span className="text-xl font-mono font-black text-rose-700 dark:text-rose-300">{formatBRL(financialTotals.expenses)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            <ArrowDownRight className="w-6 h-6" />
                        </div>
                    </div>

                    <div className={`p-4 rounded-xl border ${financialTotals.balance >= 0 ? 'border-blue-200/60 dark:border-blue-950 bg-blue-50/40 dark:bg-blue-950/20' : 'border-amber-200/60 dark:border-amber-950 bg-amber-50/40 dark:bg-amber-950/20'} flex justify-between items-center`}>
                        <div>
                            <span className="text-[10px] uppercase font-black tracking-wider text-slate-600 dark:text-slate-400 block">Saldo Operacional do Caixa</span>
                            <span className={`text-xl font-mono font-black ${financialTotals.balance >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-300'}`}>{formatBRL(financialTotals.balance)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400">
                            <DollarSign className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                {/* RESUMO DE CAIXA DETALHADO */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-4 bg-brand-orange rounded-full"></div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">RESUMO</h3>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">Demonstrativo Analítico do Caixa</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
                        {/* Bloco Entradas & Créditos */}
                        <div className="space-y-2 bg-emerald-50/30 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                            <div className="font-black text-emerald-800 dark:text-emerald-400 uppercase text-[10px] tracking-wider mb-2 border-b border-emerald-200/60 dark:border-emerald-800/40 pb-1.5">Entradas e Créditos</div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Total de entradas em dinheiro:</span>
                                <strong className="font-mono text-emerald-600">{formatBRL(summaryBreakdown.entradasDinheiro)}</strong>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Total de entradas em Pix:</span>
                                <strong className="font-mono text-emerald-600">{formatBRL(summaryBreakdown.entradasPix)}</strong>
                            </div>
                            <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 pt-1 border-t border-emerald-200/40">
                                <span>Total de entradas:</span>
                                <strong className="font-mono text-emerald-700">{formatBRL(summaryBreakdown.totalEntradas)}</strong>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300 pt-1">
                                <span>Total de transf. recebidas:</span>
                                <strong className="font-mono text-emerald-600">{formatBRL(summaryBreakdown.transfRecebidas)}</strong>
                            </div>
                            <div className="flex justify-between font-extrabold text-emerald-800 dark:text-emerald-300 pt-2 border-t border-emerald-200/80 dark:border-emerald-800/60 text-[11px]">
                                <span>Total de Entradas + Transferência recebidas:</span>
                                <span className="font-mono">{formatBRL(summaryBreakdown.totalEntradasPlusTransf)}</span>
                            </div>
                        </div>

                        {/* Bloco Saídas & Débitos */}
                        <div className="space-y-2 bg-rose-50/30 dark:bg-rose-950/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30">
                            <div className="font-black text-rose-800 dark:text-rose-400 uppercase text-[10px] tracking-wider mb-2 border-b border-rose-200/60 dark:border-rose-800/40 pb-1.5">Saídas e Débitos</div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Total de saídas em dinheiro:</span>
                                <strong className="font-mono text-rose-600">{formatBRL(summaryBreakdown.saidasDinheiro)}</strong>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Total de saídas em Pix:</span>
                                <strong className="font-mono text-rose-600">{formatBRL(summaryBreakdown.saidasPix)}</strong>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Total de saídas boleto, faturas:</span>
                                <strong className="font-mono text-rose-600">{formatBRL(summaryBreakdown.saidasBoletoFaturas)}</strong>
                            </div>
                            <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 pt-1 border-t border-rose-200/40">
                                <span>Total de saídas:</span>
                                <strong className="font-mono text-rose-700">{formatBRL(summaryBreakdown.totalSaidas)}</strong>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300 pt-1">
                                <span>Total de transf. enviadas:</span>
                                <strong className="font-mono text-rose-600">{formatBRL(summaryBreakdown.transfEnviadas)}</strong>
                            </div>
                            <div className="flex justify-between font-extrabold text-rose-800 dark:text-rose-300 pt-2 border-t border-rose-200/80 dark:border-rose-800/60 text-[11px]">
                                <span>Total de saídas + Transferência enviadas:</span>
                                <span className="font-mono">{formatBRL(summaryBreakdown.totalSaidasPlusTransf)}</span>
                            </div>
                        </div>

                        {/* Bloco Saldos */}
                        <div className="space-y-3 bg-amber-50/40 dark:bg-amber-950/10 p-4 rounded-xl border border-amber-200/60 dark:border-amber-900/30 flex flex-col justify-between">
                            <div>
                                <div className="font-black text-amber-800 dark:text-amber-400 uppercase text-[10px] tracking-wider mb-2 border-b border-amber-200/60 dark:border-amber-800/40 pb-1.5">Saldos do Período</div>
                                <div className="flex justify-between text-slate-700 dark:text-slate-300 py-1">
                                    <span className="font-bold">Saldo Anterior:</span>
                                    <strong className="font-mono">{formatBRL(summaryBreakdown.saldoAnterior)}</strong>
                                </div>
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-300/80 dark:border-amber-800 shadow-xs flex justify-between items-center">
                                <span className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-tight">Saldo final:</span>
                                <span className={`text-base font-black font-mono ${summaryBreakdown.saldoFinal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {formatBRL(summaryBreakdown.saldoFinal)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Livro Caixa Table */}
                <div className="flex-1 min-h-[350px] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400">
                        <span>Extrato Analítico ({financialTotals.totalTransactions} registros)</span>
                        <span>IgGestor Módulo Financeiro</span>
                    </div>

                    <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 uppercase font-black text-[10px] tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3">Data</th>
                                    <th className="px-4 py-3">Descrição / Histórico</th>
                                    <th className="px-4 py-3">Contribuinte / Favorecido</th>
                                    <th className="px-4 py-3">Categoria</th>
                                    <th className="px-4 py-3">Igreja</th>
                                    <th className="px-4 py-3 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {filteredReportData.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-slate-400 italic">
                                            Nenhum lançamento encontrado no Livro Caixa para os filtros selecionados.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredReportData.map((tx: any, idx: number) => {
                                        const isExpense = tx.type === 'expense' || Number(tx.amount) < 0 || (tx.category && tx.category.toLowerCase().includes('saida'));
                                        const amt = Math.abs(Number(tx.amount) || Number(tx.val) || 0);

                                        return (
                                            <tr key={tx.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                                                    {formatDateBRL(tx.date)}
                                                </td>
                                                <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate">
                                                    {tx.desc || tx.description || tx.historico || 'Lançamento de Caixa'}
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                                                    {tx.payer || tx.contribuinte || tx.nome || '-'}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                        {tx.category || tx.categoria || 'Geral'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-[11px]">
                                                    {tx.church || getChurchName(tx.churchId)}
                                                </td>
                                                <td className={`px-4 py-2.5 text-right font-mono font-bold whitespace-nowrap ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {isExpense ? `- ${formatBRL(amt)}` : `+ ${formatBRL(amt)}`}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ChurchClosingModal
                isOpen={isClosingModalOpen}
                onClose={() => setIsClosingModalOpen(false)}
                currentChurchId={selectedChurchIds.length === 1 ? selectedChurchIds[0] : null}
            />
        </div>
    );
});
