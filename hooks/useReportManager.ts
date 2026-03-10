import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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

const MAX_REPORTS_PER_USER = 60;
const MAX_RESULTS_PER_REPORT = 1000;

export const useReportManager = (
    user: any | null,
    showToast: (msg: string, type: 'success' | 'error') => void
) => {

    const userSuffix = user ? `-${user.id}` : '-guest';

    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [searchFilters, setSearchFilters] = usePersistentState<SearchFilters>(
        `identificapix-search-filters${userSuffix}`,
        DEFAULT_SEARCH_FILTERS
    );

    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
    const [savingReportState, setSavingReportState] = useState<SavingReportState | null>(null);

    /**
     * 🧠 usado pelo autosave inteligente
     */
    const lastSavedPayloadRef = useRef<string>("");

    useEffect(() => {

        if (!user) {
            setSavedReports([]);
            return;
        }

        const fetchReports = async () => {

            try {

                const { data, error } = await supabase
                    .from('saved_reports')
                    .select('id,name,created_at,record_count,user_id')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                if (data) {

                    const hydrated: SavedReport[] = data.map((r: any) => ({
                        id: r.id,
                        name: r.name,
                        createdAt: r.created_at,
                        recordCount: r.record_count,
                        user_id: r.user_id,
                        data: undefined
                    }));

                    setSavedReports(hydrated);

                }

            } catch (err) {

                console.error("[ReportManager] erro ao carregar relatórios", err);

            }

        };

        fetchReports();

    }, [user]);

    const openSearchFilters = useCallback(() => setIsSearchFiltersOpen(true), []);
    const closeSearchFilters = useCallback(() => setIsSearchFiltersOpen(false), []);
    const clearSearchFilters = useCallback(() => setSearchFilters(DEFAULT_SEARCH_FILTERS), [setSearchFilters]);

    const updateSavedReportName = useCallback(async (reportId: string, newName: string) => {

        if (!user) return;

        setSavedReports(prev =>
            prev.map(r => r.id === reportId ? { ...r, name: newName } : r)
        );

        const { error } = await supabase
            .from('saved_reports')
            .update({ name: newName })
            .eq('id', reportId);

        if (error) showToast('Erro ao renomear relatório.', 'error');
        else showToast('Relatório renomeado.', 'success');

    }, [user, showToast]);

    const overwriteSavedReport = useCallback(async (
        reportId: string,
        results: MatchResult[],
        spreadsheetData?: SpreadsheetData,
        finalized?: boolean
    ) => {

        if (!user || !reportId) return;

        const existingReport = savedReports.find(r => r.id === reportId);

        const currentData = existingReport?.data || {
            results: [],
            sourceFiles: [],
            bankStatementFile: null
        };

        const safeResults = (results || []).slice(0, MAX_RESULTS_PER_REPORT);

        const mergedData: any = {
            ...currentData,
            results: safeResults.length ? safeResults : currentData.results,
            spreadsheet: spreadsheetData || currentData.spreadsheet
        };

        if (finalized) {

            mergedData.finalized = true;
            mergedData.finalizedAt = new Date().toISOString();

        }

        const recordCount = spreadsheetData?.rows
            ? spreadsheetData.rows.length
            : (mergedData.results?.length || 0);

        const payloadString = JSON.stringify({
            reportId,
            recordCount,
            mergedData
        });

        /**
         * 🧠 autosave inteligente
         * evita salvar se nada mudou
         */
        if (payloadString === lastSavedPayloadRef.current) {
            return;
        }

        lastSavedPayloadRef.current = payloadString;

        setSavedReports(prev =>
            prev.map(r =>
                r.id === reportId
                    ? { ...r, recordCount, data: mergedData }
                    : r
            )
        );

        const { error } = await supabase
            .from('saved_reports')
            .update({
                data: mergedData,
                record_count: recordCount
            })
            .eq('id', reportId);

        if (error) {

            console.error("[AutoSave] erro:", error);
            showToast("Falha ao salvar alterações.", "error");

        }

    }, [user, showToast, savedReports]);

    const openSaveReportModal = useCallback((state: SavingReportState) => {
        setSavingReportState(state);
    }, []);

    const closeSaveReportModal = useCallback(() => {
        setSavingReportState(null);
    }, []);

    const confirmSaveReport = useCallback(async (name: string): Promise<string | null> => {

        if (!savingReportState || !user) return null;

        if (savedReports.length >= MAX_REPORTS_PER_USER) {

            showToast(`Limite de ${MAX_REPORTS_PER_USER} relatórios atingido.`, 'error');
            closeSaveReportModal();
            return null;

        }

        const safeResults = (savingReportState.results || [])
            .slice(0, MAX_RESULTS_PER_REPORT);

        const newReportId = `rep-${Date.now()}`;

        const newReport: SavedReport = {
            id: newReportId,
            name,
            createdAt: new Date().toISOString(),
            recordCount: safeResults.length,
            user_id: user.id,
            data: {
                results: safeResults,
                sourceFiles: [],
                bankStatementFile: null,
                finalized: false
            }
        };

        setSavedReports(prev => [newReport, ...prev]);
        closeSaveReportModal();

        const { error } = await supabase
            .from('saved_reports')
            .insert({
                id: newReport.id,
                name: newReport.name,
                record_count: newReport.recordCount,
                user_id: newReport.user_id,
                data: newReport.data
            });

        if (error) {

            setSavedReports(prev =>
                prev.filter(r => r.id !== newReport.id)
            );

            showToast('Erro ao salvar relatório.', 'error');

            return null;

        }

        showToast('Relatório criado!', 'success');

        return newReportId;

    }, [
        savingReportState,
        user,
        showToast,
        closeSaveReportModal,
        savedReports.length
    ]);

    return useMemo(() => ({

        savedReports,
        setSavedReports,
        maxSavedReports: MAX_REPORTS_PER_USER,

        searchFilters,
        setSearchFilters,

        isSearchFiltersOpen,
        openSearchFilters,
        closeSearchFilters,
        clearSearchFilters,

        savingReportState,
        openSaveReportModal,
        closeSaveReportModal,

        confirmSaveReport,
        overwriteSavedReport,
        updateSavedReportName

    }), [
        savedReports,
        searchFilters,
        isSearchFiltersOpen,
        savingReportState
    ]);
};