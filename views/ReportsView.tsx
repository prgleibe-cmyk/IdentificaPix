
import React, { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { EmptyState } from '../components/EmptyState';
import { EditableReportTable } from '../components/reports/EditableReportTable';
import { ChartBarIcon } from '../components/Icons';
import { useReportsController } from '../hooks/useReportsController';

// Sub-componentes modulares
import { CategoryPills } from '../components/reports/CategoryPills';
import { ReportToolbar } from '../components/reports/ReportToolbar';
import { ChurchChipsList } from '../components/reports/ChurchChipsList';
import { StatsStrip } from '../components/reports/StatsStrip';

/**
 * REPORTS VIEW (V3 - MODULAR)
 * Orquestrador principal da visão de relatórios e conciliação.
 */
export const ReportsView: React.FC = () => {
    const ctrl = useReportsController();
    const { t, language } = useTranslation();
    const { loadingAiId, openSmartEdit } = useContext(AppContext);

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
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('reports.title')}</h2>
                    <CategoryPills activeCategory={ctrl.activeCategory} onCategoryChange={ctrl.setActiveCategory} counts={ctrl.counts} />
                </div>
                {/* Fix: Removed invalid onSaveChanges prop as it is not defined in ReportToolbarProps and not used in the component */}
                <ReportToolbar 
                    onAiClick={ctrl.runAiAutoIdentification} 
                    onUpdateSource={() => ctrl.setActiveView('upload')}
                    onDownload={ctrl.handleDownload} 
                    onPrint={ctrl.handlePrint}
                    onSaveReport={ctrl.handleSaveReport}
                    hasActiveReport={!!ctrl.activeReportId}
                />
            </div>

            {ctrl.activeCategory === 'churches' && (
                <ChurchChipsList list={ctrl.churchList} selectedId={ctrl.selectedReportId} onSelect={setSelectedIdSafe(ctrl)} />
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
                                loadingAiId={loadingAiId}
                                onEdit={openSmartEdit}
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

// Helper interno para evitar closure stale se necessário em eventos rápidos
const setSelectedIdSafe = (ctrl: any) => (id: string) => ctrl.setSelectedReportId(id);
