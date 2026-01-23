
import React from 'react';
import { useTranslation } from '../contexts/I18nContext';
import { ResultsTable } from '../components/ResultsTable';
import { EmptyState } from '../components/EmptyState';
import { SearchIcon } from '../components/Icons';
import { useSearchController } from '../hooks/useSearchController';
import { SearchToolbar } from '../components/search/SearchToolbar';
import { SearchBar } from '../components/search/SearchBar';
import { SearchSummary } from '../components/search/SearchSummary';

/**
 * SEARCH VIEW (V3 - MODULAR)
 * Centraliza a pesquisa no histórico e filtragem avançada.
 */
export const SearchView: React.FC = () => {
    const { t } = useTranslation();
    const ctrl = useSearchController();

    if (ctrl.allHistoricalResults.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState 
                    icon={<SearchIcon className="w-12 h-12 text-brand-blue dark:text-blue-400" />} 
                    title={t('empty.search.title')} 
                    message={t('empty.search.message')} 
                    action={{ text: t('empty.dashboard.saved.action'), onClick: () => ctrl.setActiveView('upload') }} 
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in gap-2 pb-1">
            <SearchToolbar 
                title={t('search.title')}
                activeFilterCount={ctrl.activeFilterCount}
                onOpenFilters={ctrl.openSearchFilters}
                onPrint={ctrl.handlePrint}
                onSave={() => ctrl.saveFilteredReport(ctrl.filteredResults)}
            />
            
            <SearchBar 
                reportId={ctrl.searchFilters.reportId}
                onReportIdChange={(id) => ctrl.setSearchFilters({ ...ctrl.searchFilters, reportId: id })}
                query={ctrl.query}
                onQueryChange={ctrl.setQuery}
                allResultsCount={ctrl.allHistoricalResults.length}
                savedReports={ctrl.savedReports}
                labels={{
                    scope: 'Origem',
                    query: t('search.nameDesc'),
                    placeholder: t('search.nameDescPlaceholder'),
                    allOption: 'Todos ({count} registros)'
                }}
            />

            {(ctrl.query || ctrl.activeFilterCount > 0) && (
                <SearchSummary 
                    summary={ctrl.summary}
                    language={ctrl.language}
                    labels={{
                        total: t('search.totalTransactions'),
                        income: t('search.income'),
                        expenses: t('search.expenses')
                    }}
                />
            )}

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {ctrl.filteredResults.length > 0 ? (
                     <ResultsTable 
                        results={ctrl.paginatedResults} 
                        onManualIdentify={ctrl.openManualIdentify} 
                        loadingAiId={ctrl.loadingAiId} 
                        currentPage={ctrl.currentPage} 
                        totalPages={ctrl.totalPages} 
                        onPageChange={ctrl.setCurrentPage} 
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500 italic bg-white/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                        <SearchIcon className="w-10 h-10 mb-2 opacity-50" />
                        <p>{t('search.noResults')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
