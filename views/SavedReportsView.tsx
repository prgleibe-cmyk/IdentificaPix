import React from 'react';
import { useUI } from '../contexts/UIContext';
import { EmptyState } from '../components/EmptyState';
import { DocumentDuplicateIcon } from '../components/Icons';
import { useSavedReportsController } from '../hooks/useSavedReportsController';
import { SavedReportsHeader } from '../components/saved-reports/SavedReportsHeader';
import { ReportsTable } from '../components/saved-reports/ReportsTable';

/**
 * SAVED REPORTS VIEW (V3 - MODULAR REFACTORED)
 * Orchestrates listing and management of saved reconciliation history with a fully standardized page architecture.
 */
export const SavedReportsView: React.FC = () => {
    const ctrl = useSavedReportsController();
    const { setActiveView } = useUI();

    const totalReports = (ctrl.savedReports || []).length;
    const isEmpty = totalReports === 0;

    return (
        <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full h-full flex flex-col animate-fade-in pb-4">
            {/* Standard Header Card to unify the visual look of the app */}
            <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex-shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                            <DocumentDuplicateIcon className="w-5 h-5 text-orange-500" />
                            {ctrl.t('savedReports.title')}
                        </h1>
                        <p className="text-xs text-slate-400">
                            Consulte e gerencie o histórico de planilhas e conciliações bancárias salvas no sistema.
                        </p>
                    </div>
                    
                    {/* Compact space usage tracker */}
                    <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-black/20 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Espaço Utilizado:</span>
                        <div className="h-2 w-20 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${ctrl.storageColor}`}
                                style={{ width: `${ctrl.usagePercent}%` }}
                            ></div>
                        </div>
                        <span className={`text-xs font-black font-mono ${ctrl.usagePercent > 80 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {totalReports}/{ctrl.maxSavedReports}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content area */}
            {isEmpty ? (
                <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-6 md:p-12 rounded-2xl shadow-sm min-h-[400px]">
                    <EmptyState
                        icon={<DocumentDuplicateIcon className="w-12 h-12 text-orange-500 dark:text-orange-400" />}
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
                <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    {/* Header compact row for search inside the table */}
                    <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-black/10">
                        <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Histórico de Arquivos</span>
                        <div className="relative w-48 md:w-64">
                            <input
                                type="text"
                                placeholder={ctrl.t('savedReports.search')}
                                value={ctrl.searchQuery}
                                onChange={e => ctrl.setSearchQuery(e.target.value)}
                                className="pl-8 pr-6 py-1.5 block w-full rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm focus:border-orange-500 transition-all outline-none placeholder:text-slate-400"
                            />
                            {ctrl.searchQuery && (
                                <button onClick={() => ctrl.setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <span className="text-xs">×</span>
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
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
