import React, { useContext, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { EditableReportTable } from '../components/reports/EditableReportTable';
import { ChartBarIcon } from '../components/Icons';
import { useReportsController } from '../hooks/useReportsController';
import { Calendar, Check, Building2 } from 'lucide-react';
import { MatchResult } from '../types';
import { SplitTransactionModal } from '../components/modals/SplitTransactionModal';
import { ChurchClosingModal } from '../components/modals/ChurchClosingModal';

// Sub-componentes modulares
import { CategoryPills } from '../components/reports/CategoryPills';
import { ReportToolbar } from '../components/reports/ReportToolbar';
import { ChurchChipsList } from '../components/reports/ChurchChipsList';
import { BankChipsList } from '../components/reports/BankChipsList';
import { StatsStrip } from '../components/reports/StatsStrip';

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
    const { t, language } = useTranslation();
    const { loadingAiId } = useContext(AppContext);
    const { subscription } = useAuth();

    // Estados locais para controle do período
    const [selectionMode, setSelectionMode] = useState<'month' | 'dates'>('month');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [customStart, setCustomStart] = useState<string>('');
    const [customEnd, setCustomEnd] = useState<string>('');
    const [splitRow, setSplitRow] = useState<MatchResult | null>(null);
    const [isClosingModalOpen, setIsClosingModalOpen] = useState<boolean>(false);

    const startSelected = ctrl.searchFilters?.dateRange?.start;
    const endSelected = ctrl.searchFilters?.dateRange?.end;
    const hasActiveReport = !!ctrl.activeReportId;
    const hasPreviewData = !!ctrl.reportPreviewData;

    // Se o período não estiver selecionado e não estamos visualizando um relatório salvo/snapshot carregado
    if ((!startSelected || !endSelected) && !hasActiveReport && !hasPreviewData) {
        const handleConfirmPeriod = () => {
            if (selectionMode === 'month') {
                const { start, end } = getDatesFromMonthYear(selectedMonth, selectedYear);
                ctrl.setSearchFilters((prev: any) => ({
                    ...prev,
                    dateRange: { start, end }
                }));
            } else {
                if (!customStart || !customEnd) {
                    alert('Por favor, selecione ambas as datas de início e fim.');
                    return;
                }
                ctrl.setSearchFilters((prev: any) => ({
                    ...prev,
                    dateRange: { start: customStart, end: customEnd }
                }));
            }
        };

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

        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/40 rounded-3xl animate-fade-in">
                <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-8 flex flex-col gap-6">
                    <div className="flex flex-col items-center text-center gap-2">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full text-blue-600 dark:text-blue-400">
                            <Calendar className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Selecione o Período</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-sm leading-relaxed">
                            Para garantir máxima velocidade e precisão nos relatórios, selecione o período desejado abaixo para carregar os dados.
                        </p>
                    </div>

                    {/* Botões de Seleção de Modo */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-700/50 rounded-2xl">
                        <button
                            type="button"
                            onClick={() => setSelectionMode('month')}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                selectionMode === 'month'
                                    ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                        >
                            Mês e Ano
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectionMode('dates')}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                selectionMode === 'dates'
                                    ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                        >
                            Intervalo de Datas
                        </button>
                    </div>

                    {/* Inputs baseados no modo */}
                    {selectionMode === 'month' ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mês</label>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {monthsList.map(m => (
                                        <option key={m.val} value={m.val}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ano</label>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {yearsList.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Início</label>
                                    <input
                                        type="date"
                                        value={customStart}
                                        onChange={(e) => setCustomStart(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Fim</label>
                                    <input
                                        type="date"
                                        value={customEnd}
                                        onChange={(e) => setCustomEnd(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Botão de confirmação */}
                    <button
                        type="button"
                        onClick={handleConfirmPeriod}
                        className="w-full h-12 flex items-center justify-center gap-2 text-xs font-black text-white rounded-2xl shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 active:scale-95 transition-all bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 uppercase tracking-widest cursor-pointer"
                    >
                        <Check className="w-4 h-4" />
                        Carregar Período
                    </button>
                </div>
            </div>
        );
    }

    if (!ctrl.reportPreviewData) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState
                    icon={<ChartBarIcon className="w-12 h-12 text-brand-blue dark:text-blue-400" />}
                    title={t('empty.reports.title')}
                    message={t('empty.reports.message')}
                    action={{ text: t('empty.dashboard.saved.action'), onClick: () => ctrl.setActiveView('upload') }}
                />
            </div>
        );
    }

    const reportDisplayName = ctrl.activeCategory === 'general' ? 'Todas as Entradas (Completo)' : 
        ctrl.activeCategory === 'churches' ? ctrl.churchList.find(c => c.id === ctrl.selectedReportId)?.name || 'Selecione uma Igreja' :
        ctrl.activeCategory === 'unidentified' ? 'Transações Pendentes' : 'Saídas e Despesas';

    return (
        <div className="flex flex-col h-full animate-fade-in gap-2 pb-2 px-1">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <h2 className="text-lg font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('reports.title')}</h2>
                    <div className="overflow-x-auto pb-1 -mx-1 px-1 custom-scrollbar scrollbar-hide">
                        <CategoryPills activeCategory={ctrl.activeCategory} onCategoryChange={ctrl.setActiveCategory} counts={ctrl.counts} role={subscription.role} />
                    </div>
                </div>
                {/* Fix: Removed invalid onSaveChanges prop as it is not defined in ReportToolbarProps and not used in the component */}
                <ReportToolbar 
                    onAiClick={ctrl.runAiAutoIdentification} 
                    onUpdateSource={() => ctrl.setActiveView('upload')}
                    onDownload={ctrl.handleDownload} 
                    onDownloadExcel={ctrl.handleDownloadExcel}
                    onDownloadPdf={ctrl.handleDownloadPdf}
                    onPrint={ctrl.handlePrint}
                    onSaveReport={ctrl.handleSaveReport}
                    hasActiveReport={!!ctrl.activeReportId}
                    role={subscription.role}
                />
            </div>

            {/* Barra de Período Selecionado com opção de alteração e botão de fechamento */}
            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                {startSelected && endSelected && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/80 rounded-xl text-xs text-slate-600 dark:text-slate-300 w-fit">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                            Período: <strong className="text-slate-800 dark:text-white font-black">{formatDateBRL(startSelected)}</strong> até <strong className="text-slate-800 dark:text-white font-black">{formatDateBRL(endSelected)}</strong>
                        </span>
                        <button 
                            onClick={() => {
                                ctrl.setSearchFilters((prev: any) => ({
                                    ...prev,
                                    dateRange: { start: '', end: '' }
                                }));
                            }}
                            className="ml-2 text-[10px] font-black uppercase text-blue-600 hover:text-red-500 transition-colors cursor-pointer"
                        >
                            Alterar
                        </button>
                    </div>
                )}

                {ctrl.activeCategory === 'churches' && (
                    <button
                        onClick={() => setIsClosingModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-blue to-brand-teal hover:opacity-90 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                    >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Realizar Fechamento & Transferir Saldo</span>
                    </button>
                )}
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

            <ChurchClosingModal 
                isOpen={isClosingModalOpen}
                onClose={() => setIsClosingModalOpen(false)}
                currentChurchId={ctrl.selectedReportId}
            />
        </div>
    );
};

// Helper interno para evitar closure stale se necessário em eventos rápidos
const setSelectedIdSafe = (ctrl: any) => (id: string) => ctrl.setSelectedReportId(id);
