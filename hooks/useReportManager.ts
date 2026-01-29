
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { usePersistentState } from './usePersistentState';
import { SavedReport, SearchFilters, SavingReportState, MatchResult, SpreadsheetData } from '../types';

const DEFAULT_SEARCH_FILTERS: SearchFilters = {
    dateRange: { start: null, end: null },
    valueFilter: { operator: 'any', value1: null, value2: null },
    transactionType: 'all',
    reconciliationStatus: 'all',
    filterBy: 'none',
    churchIds: [],
    contributorName: '',
    reportId: null,
};

// LIMITE DE SEGURANÇA (Hard Limit)
const MAX_REPORTS_PER_USER = 60;

export const useReportManager = (user: any | null, showToast: (msg: string, type: 'success' | 'error') => void) => {
    
    const userSuffix = user ? `-${user.id}` : '-guest';

    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [searchFilters, setSearchFilters] = usePersistentState<SearchFilters>(`identificapix-search-filters${userSuffix}`, DEFAULT_SEARCH_FILTERS);
    
    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
    const [savingReportState, setSavingReportState] = useState<SavingReportState | null>(null);

    const openSearchFilters = useCallback(() => setIsSearchFiltersOpen(true), []);
    const closeSearchFilters = useCallback(() => setIsSearchFiltersOpen(false), []);
    const clearSearchFilters = useCallback(() => setSearchFilters(DEFAULT_SEARCH_FILTERS), [setSearchFilters]);

    const updateSavedReportName = useCallback(async (reportId: string, newName: string) => {
        if(!user) return;
        setSavedReports(prev => prev.map(r => r.id === reportId ? { ...r, name: newName } : r));
        const { error } = await supabase.from('saved_reports').update({ name: newName }).eq('id', reportId);
        if (error) showToast('Erro ao renomear relatório.', 'error');
        else showToast('Relatório renomeado.', 'success');
    }, [user, showToast]);

    const updateSavedReportTransaction = useCallback(async (transactionId: string, updatedRow: MatchResult) => {
        if (!user) return;
        const reportIndex = savedReports.findIndex(r => r.data?.results.some(res => res.transaction.id === transactionId));
        if (reportIndex === -1) return;

        const report = savedReports[reportIndex];
        if (!report.data) return;

        const updatedResults = report.data.results.map(res => 
            res.transaction.id === transactionId ? updatedRow : res
        );

        const updatedReport = {
            ...report,
            data: {
                ...report.data,
                results: updatedResults
            }
        };

        setSavedReports(prev => {
            const newReports = [...prev];
            newReports[reportIndex] = updatedReport;
            return newReports;
        });

        await supabase
            .from('saved_reports')
            .update({ data: updatedReport.data as any })
            .eq('id', report.id);
    }, [user, savedReports]);

    /**
     * ⚡ AUTO-SAVE ENGINE: Sobrescreve o relatório de forma silenciosa.
     */
    const overwriteSavedReport = useCallback(async (reportId: string, results: MatchResult[], spreadsheetData?: SpreadsheetData) => {
        if (!user || !reportId) return;

        const reportIndex = savedReports.findIndex(r => r.id === reportId);
        if (reportIndex === -1) return;

        const report = savedReports[reportIndex];
        const recordCount = spreadsheetData?.rows ? spreadsheetData.rows.length : results.length;

        const updatedReport: SavedReport = {
            ...report,
            recordCount: recordCount,
            data: {
                results: results,
                sourceFiles: report.data?.sourceFiles || [],
                bankStatementFile: report.data?.bankStatementFile || null,
                spreadsheet: spreadsheetData || report.data?.spreadsheet
            }
        };

        setSavedReports(prev => {
            const newReports = [...prev];
            newReports[reportIndex] = updatedReport;
            return newReports;
        });

        // Persistência em background sem bloquear a UI
        const { error } = await supabase
            .from('saved_reports')
            .update({ 
                data: updatedReport.data as any,
                record_count: recordCount 
            })
            .eq('id', reportId);

        if (error) {
            console.error("[AutoSave] Falha na sincronização cloud:", error);
        }
    }, [user, savedReports]);

    const saveFilteredReport = useCallback((results: MatchResult[]) => {
        setSavingReportState({
            type: 'search',
            results: results,
            groupName: 'Filtrado'
        });
    }, []);
    
    const openSaveReportModal = useCallback((state: SavingReportState) => setSavingReportState(state), []);
    const closeSaveReportModal = useCallback(() => setSavingReportState(null), []);
    
    const confirmSaveReport = useCallback(async (name: string) => {
        if (!savingReportState || !user) return;
        
        if (savedReports.length >= MAX_REPORTS_PER_USER) {
            showToast(`Limite de ${MAX_REPORTS_PER_USER} relatórios atingido.`, 'error');
            closeSaveReportModal();
            return;
        }

        const isSpreadsheet = savingReportState.type === 'spreadsheet';
        const recordCount = isSpreadsheet && savingReportState.spreadsheetData?.rows
            ? savingReportState.spreadsheetData.rows.length 
            : savingReportState.results.length;

        const newReport: SavedReport = {
            id: `rep-${Date.now()}`,
            name: name,
            createdAt: new Date().toISOString(),
            recordCount: recordCount,
            user_id: user.id,
            data: {
                results: savingReportState.results,
                sourceFiles: [],
                bankStatementFile: null,
                spreadsheet: isSpreadsheet ? savingReportState.spreadsheetData : undefined
            }
        };

        setSavedReports(prev => [newReport, ...prev]);
        closeSaveReportModal();
        
        const { error } = await supabase.from('saved_reports').insert({
            id: newReport.id,
            name: newReport.name,
            record_count: newReport.recordCount,
            user_id: newReport.user_id,
            data: newReport.data as any
        });

        if (error) {
            setSavedReports(prev => prev.filter(r => r.id !== newReport.id));
            showToast('Erro ao salvar relatório.', 'error');
        } else {
            showToast('Relatório criado!', 'success');
        }
    }, [savingReportState, user, showToast, closeSaveReportModal, savedReports.length]);

    const deleteOldReports = useCallback(async (dateThreshold: Date) => {
        if (!user) return;

        const reportsToDelete = savedReports.filter(r => new Date(r.createdAt) < dateThreshold);
        if (reportsToDelete.length === 0) return;

        setSavedReports(prev => prev.filter(r => new Date(r.createdAt) >= dateThreshold));

        await supabase
            .from('saved_reports')
            .delete()
            .lt('created_at', dateThreshold.toISOString())
            .eq('user_id', user.id);
        
        showToast(`${reportsToDelete.length} itens removidos.`, "success");
    }, [user, savedReports, showToast]);

    const allHistoricalResults = useMemo(() => {
        return savedReports
            .filter(r => r.data && r.data.results)
            .flatMap(report => report.data!.results);
    }, [savedReports]);

    return useMemo(() => ({
        savedReports, setSavedReports,
        maxSavedReports: MAX_REPORTS_PER_USER,
        searchFilters, setSearchFilters,
        isSearchFiltersOpen, openSearchFilters, closeSearchFilters, clearSearchFilters,
        savingReportState, openSaveReportModal, closeSaveReportModal, confirmSaveReport,
        updateSavedReportName, updateSavedReportTransaction, saveFilteredReport, overwriteSavedReport,
        deleteOldReports,
        allHistoricalResults
    }), [
        savedReports, searchFilters, isSearchFiltersOpen, savingReportState, allHistoricalResults,
        setSavedReports, setSearchFilters, openSearchFilters, closeSearchFilters, clearSearchFilters,
        openSaveReportModal, closeSaveReportModal, confirmSaveReport, updateSavedReportName, updateSavedReportTransaction, saveFilteredReport, overwriteSavedReport,
        deleteOldReports
    ]);
};
