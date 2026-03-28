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

export const useReportManager = (effectiveUser: any | null, showToast: (msg: string, type: 'success' | 'error') => void) => {
    const { subscription, user: realUser } = useAuth();
    const userSuffix = effectiveUser ? `-${effectiveUser.id}` : '-guest';
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [searchFilters, setSearchFilters] = usePersistentState<SearchFilters>(`identificapix-search-filters${userSuffix}`, DEFAULT_SEARCH_FILTERS);
    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
    const [savingReportState, setSavingReportState] = useState<SavingReportState | null>(null);
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);

    const lastSavedPayloadRef = useRef<string>('');

    /**
     * 📥 CARGA INICIAL
     */
    useEffect(() => {
        let ignore = false;
        if (!effectiveUser) {
            setSavedReports([]);
            return;
        }

        const fetchReports = async () => {
            const ownerId = effectiveUser.id;
            if (!ownerId) return;

            try {
                let data: any[] | null = null;

                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                const response = await fetch(`/api/reference/data/${ownerId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const resData = await response.json();
                    if (ignore) return;
                    data = resData.reports || [];
                } else {
                    throw new Error("Falha ao buscar relatórios via API.");
                }

                if (data && !ignore) {
                    let hydrated: SavedReport[] = data.map((r: any) => ({
                        id: r.id,
                        name: r.name,
                        createdAt: r.created_at,
                        recordCount: r.record_count,
                        user_id: r.user_id,
                        data: r.data ? (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) : undefined
                    }));

                    if (subscription.role === 'member' && subscription.congregationIds?.length > 0) {
                        hydrated = hydrated.filter(report => {
                            // Se não temos os dados (modo otimizado), mantemos na lista para permitir a abertura
                            if (!report.data) return true;
                            if (!report.data.results?.length) return false;
                            return report.data.results.some(res =>
                                subscription.congregationIds.includes(res.church?.id || res._churchId)
                            );
                        });
                    }

                    if (!ignore) {
                        console.log(`[useReportManager] Recebidos ${hydrated.length} relatórios da API.`);
                        setSavedReports(hydrated);
                    }
                }
            } catch (err) {
                if (!ignore) {
                    console.error("[ReportManager] Erro ao carregar relatórios históricos:", err);
                }
            } finally {
                if (!ignore) setInitialDataLoaded(true);
            }
        };

        fetchReports();
        return () => { ignore = true; };
    }, [effectiveUser, subscription.ownerId, subscription.role, subscription.congregationIds]);

    /**
     * 🔴 TEMPO REAL (AJUSTE CIRÚRGICO)
     */
    useEffect(() => {
        if (!effectiveUser) return;

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
                            return prev.filter(r => r.id !== oldRecord.id);
                        }

                        // INSERT ou UPDATE
                        const parsed: SavedReport = {
                            id: newRecord.id,
                            name: newRecord.name,
                            createdAt: newRecord.created_at,
                            recordCount: newRecord.record_count,
                            user_id: newRecord.user_id,
                            data: typeof newRecord.data === 'string'
                                ? JSON.parse(newRecord.data)
                                : newRecord.data
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
    }, [effectiveUser]);

    const openSearchFilters = useCallback(() => setIsSearchFiltersOpen(true), []);
    const closeSearchFilters = useCallback(() => setIsSearchFiltersOpen(false), []);
    const clearSearchFilters = useCallback(() => setSearchFilters(DEFAULT_SEARCH_FILTERS), [setSearchFilters]);

    const updateSavedReportName = useCallback(async (reportId: string, newName: string) => {
        if(!effectiveUser) return;
        setSavedReports(prev => prev.map(r => r.id === reportId ? { ...r, name: newName } : r));
        const { error } = await (supabase.from('saved_reports') as any).update({ name: newName }).eq('id', reportId);
        if (error) showToast('Erro ao renomear relatório.', 'error');
        else showToast('Relatório renomeado.', 'success');
    }, [effectiveUser, showToast]);

    const overwriteSavedReport = useCallback(async (reportId: string, results: MatchResult[], spreadsheetData?: SpreadsheetData) => {
        if (!effectiveUser || !reportId) return;
        
        const existingReport = savedReports.find(r => r.id === reportId);
        const currentData = existingReport?.data || { results: [], sourceFiles: [], bankStatementFile: null };

        if ((!results || results.length === 0) && !spreadsheetData && !currentData.results && !currentData.spreadsheet) return;

        const currentPayload = JSON.stringify({ r: results?.length || 0, s: !!spreadsheetData });
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
    }, [effectiveUser, showToast, savedReports]);

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
        if (!savingReportState || !effectiveUser) return null;
        const reportUserId = realUser?.id || effectiveUser.id;
        
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
            user_id: reportUserId,
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
    }, [savingReportState, effectiveUser, realUser, showToast, closeSaveReportModal, savedReports.length]);

    const deleteOldReports = useCallback(async (dateThreshold: Date) => {
        if (!effectiveUser) return;
        const ownerId = subscription.ownerId || effectiveUser.id;
        const reportsToDelete = savedReports.filter(r => new Date(r.createdAt) < dateThreshold);
        if (reportsToDelete.length === 0) return;
        setSavedReports(prev => prev.filter(r => new Date(r.createdAt) >= dateThreshold));
        await supabase.from('saved_reports').delete().lt('created_at', dateThreshold.toISOString()).eq('user_id', ownerId);
        showToast(`${reportsToDelete.length} itens removidos.`, "success");
    }, [effectiveUser, subscription.ownerId, savedReports, showToast]);

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

    /**
     * ✅ AJUSTE CIRÚRGICO: Filtra os relatórios para mostrar apenas os do próprio usuário na lista de salvos
     */
    const userSavedReports = useMemo(() => {
        if (!realUser) return [];
        return savedReports.filter(r => r.user_id === realUser.id);
    }, [savedReports, realUser]);

    const fetchFullReportData = useCallback(async (reportId: string) => {
        if (!effectiveUser) return null;
        
        try {
            let rawData: any;

            if (subscription.role === 'owner') {
                const { data, error } = await supabase
                    .from('saved_reports')
                    .select('data')
                    .eq('id', reportId)
                    .eq('user_id', effectiveUser.id)
                    .single();

                if (error || !data) throw error || new Error("Relatório não encontrado");
                rawData = data.data;
            } else {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const ownerId = subscription.ownerId;

                const response = await fetch(`/api/reference/report/${reportId}?ownerId=${ownerId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) throw new Error("Falha ao buscar via API");
                const resData = await response.json();
                rawData = resData.data;
            }

            const parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            
            setSavedReports(prev => prev.map(r => 
                r.id === reportId ? { ...r, data: parsedData } : r
            ));
            
            return parsedData;
        } catch (err) {
            console.error("[ReportManager] Erro ao buscar dados completos:", err);
            return null;
        }
    }, [effectiveUser, subscription.ownerId, subscription.role]);

    return useMemo(() => ({
        savedReports, setSavedReports,
        fetchFullReportData,
        maxSavedReports: MAX_REPORTS_PER_USER,
        searchFilters, setSearchFilters,
        isSearchFiltersOpen, openSearchFilters, closeSearchFilters, clearSearchFilters,
        savingReportState, openSaveReportModal, closeSaveReportModal, confirmSaveReport,
        updateSavedReportName, saveFilteredReport, overwriteSavedReport,
        deleteOldReports,
        allHistoricalResults,
        userSavedReports,
        initialDataLoaded
    }), [
        savedReports, userSavedReports, searchFilters, isSearchFiltersOpen, savingReportState, allHistoricalResults,
        initialDataLoaded,
        setSavedReports, setSearchFilters, openSearchFilters, closeSearchFilters, clearSearchFilters,
        openSaveReportModal, closeSaveReportModal, confirmSaveReport, updateSavedReportName, saveFilteredReport, overwriteSavedReport,
        deleteOldReports
    ]);
};