import React, { useContext, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { EditableReportTable } from '../components/reports/EditableReportTable';
import { ChartBarIcon, PlusCircleIcon } from '../components/Icons';
import { useReportsController } from '../hooks/useReportsController';
import { Calendar, Check, Building2, BookOpen } from 'lucide-react';
import { MatchResult, Transaction, ReconciliationStatus } from '../types';
import { SplitTransactionModal } from '../components/modals/SplitTransactionModal';

// Sub-componentes modulares
import { CategoryPills } from '../components/reports/CategoryPills';
import { ReportToolbar } from '../components/reports/ReportToolbar';
import { ChurchChipsList } from '../components/reports/ChurchChipsList';
import { BankChipsList } from '../components/reports/BankChipsList';
import { StatsStrip } from '../components/reports/StatsStrip';
import { ContributorsReportSection } from '../components/reports/ContributorsReportSection';

const formatDateBRL = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const getDatesFromMonthYear = (month: number, year: number) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start: startDate, end: endDate };
};

/**
 * REPORTS VIEW (V3 - MODULAR)
 * Orquestrador principal da visão de relatórios e conciliação.
 */
export const ReportsView: React.FC = () => {
    const ctrl = useReportsController();
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();
    const { loadingAiId, setMatchResults, setBulkIdentificationTxs, bulkIdentificationTxs, churches } = useContext(AppContext);
    const { subscription, user } = useAuth();

    const handleManualLaunch = (type: 'entrada' | 'saida' = 'entrada') => {
        const existingGhost = bulkIdentificationTxs?.find((tx: any) => tx.id.startsWith('ghost-manual-'));
        if (existingGhost) {
            setActiveView('novo_lancamento');
            return;
        }

        const amountFloat = 0;
        const description = type === 'entrada' ? 'Lançamento Manual Entrada' : 'Lançamento Manual Saída';

        const manualTxId = `ghost-manual-${Date.now()}`;
        const newTx: Transaction = {
            id: manualTxId,
            date: new Date().toISOString().split('T')[0],
            description: description,
            rawDescription: description,
            amount: amountFloat,
            isConfirmed: false
        };

        const defaultChurch = churches[0] || { id: '', name: 'Sem Igreja', address: '', logoUrl: '' };

        const newMatchResult: MatchResult = {
            transaction: newTx,
            contributor: null,
            status: ReconciliationStatus.PENDING,
            church: defaultChurch,
            isConfirmed: false,
            updatedAt: new Date().toISOString()
        };

        if (setMatchResults) setMatchResults((prev: any) => [...prev, newMatchResult]);
        if (setBulkIdentificationTxs) setBulkIdentificationTxs([newTx]);
        setActiveView('novo_lancamento');
    };

    const isSecondaryUser = (subscription?.ownerId && subscription.ownerId !== user?.id) &&
        subscription?.role !== 'owner' &&
        subscription?.role !== 'admin' &&
        subscription?.role !== 'principal';

    // Estados locais para controle do período
    const [selectionMode, setSelectionMode] = useState<'month' | 'dates'>('month');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [customStart, setCustomStart] = useState<string>('');
    const [customEnd, setCustomEnd] = useState<string>('');
    const [splitRow, setSplitRow] = useState<MatchResult | null>(null);

    const startSelected = ctrl.searchFilters?.dateRange?.start;
    const endSelected = ctrl.searchFilters?.dateRange?.end;

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

    // Auto-inicializar com o mês atual se nenhum período estiver definido
    React.useEffect(() => {
        if (!startSelected || !endSelected) {
            const now = new Date();
            const m = now.getMonth() + 1;
            const y = now.getFullYear();
            setSelectedMonth(m);
            setSelectedYear(y);
            const { start, end } = getDatesFromMonthYear(m, y);
            if (ctrl.setSearchFilters) {
                ctrl.setSearchFilters((prev: any) => ({
                    ...prev,
                    dateRange: { start, end }
                }));
            }
        } else {
            setCustomStart(startSelected);
            setCustomEnd(endSelected);
        }
    }, [startSelected, endSelected]);

    const handleMonthYearSelect = (month: number, year: number) => {
        setSelectedMonth(month);
        setSelectedYear(year);
        const { start, end } = getDatesFromMonthYear(month, year);
        if (ctrl.setIsLoading) ctrl.setIsLoading(true);
        if (ctrl.setSearchFilters) {
            ctrl.setSearchFilters((prev: any) => ({
                ...prev,
                dateRange: { start, end }
            }));
        }
    };

    const handleApplyCustomDates = () => {
        if (!customStart || !customEnd) {
            alert('Por favor, escolha as datas de início e fim.');
            return;
        }
        if (ctrl.setIsLoading) ctrl.setIsLoading(true);
        if (ctrl.setSearchFilters) {
            ctrl.setSearchFilters((prev: any) => ({
                ...prev,
                dateRange: { start: customStart, end: customEnd }
            }));
        }
    };

    if (ctrl.isHydrating || ctrl.isLoading || ctrl.isSyncing || !ctrl.reportPreviewData) {
        return (
            <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full h-full flex flex-col animate-fade-in">
                <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                            <Calendar className="w-5 h-5 text-orange-500" />
                            Financeiro
                        </h1>
                        <p className="text-xs text-slate-400">
                            Sincronizando e carregando lançamentos do período selecionado...
                        </p>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-8 rounded-2xl shadow-sm min-h-[400px] gap-4">
                    <div className="relative flex items-center justify-center">
                        <div className="w-16 h-16 border-4 border-orange-200 dark:border-orange-950/40 border-t-orange-500 rounded-full animate-spin" />
                        <Calendar className="w-6 h-6 text-orange-500 absolute" />
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="text-base font-black text-slate-800 dark:text-white">Carregando dados do relatório...</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Aguarde enquanto os lançamentos do período selecionado são processados.</p>
                    </div>
                </div>
            </div>
        );
    }

    const reportDisplayName = ctrl.activeCategory === 'general' ? 'Todas as Entradas (Completo)' : 
        ctrl.activeCategory === 'churches' ? ctrl.churchList.find(c => c.id === ctrl.selectedReportId)?.name || 'Selecione uma Igreja' :
        ctrl.activeCategory === 'unidentified' ? 'Transações Pendentes' :
        ctrl.activeCategory === 'contributors' ? 'Relatório de Cadastros / Contribuintes' : 'Saídas e Despesas';

    return (
        <div className="flex flex-col h-full animate-fade-in gap-2 pb-2 px-1">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <h2 className="text-lg font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('reports.title')}</h2>
                    <div className="overflow-x-auto pb-1 -mx-1 px-1 custom-scrollbar scrollbar-hide">
                        <CategoryPills activeCategory={ctrl.activeCategory} onCategoryChange={ctrl.setActiveCategory} counts={ctrl.counts} role={subscription.role} />
                    </div>
                </div>
                {ctrl.activeCategory !== 'contributors' && (
                    <ReportToolbar 
                        onAiClick={ctrl.runAiAutoIdentification} 
                        onUpdateSource={() => ctrl.setActiveView('upload')}
                        onDownload={ctrl.handleDownload} 
                        onDownloadExcel={ctrl.handleDownloadExcel}
                        onDownloadPdf={ctrl.handleDownloadPdf}
                        onDownloadOfx={ctrl.handleDownloadOfx}
                        onPrint={ctrl.handlePrint}
                        onSaveReport={ctrl.handleSaveReport}
                        hasActiveReport={!!ctrl.activeReportId}
                        role={subscription.role}
                    />
                )}
            </div>

            {ctrl.activeCategory === 'contributors' ? (
                <div className="flex-1 min-h-0">
                    <ContributorsReportSection />
                </div>
            ) : (
                <>
                    {/* Barra de Ações Rápidas & Seleção de Mês e Período */}
                    <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                        {/* Filtro de Mês e Período (Lado Esquerdo) */}
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
                                        onChange={(e) => handleMonthYearSelect(Number(e.target.value), selectedYear)}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white px-2.5 py-1 rounded-lg text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
                                    >
                                        {monthsList.map(m => (
                                            <option key={m.val} value={m.val}>{m.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => handleMonthYearSelect(selectedMonth, Number(e.target.value))}
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
                                        value={customStart}
                                        onChange={(e) => setCustomStart(e.target.value)}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-white px-2 py-1 rounded-lg text-xs focus:outline-none focus:border-orange-500"
                                    />
                                    <span className="text-slate-400 font-bold text-[10px] uppercase">até</span>
                                    <input
                                        type="date"
                                        value={customEnd}
                                        onChange={(e) => setCustomEnd(e.target.value)}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-white px-2 py-1 rounded-lg text-xs focus:outline-none focus:border-orange-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleApplyCustomDates}
                                        className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black uppercase text-[10px] tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
                                    >
                                        Aplicar
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Botões Lançar e Livro Caixa (Posicionados no final à direita, debaixo dos ícones de baixar/imprimir) */}
                        <div className="flex items-center gap-1.5 ml-auto">
                            <button
                                type="button"
                                onClick={() => handleManualLaunch('entrada')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-xs transition-all cursor-pointer active:scale-95 border border-orange-400/30"
                                title="Criar Novo Lançamento Manual"
                            >
                                <PlusCircleIcon className="w-3.5 h-3.5" />
                                <span>Lançar</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveView('livro_caixa')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-xs transition-all cursor-pointer active:scale-95"
                                title="Abrir Visão do Livro Caixa"
                            >
                                <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Livro Caixa</span>
                            </button>
                        </div>
                    </div>

                    {ctrl.activeCategory === 'churches' && (
                        <ChurchChipsList list={ctrl.churchList} selectedId={ctrl.selectedReportId} onSelect={setSelectedIdSafe(ctrl)} />
                    )}

                    {ctrl.bankList.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Filtrar por Banco</label>
                            <BankChipsList list={ctrl.bankList} selectedId={ctrl.selectedBankId} onSelect={ctrl.setSelectedBankId} />
                        </div>
                    )}

                    <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card overflow-hidden flex flex-col p-0 relative">
                        <StatsStrip 
                            category={ctrl.activeCategory} 
                            reportName={reportDisplayName} 
                            summary={ctrl.activeSummary} 
                            searchTerm={ctrl.searchTerm} 
                            onSearchChange={ctrl.setSearchTerm} 
                            language={language}
                        />
                        
                        <div className="flex-1 min-h-0 relative">
                            {ctrl.sortedData.length > 0 ? (
                                <div className="absolute inset-0">
                                    <EditableReportTable 
                                        data={ctrl.sortedData}
                                        onRowChange={(row) => ctrl.updateReportData(row)}
                                        reportType={ctrl.activeCategory === 'expenses' ? 'expenses' : 'income'}
                                        sortConfig={ctrl.sortConfig}
                                        onSort={ctrl.handleSort}
                                        onSplit={setSplitRow}
                                        loadingAiId={loadingAiId}
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                    <p className="text-xs italic">Nenhum dado encontrado para esta seleção.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {splitRow && (
                <SplitTransactionModal 
                    isOpen={!!splitRow}
                    onClose={() => setSplitRow(null)}
                    matchResult={splitRow}
                    onSave={(splits) => {
                        const updatedRow: MatchResult = {
                            ...splitRow,
                            splits: splits
                        };
                        ctrl.updateReportData(updatedRow);
                        setSplitRow(null);
                    }}
                />
            )}
        </div>
    );
};

// Helper interno para evitar closure stale se necessário em eventos rápidos
const setSelectedIdSafe = (ctrl: any) => (id: string) => ctrl.setSelectedReportId(id);
