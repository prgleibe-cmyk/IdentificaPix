import React, { useState, useContext, useMemo, useRef, useEffect, memo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { ExportService } from '../services/ExportService';
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
    ArrowRight
} from 'lucide-react';

export const LivroCaixaView: React.FC = memo(() => {
    const { showToast } = useUI();
    const context = useContext(AppContext);
    const { user, subscription } = useAuth();

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<'all' | 'month' | 'last-month' | 'quarter' | 'year' | 'custom'>('all');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    
    // Multi-select church filter
    const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>([]);
    const [isChurchDropdownOpen, setIsChurchDropdownOpen] = useState<boolean>(false);

    // Initial filter screen state (opens before generating Livro Caixa)
    const [hasGenerated, setHasGenerated] = useState<boolean>(false);
    const [periodMode, setPeriodMode] = useState<'month_year' | 'preset' | 'custom'>('month_year');
    const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
    const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

    // Export dropdown state
    const [showExportLivroCaixa, setShowExportLivroCaixa] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

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

    // Filter reportData
    const filteredReportData = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let lastMonthYear = currentYear;
        let lastMonthIndex = currentMonth - 1;
        if (lastMonthIndex < 0) {
            lastMonthIndex = 11;
            lastMonthYear = currentYear - 1;
        }

        return reportData.filter((item: any) => {
            if (isSecondaryUser && allowedChurchIds && allowedChurchIds.length > 0) {
                const itemChurchId = item.churchId || item.church;
                if (itemChurchId && !allowedChurchIds.includes(itemChurchId)) return false;
            }

            if (selectedChurchIds.length > 0) {
                const itemChurchId = item.churchId || item.church;
                if (!selectedChurchIds.includes(itemChurchId)) return false;
            }

            if (dateRange !== 'all' && item.date) {
                const txDate = new Date(item.date + 'T00:00:00');
                const txYear = txDate.getFullYear();
                const txMonth = txDate.getMonth();

                if (dateRange === 'month' && (txYear !== currentYear || txMonth !== currentMonth)) return false;
                if (dateRange === 'last-month' && (txYear !== lastMonthYear || txMonth !== lastMonthIndex)) return false;
                if (dateRange === 'quarter') {
                    const currentQuarter = Math.floor(currentMonth / 3);
                    const txQuarter = Math.floor(txMonth / 3);
                    if (txYear !== currentYear || txQuarter !== currentQuarter) return false;
                }
                if (dateRange === 'year' && txYear !== currentYear) return false;
                if (dateRange === 'custom') {
                    if (customStartDate && item.date < customStartDate) return false;
                    if (customEndDate && item.date > customEndDate) return false;
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
    }, [reportData, selectedChurchIds, dateRange, customStartDate, customEndDate, searchTerm, isSecondaryUser, allowedChurchIds, churches]);

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

    if (!hasGenerated) {
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

        const handleLoadLivroCaixa = () => {
            if (periodMode === 'month_year') {
                const firstDay = `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`;
                const lastDayNum = new Date(filterYear, filterMonth, 0).getDate();
                const lastDay = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
                setCustomStartDate(firstDay);
                setCustomEndDate(lastDay);
                setDateRange('custom');
            }
            setHasGenerated(true);
        };

        return (
            <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full animate-fade-in pb-8">
                {/* Header Banner */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl text-white shadow-lg shadow-orange-500/20">
                            <BookOpen className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                                Livro Caixa - Filtro de Emissão
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                Selecione a igreja e o período desejado para carregar o extrato analítico do Livro Caixa.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing || isHydratingFromCloud}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        title="Recarregar banco de dados"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isHydratingFromCloud ? 'animate-spin text-orange-500' : ''}`} />
                        <span>Recarregar Dados</span>
                    </button>
                </div>

                {/* Section 1: Seleção de Igreja */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
                        <Building2 className="w-5 h-5 text-orange-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                            1. Selecione a Igreja / Congregação
                        </h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedChurchIds([])}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                selectedChurchIds.length === 0
                                    ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                            }`}
                        >
                            Todas as Igrejas
                        </button>

                        {churches.map((c: any) => {
                            const isSelected = selectedChurchIds.includes(c.id);
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => toggleChurchSelection(c.id)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                                    }`}
                                >
                                    {c.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Section 2: Período e Mês do Livro Caixa */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
                        <Calendar className="w-5 h-5 text-orange-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                            2. Período e Mês do Livro Caixa
                        </h3>
                    </div>

                    <div className="space-y-4">
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full max-w-md">
                            <button
                                type="button"
                                onClick={() => setPeriodMode('month_year')}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                    periodMode === 'month_year'
                                        ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-white shadow-xs'
                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                }`}
                            >
                                Mês e Ano
                            </button>
                            <button
                                type="button"
                                onClick={() => setPeriodMode('preset')}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                    periodMode === 'preset'
                                        ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-white shadow-xs'
                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                }`}
                            >
                                Período Rápido
                            </button>
                            <button
                                type="button"
                                onClick={() => setPeriodMode('custom')}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                    periodMode === 'custom'
                                        ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-white shadow-xs'
                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                }`}
                            >
                                Intervalo de Datas
                            </button>
                        </div>

                        {periodMode === 'month_year' && (
                            <div className="grid grid-cols-2 gap-4 max-w-lg">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mês</label>
                                    <select
                                        value={filterMonth}
                                        onChange={e => setFilterMonth(Number(e.target.value))}
                                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-orange-500"
                                    >
                                        {monthsList.map(m => (
                                            <option key={m.val} value={m.val}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ano</label>
                                    <select
                                        value={filterYear}
                                        onChange={e => setFilterYear(Number(e.target.value))}
                                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-orange-500"
                                    >
                                        {yearsList.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {periodMode === 'preset' && (
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { id: 'month', label: 'Este Mês' },
                                    { id: 'last-month', label: 'Mês Anterior' },
                                    { id: 'quarter', label: 'Este Trimestre' },
                                    { id: 'year', label: 'Este Ano' },
                                    { id: 'all', label: 'Todo o Período' }
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setDateRange(p.id as any)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            dateRange === p.id && periodMode === 'preset'
                                                ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {periodMode === 'custom' && (
                            <div className="flex items-center gap-3 max-w-lg">
                                <div className="flex-1 flex flex-col gap-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data Inicial</label>
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={e => {
                                            setCustomStartDate(e.target.value);
                                            setDateRange('custom');
                                        }}
                                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                                <span className="text-slate-400 font-bold text-xs pt-4">até</span>
                                <div className="flex-1 flex flex-col gap-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data Final</label>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={e => {
                                            setCustomEndDate(e.target.value);
                                            setDateRange('custom');
                                        }}
                                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Section 3: Busca Opcional */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-6 rounded-3xl shadow-sm space-y-3">
                    <div className="flex items-center gap-2 pb-1">
                        <Search className="w-4 h-4 text-orange-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                            3. Filtro Adicional por Busca / Descrição (Opcional)
                        </h3>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por descrição, histórico, nome do contribuinte ou categoria..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                </div>

                {/* Big Action Button */}
                <div className="flex justify-center pt-2">
                    <button
                        type="button"
                        onClick={handleLoadLivroCaixa}
                        className="w-full max-w-md py-4 px-8 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl shadow-orange-500/20 hover:-translate-y-0.5 active:scale-98 transition-all flex items-center justify-center gap-3 cursor-pointer"
                    >
                        <Sparkles className="w-5 h-5" />
                        <span>Carregar Livro Caixa</span>
                        <ArrowRight className="w-5 h-5 ml-1" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full h-full flex flex-col animate-fade-in pb-4">
            {/* Header Card */}
            <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex-shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setHasGenerated(false)}
                            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-orange-500 hover:text-white text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-xs border border-slate-200/60 dark:border-slate-700 group shrink-0"
                            title="Voltar e alterar igreja ou período"
                        >
                            <RotateCcw className="w-4 h-4 text-orange-500 group-hover:text-white transition-colors" />
                            <span>← Alterar Filtros</span>
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl text-white shadow-md shadow-orange-500/20">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                                    Livro Caixa (Extrato Analítico Cronológico)
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Detalhamento individualizado de todas as entradas e saídas financeiras da igreja.
                                </p>
                            </div>
                        </div>
                    </div>
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

                        {/* Date Range Filter */}
                        <div className="flex items-center gap-1.5">
                            <select
                                value={dateRange}
                                onChange={(e: any) => setDateRange(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500"
                            >
                                <option value="all">Todo o Período</option>
                                <option value="month">Este Mês</option>
                                <option value="last-month">Mês Anterior</option>
                                <option value="quarter">Este Trimestre</option>
                                <option value="year">Este Ano</option>
                                <option value="custom">Período Personalizado / Agenda</option>
                            </select>

                            {dateRange === 'custom' && (
                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs animate-fade-in">
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={e => setCustomStartDate(e.target.value)}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
                                        title="Data Inicial"
                                    />
                                    <span className="text-slate-400 text-xs font-bold">até</span>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={e => setCustomEndDate(e.target.value)}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
                                        title="Data Final"
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
        </div>
    );
});
