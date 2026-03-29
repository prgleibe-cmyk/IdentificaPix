import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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

export const useReportManager = (user: any | null, showToast: (msg: string, type: 'success' | 'error') => void) => {
    const { subscription } = useAuth();
    const userSuffix = user ? `-${user.id}` : '-guest';
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [searchFilters, setSearchFilters] = usePersistentState<SearchFilters>(`identificapix-search-filters${userSuffix}`, DEFAULT_SEARCH_FILTERS);
    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
    const [savingReportState, setSavingReportState] = useState<SavingReportState | null>(null);

    const lastSavedPayloadRef = useRef<string>('');

    /**
     * 📥 CARGA INICIAL
     */
    useEffect(() => {
        let ignore = false;
        if (!user) {
            setSavedReports([]);
            return;
        }

        const fetchReports = async () => {
            const ownerId = subscription.ownerId || user.id;
            try {
                let data: any[] | null = null;

                if (subscription.role === 'owner') {
                    const { data: d, error } = await supabase
                        .from('saved_reports')
                        .select('*')
                        .eq('user_id', ownerId)
                        .order('created_at', { ascending: false });

                    if (error) throw error;
                    if (ignore) return;
                    data = d;
                } else {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;

                    const response = await fetch(`/api/reference/data/${ownerId}`, {
                        method: 'GET',
                        cache: 'no-store',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        const resData = await response.json();
                        if (ignore) return;
                        data = resData.reports || [];
                    } else {
                        throw new Error("Falha ao buscar relatórios via API.");
                    }
                }

                if (data && !ignore) {
                    let hydrated: SavedReport[] = data.map((r: any) => {
                        let parsedData;
                        try {
                            parsedData = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
                        } catch (error) {
                            console.error("JSON corrompido detectado:", error);
                            parsedData = {
                                results: [],
                                spreadsheet: null
                            };
                        }

                        return {
                            id: r.id,
                            name: r.name,
                            createdAt: r.created_at,
                            recordCount: r.record_count,
                            user_id: r.user_id,
                            data: parsedData
                        };
                    });

                    if (subscription.role === 'member' && (subscription.congregationIds || []).length > 0) {
                        hydrated = (hydrated || []).filter(report => {
                            if (!(report.data?.results || []).length) return false;
                            return (report.data.results || []).some(res =>
                                (subscription.congregationIds || []).includes(res.church?.id || res._churchId)
                            );
                        });
                    }

                    setSavedReports(hydrated);
                }
            } catch (err) {
                if (!ignore) {
                    console.error("[ReportManager] Erro ao carregar relatórios históricos:", err);
                }
            }
        };

        fetchReports();
        return () => { ignore = true; };
    }, [user, subscription.ownerId, subscription.role, subscription.congregationIds]);

    /**
     * 🔴 TEMPO REAL (AJUSTE CIRÚRGICO)
     */
    useEffect(() => {
        if (!user) return;

        const fetchInitialData = async () => {
            const { data, error } = await supabase
                .from('saved_reports')
                .select('*');

            if (data) {
                const parsed = (data || []).map((r: any) => {
                    let parsedData;
                    try {
                        parsedData = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
                    } catch (e) {
                        parsedData = { results: [], spreadsheet: null };
                    }
                    return {
                        id: r.id,
                        name: r.name,
                        createdAt: r.created_at,
                        recordCount: r.record_count,
                        user_id: r.user_id,
                        data: parsedData
                    };
                });
                setSavedReports(parsed as any);
            }

            if (error) {
                console.error('Erro ao carregar dados iniciais:', error);
            }
        };

        fetchInitialData();

        const channel = supabase
            .channel('reports-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'saved_reports' },
                (payload: any) => {
                    const newRecord = payload.new;
                    const oldRecord = payload.old;

                    setSavedReports(prev => {
                        // DELETE
                        if (payload.eventType === 'DELETE') {
                            return (prev || []).filter(r => r.id !== oldRecord.id);
                        }

                        // INSERT ou UPDATE
                        let parsedData;
                        try {
                            parsedData = typeof newRecord.data === 'string' ? JSON.parse(newRecord.data) : newRecord.data;
                        } catch (error) {
                            console.error("JSON corrompido detectado:", error);
                            parsedData = {
                                results: [],
                                spreadsheet: null
                            };
                        }

                        const parsed: SavedReport = {
                            id: newRecord.id,
                            name: newRecord.name,
                            createdAt: newRecord.created_at,
                            recordCount: newRecord.record_count,
                            user_id: newRecord.user_id,
                            data: parsedData
                        };

                        const exists = prev.find(r => r.id === parsed.id);

                        if (exists) {
                            return prev.map(r => r.id === parsed.id ? parsed : r);
                        } else {
                            return [parsed, ...prev];
                        }
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const openSearchFilters = useCallback(() => setIsSearchFiltersOpen(true), []);
    const closeSearchFilters = useCallback(() => setIsSearchFiltersOpen(false), []);
    const clearSearchFilters = useCallback(() => setSearchFilters(DEFAULT_SEARCH_FILTERS), [setSearchFilters]);

    const updateSavedReportName = useCallback(async (reportId: string, newName: string) => {
        if(!user) return;
        setSavedReports(prev => prev.map(r => r.id === reportId ? { ...r, name: newName } : r));
        const { error } = await (supabase.from('saved_reports') as any).update({ name: newName }).eq('id', reportId);
        if (error) showToast('Erro ao renomear relatório.', 'error');
        else showToast('Relatório renomeado.', 'success');
    }, [user, showToast]);

    const overwriteSavedReport = useCallback(async (reportId: string, results: MatchResult[], spreadsheetData?: SpreadsheetData) => {
        if (!user || !reportId) return;
        
        const existingReport = savedReports.find(r => r.id === reportId);
        const currentData = existingReport?.data || { results: [], sourceFiles: [], bankStatementFile: null };

        if ((!results || (results || []).length === 0) && !spreadsheetData && !currentData.results && !currentData.spreadsheet) return;

        const currentPayload = JSON.stringify({ r: (results || []).length, s: !!spreadsheetData });
        if (lastSavedPayloadRef.current === currentPayload + reportId) return;
        lastSavedPayloadRef.current = currentPayload + reportId;

        const mergedData = {
            ...currentData,
            results: (results && results.length > 0) ? results : currentData.results,
            spreadsheet: spreadsheetData || currentData.spreadsheet
        };

        const recordCount = spreadsheetData?.rows ? spreadsheetData.rows.length : (mergedData.results?.length || 0);

        setSavedReports(prev => prev.map(r => r.id === reportId ? {
            ...r,
            recordCount,
            data: mergedData
        } : r));

        const { error } = await (supabase
            .from('saved_reports') as any)
            .update({ 
                data: mergedData as any,
                record_count: recordCount 
            })
            .eq('id', reportId);

        if (error) {
            console.error("[AutoSave] Erro ao persistir no Supabase:", error);
            showToast("Falha ao salvar alterações no servidor.", "error");
        } else {
            showToast("Alterações salvas no servidor.", "success");
        }
    }, [user, showToast, savedReports]);

    const saveFilteredReport = useCallback((results: MatchResult[]) => {
        setSavingReportState({
            type: 'search',
            results: results,
            groupName: 'Filtrado'
        });
    }, []);
    
    const openSaveReportModal = useCallback((state: SavingReportState) => setSavingReportState(state), []);
    const closeSaveReportModal = useCallback(() => setSavingReportState(null), []);
    
    const confirmSaveReport = useCallback(async (name: string): Promise<string | null> => {
        if (!savingReportState || !user) return null;
        const ownerId = subscription.ownerId || user.id;
        
        if (savedReports.length >= MAX_REPORTS_PER_USER) {
            showToast(`Limite de ${MAX_REPORTS_PER_USER} relatórios atingido.`, 'error');
            closeSaveReportModal();
            return null;
        }

        const isSpreadsheet = savingReportState.type === 'spreadsheet';
        const recordCount = isSpreadsheet && savingReportState.spreadsheetData?.rows
            ? savingReportState.spreadsheetData.rows.length 
            : savingReportState.results.length;

        const newReportId = `rep-${Date.now()}`;
        const newReport: SavedReport = {
            id: newReportId,
            name: name,
            createdAt: new Date().toISOString(),
            recordCount: recordCount,
            user_id: ownerId,
            data: {
                results: savingReportState.results || [],
                sourceFiles: [],
                bankStatementFile: null,
                spreadsheet: isSpreadsheet ? savingReportState.spreadsheetData : undefined
            }
        };

        setSavedReports(prev => [newReport, ...prev]);
        closeSaveReportModal();
        
        const { error } = await (supabase.from('saved_reports') as any).insert({
            id: newReport.id,
            name: newReport.name,
            record_count: newReport.recordCount,
            user_id: newReport.user_id,
            data: newReport.data as any
        });

        if (error) {
            setSavedReports(prev => prev.filter(r => r.id !== newReport.id));
            showToast('Erro ao salvar relatório.', 'error');
            return null;
        } else {
            showToast('Relatório criado!', 'success');
            return newReportId;
        }
    }, [savingReportState, user, showToast, closeSaveReportModal, savedReports.length]);

    const deleteOldReports = useCallback(async (dateThreshold: Date) => {
        if (!user) return;
        const ownerId = subscription.ownerId || user.id;
        const reportsToDelete = savedReports.filter(r => new Date(r.createdAt) < dateThreshold);
        if (reportsToDelete.length === 0) return;
        setSavedReports(prev => prev.filter(r => new Date(r.createdAt) >= dateThreshold));
        await supabase.from('saved_reports').delete().lt('created_at', dateThreshold.toISOString()).eq('user_id', ownerId);
        showToast(`${reportsToDelete.length} itens removidos.`, "success");
    }, [user, subscription.ownerId, savedReports, showToast]);

    const allHistoricalResults = useMemo(() => {
        let results = savedReports
            .filter(r => r.data && r.data.results)
            .flatMap(report => report.data!.results);
            
        if (subscription.role === 'member' && subscription.congregationIds?.length > 0) {
            results = results.filter(r =>
                subscription.congregationIds.includes(r.church?.id || r._churchId)
            );
        }
        
        return results;
    }, [savedReports, subscription.role, subscription.congregationIds]);

    return useMemo(() => ({
        savedReports, setSavedReports,
        maxSavedReports: MAX_REPORTS_PER_USER,
        searchFilters, setSearchFilters,
        isSearchFiltersOpen, openSearchFilters, closeSearchFilters, clearSearchFilters,
        savingReportState, openSaveReportModal, closeSaveReportModal, confirmSaveReport,
        updateSavedReportName, saveFilteredReport, overwriteSavedReport,
        deleteOldReports,
        allHistoricalResults
    }), [
        savedReports, searchFilters, isSearchFiltersOpen, savingReportState, allHistoricalResults,
        setSavedReports, setSearchFilters, openSearchFilters, closeSearchFilters, clearSearchFilters,
        openSaveReportModal, closeSaveReportModal, confirmSaveReport, updateSavedReportName, saveFilteredReport, overwriteSavedReport,
        deleteOldReports
    ]);
};