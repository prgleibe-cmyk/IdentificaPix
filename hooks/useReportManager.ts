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
            if (!user?.id) return;

            // Para a API, precisamos do ownerId para passar na validação de permissão
            const apiOwnerId = subscription?.ownerId || user.id;
            const isOwner = subscription.ownerId === user?.id;
            let data: any[] = [];
            
            try {
                // Se for o dono (Owner), busca diretamente do Supabase (mais rápido)
                // Se for membro ou tiver outro papel, usa a API que resolve o compartilhamento
                if (isOwner) {
                    const { data: d, error } = await supabase
                        .from('saved_reports')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });

                    if (error) throw error;
                    if (ignore) return;
                    data = d || [];
                } else {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;

                    const response = await fetch(`/api/reference/data/${apiOwnerId}`, {
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
                                church_id: r.church_id,
                                data: parsedData
                            };
                        });

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
    }, [user?.id, subscription?.ownerId, subscription?.role, subscription?.congregationIds]);

    /**
     * 🔴 TEMPO REAL (APENAS ASSINATURA)
     */
    useEffect(() => {
        if (!user || !subscription.ownerId) return;

        const channel = supabase
            .channel('reports-realtime')
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'saved_reports',
                    filter: `user_id=eq.${subscription.ownerId || user.id}` 
                },
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
                            church_id: newRecord.church_id,
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
        if(!user?.id) return;
        const effectiveUserId = user.id;
        setSavedReports(prev => prev.map(r => r.id === reportId ? { ...r, name: newName } : r));
        const { error } = await (supabase.from('saved_reports') as any).update({ name: newName }).eq('id', reportId).eq('user_id', effectiveUserId);
        if (error) showToast('Erro ao renomear relatório.', 'error');
        else showToast('Relatório renomeado.', 'success');
    }, [user?.id, showToast]);

    const overwriteSavedReport = useCallback(async (reportId: string, results: MatchResult[], spreadsheetData?: SpreadsheetData) => {
        if (!user?.id || !reportId) return;
        
        const effectiveUserId = user.id;
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
            .eq('id', reportId)
            .eq('user_id', effectiveUserId);

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
        if (!savingReportState || !user?.id) return null;
        const effectiveUserId = user.id;
        
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
        const results = savingReportState.results || [];
        
        // Tenta pegar o ID da igreja de várias formas
        const firstChurchId = results[0]?.church?.id || results[0]?._churchId || (results[0]?.transaction as any)?.church_id;
        const allSameChurch = results.length > 0 && results.every(r => (r.church?.id || r._churchId || (r.transaction as any)?.church_id) === firstChurchId);
        
        // Lógica de atribuição de Igreja
        let churchId = null;
        const isSecondary = subscription.ownerId && subscription.ownerId !== user?.id;
        if (isSecondary) {
            churchId = subscription.congregationId || (subscription.congregationIds && subscription.congregationIds[0]);
        } else if (allSameChurch && firstChurchId) {
            churchId = firstChurchId;
        } else if (searchFilters.churchIds && searchFilters.churchIds.length === 1) {
            churchId = searchFilters.churchIds[0];
        }

        const newReport: SavedReport = {
            id: newReportId,
            name: name,
            createdAt: new Date().toISOString(),
            recordCount: recordCount,
            user_id: effectiveUserId,
            church_id: churchId,
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
            church_id: newReport.church_id,
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
        const effectiveUserId = subscription.ownerId || user.id;
        const reportsToDelete = savedReports.filter(r => new Date(r.createdAt) < dateThreshold);
        if (reportsToDelete.length === 0) return;
        setSavedReports(prev => prev.filter(r => new Date(r.createdAt) >= dateThreshold));
        await supabase.from('saved_reports').delete().lt('created_at', dateThreshold.toISOString()).eq('user_id', effectiveUserId);
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