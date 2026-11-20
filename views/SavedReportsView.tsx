import React from 'react';
import { useUI } from '../contexts/UIContext';
import { EmptyState } from '../components/EmptyState';
import { DocumentDuplicateIcon } from '../components/Icons';
import { useSavedReportsController } from '../hooks/useSavedReportsController';
import { ReportsTable } from '../components/saved-reports/ReportsTable';

/**
 * SAVED REPORTS VIEW (Planilhas Salvas)
 * Gestão e consulta de todas as planilhas conciliadas e relatórios salvos.
 */
export const SavedReportsView: React.FC = () => {
    const ctrl = useSavedReportsController();
    const { setActiveView } = useUI();

    const totalReports = (ctrl.savedReports || []).length;
    const isEmpty = totalReports === 0;

    return (
        <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full h-full flex flex-col animate-fade-in pb-4">
            {/* Standard Header Card */}
            <div className="flex flex-col gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex-shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                            <DocumentDuplicateIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                {ctrl.t('savedReports.title')}
                            </h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                {ctrl.t('savedReports.subtitle')}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        {/* Compact space usage tracker */}
                        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Espaço Utilizado:</span>
                            <div className="h-1.5 w-20 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${ctrl.storageColor}`}
                                    style={{ width: `${ctrl.usagePercent}%` }}
                                ></div>
                            </div>
                            <span className={`text-xs font-bold tabular-nums ${ctrl.usagePercent > 80 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {totalReports}/{ctrl.maxSavedReports}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content area */}
            {isEmpty ? (
                <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 md:p-12 rounded-xl shadow-xs min-h-[400px]">
                    <EmptyState
                        icon={<DocumentDuplicateIcon className="w-12 h-12 text-orange-600 dark:text-orange-400" />}
                        title={ctrl.t('savedReports.empty.title')}
                        message={ctrl.t('savedReports.empty.message')}
                        action={{
                            text: ctrl.t('empty.dashboard.action'), 
                            onClick: () => setActiveView('upload'),
                        }}
                        flat={true}
                    />
                </div>
            ) : (
                <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col">
                    {/* Header compact row for search inside the table */}
                    <div className="px-4 py-3 border-b border-slate-200/90 dark:border-slate-800 flex justify-between items-center gap-3 bg-slate-50/80 dark:bg-slate-800/50">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Histórico de Arquivos Salvos</span>
                        <div className="relative w-48 md:w-64">
                            <input
                                type="text"
                                placeholder={ctrl.t('savedReports.search')}
                                value={ctrl.searchQuery}
                                onChange={e => ctrl.setSearchQuery(e.target.value)}
                                className="pl-3.5 pr-7 py-1.5 block w-full rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium shadow-2xs focus:border-orange-500 transition-all outline-none placeholder:text-slate-400"
                            />
                            {ctrl.searchQuery && (
                                <button onClick={() => ctrl.setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <span className="text-xs">×</span>
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}>
                        <ReportsTable 
                            reports={ctrl.processedReports}
                            sortConfig={ctrl.sortConfig}
                            onSort={ctrl.handleSort}
                            editingReportId={ctrl.editingReportId}
                            editName={ctrl.editName}
                            setEditName={ctrl.setEditName}
                            onSaveEdit={ctrl.handleSaveEdit}
                            onCancelEdit={ctrl.handleCancelEdit}
                            onStartEdit={ctrl.handleStartEdit}
                            onView={ctrl.viewSavedReport}
                            onDuplicate={ctrl.handleDuplicate}
                            onDelete={(id, name) => ctrl.openDeleteConfirmation({ type: 'report-saved', id, name })}
                            formatDate={ctrl.formatDate}
                            language={ctrl.language}
                            noResultsText={ctrl.t('common.noResults')}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
