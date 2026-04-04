import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { usePersistentState } from './usePersistentState';
import { SavedReport, SearchFilters, SavingReportState, MatchResult, SpreadsheetData } from '../types';

const getInitialDateRange = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return {
        start: thirtyDaysAgo.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
    };
};

const DEFAULT_SEARCH_FILTERS: SearchFilters = {
    dateRange: getInitialDateRange(),
    valueFilter: { operator: 'any', value1: null, value2: null },
    transactionType: 'all',
    reconciliationStatus: 'all',
    filterBy: 'none',
    churchIds: [],
    contributorName: '',
    reportId: null,
};

const MAX_REPORTS_PER_USER = 60;

export const useReportManager = (user: any | null, showToast: (msg: string, type: 'success' | 'error') => void, initialReports?: any[]) => {
    const { subscription } = useAuth();
    const effectiveUserId = subscription?.ownerId || user?.id;
    const userSuffix = user ? `-${user.id}` : '-guest';
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [searchFilters, setSearchFilters] = usePersistentState<SearchFilters>(`identificapix-search-filters${userSuffix}`, DEFAULT_SEARCH_FILTERS);

    // 🛡️ RESET DE FILTROS NO LOGIN: Garante que cada nova sessão comece com o padrão de 30 dias
    useEffect(() => {
        if (user?.id) {
            setSearchFilters(DEFAULT_SEARCH_FILTERS);
        }
    }, [user?.id, setSearchFilters]);

    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
    const [savingReportState, setSavingReportState] = useState<SavingReportState | null>(null);

    const lastSavedPayloadRef = useRef<string>('');

    /**
     * 📥 CARGA INICIAL
     */
    useEffect(() => {
        let ignore = false;
        if (!user || !effectiveUserId) {
            setSavedReports([]);
            return;
        }

        // Se já recebemos relatórios iniciais (ex: via useReferenceData no AppContext),
        // evitamos a chamada duplicada ao endpoint /api/reference/data/:ownerId
        if (initialReports && initialReports.length > 0) {
            const hydrated: SavedReport[] = initialReports.map((r: any) => ({
                id: r.id,
                name: r.name,
                createdAt: r.created_at || r.createdAt,
                recordCount: r.record_count || r.recordCount,
                user_id: r.user_id || r.userId,
                church_id: r.church_id || r.churchId,
                data: r.data || { results: [], spreadsheet: null }
            }));
            setSavedReports(hydrated);
            return;
        }

        const fetchReports = async () => {
            // Para a API, precisamos do ownerId para passar na validação de permissão
            const apiOwnerId = effectiveUserId;
            let data: any[] = [];
            
            try {
                // Agora sempre buscamos via API para centralizar a lógica no ReportService.js do backend
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                const response = await fetch(`/api/reference/data/${apiOwnerId}?limit=50&offset=0`, {
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

                if (data && !ignore) {
                    const hydrated: SavedReport[] = data.map((r: any) => ({
                        id: r.id,
                        name: r.name,
                        createdAt: r.created_at || r.createdAt,
                        recordCount: r.record_count || r.recordCount,
                        user_id: r.user_id || r.userId,
                        church_id: r.church_id || r.churchId,
                        data: r.data || { results: [], spreadsheet: null }
                    }));

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
    }, [user, effectiveUserId, initialReports]);

    /**
     * 🔴 TEMPO REAL (APENAS ASSINATURA)
     */
    useEffect(() => {
        const ownerId = subscription.ownerId || user?.id;
        if (!user || !ownerId) return;

        const channel = supabase
            .channel(`reports-realtime-${ownerId}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'saved_reports',
                    filter: `user_id=eq.${ownerId}` 
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
    }, [user, subscription.ownerId]);

    const openSearchFilters = useCallback(() => setIsSearchFiltersOpen(true), []);
    const closeSearchFilters = useCallback(() => setIsSearchFiltersOpen(false), []);
    const clearSearchFilters = useCallback(() => setSearchFilters(DEFAULT_SEARCH_FILTERS), [setSearchFilters]);

    const updateSavedReportName = useCallback(async (reportId: string, newName: string) => {
        if(!user?.id || !effectiveUserId) return;
        setSavedReports(prev => prev.map(r => r.id === reportId ? { ...r, name: newName } : r));
        const { error } = await (supabase.from('saved_reports') as any).update({ name: newName }).eq('id', reportId).eq('user_id', effectiveUserId);
        if (error) showToast('Erro ao renomear relatório.', 'error');
        else showToast('Relatório renomeado.', 'success');
    }, [user?.id, effectiveUserId, showToast]);

    const deleteReport = useCallback(async (reportId: string) => {
        if (!user?.id || !effectiveUserId) return;
        
        const { error } = await supabase.from('saved_reports').delete().eq('id', reportId).eq('user_id', effectiveUserId);
        if (error) {
            showToast('Erro ao excluir relatório.', 'error');
        } else {
            setSavedReports(prev => prev.filter(r => r.id !== reportId));
            showToast('Relatório excluído.', 'success');
        }
    }, [user?.id, effectiveUserId, showToast]);

    const overwriteSavedReport = useCallback(async (reportId: string, results: MatchResult[], spreadsheetData?: SpreadsheetData) => {
        if (!user?.id || !effectiveUserId || !reportId) return;
        
        const existingReport = savedReports.find(r => r.id === reportId);
        const currentData = existingReport?.data || { results: [], sourceFiles: [], bankStatementFile: null };

        if ((!results || (results || []).length === 0) && !spreadsheetData && !currentData.results && !currentData.spreadsheet) return;

        const currentPayload = JSON.stringify({ 
            r: (results || []).length, 
            s: !!spreadsheetData,
            // Fingerprint mais robusto para detectar mudanças em qualquer lugar da lista
            // Usamos uma amostragem maior e incluímos o total de confirmados para detectar mudanças rápidas
            f: (results || []).length > 100 
                ? `${(results || []).filter(r => r.isConfirmed).length}-${(results || []).filter(r => r.status === 'IDENTIFICADO').length}`
                : (results || []).map(r => `${r.status}-${r.isConfirmed}`).join('|')
        });
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
        if (!savingReportState || !user?.id || !effectiveUserId) return null;
        
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
    }, [savingReportState, user, effectiveUserId, showToast, closeSaveReportModal, savedReports.length, subscription, searchFilters]);

    const deleteOldReports = useCallback(async (dateThreshold: Date) => {
        if (!user || !effectiveUserId) return;
        const reportsToDelete = savedReports.filter(r => new Date(r.createdAt) < dateThreshold);
        if (reportsToDelete.length === 0) return;
        setSavedReports(prev => prev.filter(r => new Date(r.createdAt) >= dateThreshold));
        await supabase.from('saved_reports').delete().lt('created_at', dateThreshold.toISOString()).eq('user_id', effectiveUserId);
        showToast(`${reportsToDelete.length} itens removidos.`, "success");
    }, [user, effectiveUserId, savedReports, showToast]);

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
        deleteReport, deleteOldReports,
        allHistoricalResults
    }), [
        savedReports, searchFilters, isSearchFiltersOpen, savingReportState, allHistoricalResults,
        setSavedReports, setSearchFilters, openSearchFilters, closeSearchFilters, clearSearchFilters,
        openSaveReportModal, closeSaveReportModal, confirmSaveReport, updateSavedReportName, saveFilteredReport, overwriteSavedReport,
        deleteReport, deleteOldReports
    ]);
};