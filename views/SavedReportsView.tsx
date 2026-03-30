import React from 'react';
import { useUI } from '../contexts/UIContext';
import { EmptyState } from '../components/EmptyState';
import { DocumentDuplicateIcon } from '../components/Icons';
import { useSavedReportsController } from '../hooks/useSavedReportsController';
import { SavedReportsHeader } from '../components/saved-reports/SavedReportsHeader';
import { ReportsTable } from '../components/saved-reports/ReportsTable';

/**
 * SAVED REPORTS VIEW (V3 - MODULAR REFACTORED)
 * Orchestrates listing and management of saved reconciliation history.
 */
export const SavedReportsView: React.FC = () => {
    const ctrl = useSavedReportsController();
    const { setActiveView } = useUI();

    if (ctrl.savedReports.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState
                    icon={<DocumentDuplicateIcon className="w-12 h-12 text-brand-blue dark:text-blue-400" />}
                    title={ctrl.t('savedReports.empty.title')}
                    message={ctrl.t('savedReports.empty.message')}
                    action={{
                        text: ctrl.t('empty.dashboard.action'), 
                        onClick: () => setActiveView('upload'),
                    }}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in gap-2 pb-1">
            <SavedReportsHeader 
                title={ctrl.t('savedReports.title')}
                searchPlaceholder={ctrl.t('savedReports.search')}
                searchQuery={ctrl.searchQuery}
                onSearchChange={ctrl.setSearchQuery}
                usagePercent={ctrl.usagePercent}
                storageColor={ctrl.storageColor}
                currentCount={ctrl.savedReports.length}
                maxCount={ctrl.maxSavedReports}
            />

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
                onDelete={(id, name) => ctrl.openDeleteConfirmation({ type: 'report-saved', id, name })}
                formatDate={ctrl.formatDate}
                language={ctrl.language}
                noResultsText={ctrl.t('common.noResults')}
            />
        </div>
    );
};