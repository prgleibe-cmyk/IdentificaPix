import React, { useContext, useState, useMemo, useRef } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { EditableReportTable } from '../components/reports/EditableReportTable';
import { ChartBarIcon, PlusCircleIcon } from '../components/Icons';
import { useReportsController } from '../hooks/useReportsController';
import { Calendar, Check, Building2, BookOpen, Wallet } from 'lucide-react';
import { MatchResult, Transaction, ReconciliationStatus } from '../types';
import { SplitTransactionModal } from '../components/modals/SplitTransactionModal';
import { EditManualTransactionModal } from '../components/modals/EditManualTransactionModal';

// Sub-componentes modulares
import { CategoryPills } from '../components/reports/CategoryPills';
import { ReportToolbar } from '../components/reports/ReportToolbar';
import { BankChipsList } from '../components/reports/BankChipsList';
import { StatsStrip } from '../components/reports/StatsStrip';
import { ContributorsReportSection, ContributorsReportHandle } from '../components/reports/ContributorsReportSection';
import { PeriodSelector, PeriodSelectionMode, DEFAULT_MONTHS_LIST } from '../components/reports/PeriodSelector';
import { ExportPrintActions } from '../components/reports/ExportPrintActions';

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
    const { subscription, user, isSecondaryUser, isAuthReady } = useAuth();

    const perms = (subscription?.permissions || {}) as any;
    const canIdentify = !isSecondaryUser || (perms.identificar !== false && perms.identifyPayments !== false);

    const handleManualLaunch = (type?: 'entrada' | 'saida') => {
        const existingGhost = bulkIdentificationTxs?.find((tx: any) => tx.id.startsWith('ghost-manual-'));
        if (existingGhost) {
            setActiveView('novo_lancamento');
            return;
        }

        const amountFloat = 0;
        const description = type === 'saida' ? 'Lançamento Manual Saída' : type === 'entrada' ? 'Lançamento Manual Entrada' : 'Lançamento Manual';

        const manualTxId = `ghost-manual-${Date.now()}`;
        const newTx: Transaction = {
            id: manualTxId,
            date: new Date().toISOString().split('T')[0],
            description: description,
            rawDescription: description,
            amount: amountFloat,
            isConfirmed: false
        };

        if (setBulkIdentificationTxs) setBulkIdentificationTxs([newTx]);
        setActiveView('novo_lancamento');
    };

    // Estados locais para controle do período
    const [selectionMode, setSelectionMode] = useState<PeriodSelectionMode>('month');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [customStart, setCustomStart] = useState<string>('');
    const [customEnd, setCustomEnd] = useState<string>('');
    const [splitRow, setSplitRow] = useState<MatchResult | null>(null);
    const [editingManualRow, setEditingManualRow] = useState<MatchResult | null>(null);
    const hasInitializedPeriodRef = useRef(false);
    const contributorsReportRef = useRef<ContributorsReportHandle>(null);

    const startSelected = ctrl.searchFilters?.dateRange?.start;
    const endSelected = ctrl.searchFilters?.dateRange?.end;

    const currentYear = new Date().getFullYear();
    const yearsList = useMemo(() => {
        const list = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
        if (!list.includes(selectedYear)) list.push(selectedYear);
        return Array.from(new Set(list)).sort((a, b) => b - a);
    }, [currentYear, selectedYear]);

    // Auto-inicializar e sincronizar com o período definido nos filtros globais
    React.useEffect(() => {
        if (!startSelected || !endSelected) {
            if (!hasInitializedPeriodRef.current) {
                hasInitializedPeriodRef.current = true;
                const now = new Date();
                const m = now.getMonth() + 1;
                const y = now.getFullYear();
                setSelectedMonth(prev => prev !== m ? m : prev);
                setSelectedYear(prev => prev !== y ? y : prev);
                const { start, end } = getDatesFromMonthYear(m, y);
                if (ctrl.setSearchFilters) {
                    ctrl.setSearchFilters((prev: any) => ({
                        ...prev,
                        dateRange: { start, end }
                    }));
                }
            }
        } else {
            hasInitializedPeriodRef.current = true;
            const startParts = startSelected.split('-');
            const endParts = endSelected.split('-');
            if (startParts.length === 3 && endParts.length === 3) {
                const y = Number(startParts[0]);
                const m = Number(startParts[1]);
                const lastDay = new Date(y, m, 0).getDate();
                const isFullMonth = startParts[2] === '01' && Number(endParts[2]) === lastDay && Number(endParts[1]) === m && Number(endParts[0]) === y;
                if (isFullMonth) {
                    setSelectedMonth(prev => prev !== m ? m : prev);
                    setSelectedYear(prev => prev !== y ? y : prev);
                    setSelectionMode(prev => prev !== 'month' ? 'month' : prev);
                } else {
                    setCustomStart(prev => prev !== startSelected ? startSelected : prev);
                    setCustomEnd(prev => prev !== endSelected ? endSelected : prev);
                    setSelectionMode(prev => prev !== 'dates' ? 'dates' : prev);
                }
            } else {
                setCustomStart(prev => prev !== startSelected ? startSelected : prev);
                setCustomEnd(prev => prev !== endSelected ? endSelected : prev);
            }
        }
    }, [startSelected, endSelected]);

    const handleMonthYearSelect = (month: number, year: number) => {
        setSelectedMonth(month);
        setSelectedYear(year);
        const { start, end } = getDatesFromMonthYear(month, year);
        if (ctrl.setSearchFilters) {
            ctrl.setSearchFilters((prev: any) => ({
                ...prev,
                dateRange: { start, end }
            }));
        }
    };

    const handleCustomDatesChange = (start: string, end: string) => {
        setCustomStart(start);
        setCustomEnd(end);
        if (start && end && ctrl.setSearchFilters) {
            ctrl.setSearchFilters((prev: any) => ({
                ...prev,
                dateRange: { start, end }
            }));
        }
    };

    const handlePeriodModeChange = (mode: PeriodSelectionMode) => {
        setSelectionMode(mode);
        if (mode === 'month') {
            handleMonthYearSelect(selectedMonth, selectedYear);
        } else if (mode === 'all') {
            hasInitializedPeriodRef.current = true;
            if (ctrl.setSearchFilters) {
                ctrl.setSearchFilters((prev: any) => ({
                    ...prev,
                    dateRange: { start: null, end: null }
                }));
            }
        } else if (mode === 'dates') {
            const { start, end } = getDatesFromMonthYear(selectedMonth, selectedYear);
            const nextStart = customStart || start;
            const nextEnd = customEnd || end;
            setCustomStart(nextStart);
            setCustomEnd(nextEnd);
            if (nextStart && nextEnd && ctrl.setSearchFilters) {
                ctrl.setSearchFilters((prev: any) => ({
                    ...prev,
                    dateRange: { start: nextStart, end: nextEnd }
                }));
            }
        }
    };

    const isInitialLoading = (isSecondaryUser && !isAuthReady) || ((ctrl.isHydrating || ctrl.isLoading) && (!ctrl.sortedData || ctrl.sortedData.length === 0) && (!ctrl.churchList || ctrl.churchList.length === 0));

    if (isInitialLoading) {
        return (
            <div className="flex flex-col min-h-full animate-fade-in gap-3 pb-16 md:pb-4">
                <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                            <Wallet className="w-4 h-4 stroke-[2]" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                Financeiro
                            </h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Sincronizando e carregando lançamentos do período selecionado...
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-8 rounded-xl shadow-xs min-h-[400px] gap-4">
                    <div className="relative flex items-center justify-center">
                        <div className="w-14 h-14 border-4 border-orange-100 dark:border-orange-950/40 border-t-orange-600 rounded-full animate-spin" />
                        <Calendar className="w-5 h-5 text-orange-600 absolute" />
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Carregando dados financeiros...</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Aguarde enquanto os lançamentos do período selecionado são processados.</p>
                    </div>
                </div>
            </div>
        );
    }

    const reportDisplayName = ctrl.activeCategory === 'general' ? 'Todas as Entradas (Completo)' : 
        ctrl.activeCategory === 'churches' ? ctrl.churchList.find(c => c.id === ctrl.selectedReportId)?.name || 'Selecione uma Igreja' :
        ctrl.activeCategory === 'unidentified' ? 'Transações Pendentes' :
        ctrl.activeCategory === 'contributors' ? 'Relatório de Cadastros / Contribuintes' : 'Saídas e Despesas';

    if (editingManualRow) {
        return (
            <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full min-h-full flex flex-col animate-fade-in pb-8 md:pb-4">
                <EditManualTransactionModal
                    isOpen={true}
                    row={editingManualRow}
                    onClose={() => setEditingManualRow(null)}
                    onSave={(updatedRow) => {
                        ctrl.updateReportData(updatedRow);
                        setEditingManualRow(null);
                    }}
                    asView={true}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full animate-fade-in gap-3 pb-16 md:pb-4">
            {/* Header Card Padronizado */}
            <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex-shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                            <Wallet className="w-4 h-4 stroke-[2]" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                Financeiro
                            </h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                Acompanhe lançamentos, conciliações e movimentações do período.
                            </p>
                        </div>
                    </div>

                    {ctrl.activeCategory === 'contributors' ? (
                        <ExportPrintActions
                            onDownloadCsv={() => contributorsReportRef.current?.downloadFormat('csv')}
                            onDownloadExcel={() => contributorsReportRef.current?.downloadFormat('excel')}
                            onDownloadPdf={() => contributorsReportRef.current?.downloadFormat('pdf')}
                            onDownloadOfx={() => contributorsReportRef.current?.downloadFormat('ofx')}
                            onPrint={() => contributorsReportRef.current?.print()}
                            downloadTitle="Exportar Cadastros"
                            printTitle="Imprimir Relatório de Cadastros"
                            menuTitle="Formatos de Cadastros"
                        />
                    ) : (
                        <ReportToolbar 
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
            </div>

            {ctrl.activeCategory === 'contributors' ? (
                <div className="flex-1 min-h-0 min-w-0">
                    <ContributorsReportSection ref={contributorsReportRef} hideExportPrint={true} />
                </div>
            ) : (
                <>
                    {/* Painel Unificado de Categorias, Período, Bancos e Ações Rápidas */}
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col gap-2.5 shrink-0">
                        {/* Linha 1: Categorias + Ações Primárias */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                            <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                                <CategoryPills 
                                    activeCategory={ctrl.activeCategory} 
                                    onCategoryChange={ctrl.setActiveCategory} 
                                    counts={ctrl.counts} 
                                    role={subscription.role} 
                                    isSecondaryUser={isSecondaryUser}
                                    churchList={ctrl.churchList}
                                    selectedReportId={ctrl.selectedReportId}
                                    onSelectChurch={setSelectedIdSafe(ctrl)}
                                />
                            </div>

                            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto shrink-0 sm:ml-auto">
                                <button
                                    type="button"
                                    onClick={() => handleManualLaunch('entrada')}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 shadow-xs transition-all cursor-pointer active:scale-95"
                                    title="Criar Novo Lançamento Manual"
                                >
                                    <PlusCircleIcon className="w-3.5 h-3.5" />
                                    <span>Lançar</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveView('livro_caixa')}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60 shadow-xs transition-all cursor-pointer active:scale-95"
                                    title="Abrir Visão do Livro Caixa"
                                >
                                    <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>Livro Caixa</span>
                                </button>
                            </div>
                        </div>

                        {/* Linha 2: Seletor de Mês/Período + Filtro de Banco inline */}
                        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                            <PeriodSelector
                                mode={selectionMode}
                                onModeChange={handlePeriodModeChange}
                                selectedMonth={selectedMonth}
                                selectedYear={selectedYear}
                                onMonthYearChange={handleMonthYearSelect}
                                customStart={customStart}
                                customEnd={customEnd}
                                onCustomDatesChange={handleCustomDatesChange}
                                monthsList={DEFAULT_MONTHS_LIST}
                                yearsList={yearsList}
                            />

                            {ctrl.bankList.length > 0 && (
                                <div className="flex items-center gap-2 min-w-0 lg:justify-end flex-1">
                                    <span className="text-[11px] font-medium text-slate-400 shrink-0 hidden sm:inline">Banco:</span>
                                    <div className="min-w-0 max-w-full">
                                        <BankChipsList list={ctrl.bankList} selectedId={ctrl.selectedBankId} onSelect={ctrl.setSelectedBankId} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-clip flex flex-col p-0 relative min-h-[500px]">
                        <StatsStrip 
                            category={ctrl.activeCategory} 
                            reportName={reportDisplayName} 
                            summary={ctrl.activeSummary} 
                            searchTerm={ctrl.searchTerm} 
                            onSearchChange={ctrl.setSearchTerm} 
                            language={language}
                        />
                        
                        <div className="flex-1 w-full flex flex-col relative min-h-[350px]">
                            {ctrl.sortedData.length > 0 ? (
                                <EditableReportTable 
                                    data={ctrl.sortedData}
                                    onRowChange={(row) => ctrl.updateReportData(row)}
                                    reportType={ctrl.activeCategory === 'expenses' ? 'expenses' : 'income'}
                                    sortConfig={ctrl.sortConfig}
                                    onSort={ctrl.handleSort}
                                    onEdit={setEditingManualRow}
                                    onSplit={setSplitRow}
                                    loadingAiId={loadingAiId}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
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
                        const firstSplitChurchId = splits[0]?.churchId;
                        const firstSplitChurchName = splits[0]?.churchName;

                        const updatedRow: MatchResult = {
                            ...splitRow,
                            splits: splits,
                            // Sincroniza a congregação da transação caso tenha sido selecionada no split
                            ...(firstSplitChurchId && firstSplitChurchId !== 'unidentified' ? {
                                church: {
                                    ...(splitRow.church || { address: '', logoUrl: '', pastor: '' }),
                                    id: firstSplitChurchId,
                                    name: firstSplitChurchName || splitRow.church?.name || 'Igreja'
                                },
                                _churchId: firstSplitChurchId
                            } : {})
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
