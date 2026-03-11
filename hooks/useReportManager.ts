
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

export const useReportManager = (user: any | null, showToast: (msg: string, type: 'success' | 'error') => void) => {
    
    const userSuffix = user ? `-${user.id}` : '-guest';
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [searchFilters, setSearchFilters] = usePersistentState<SearchFilters>(`identificapix-search-filters${userSuffix}`, DEFAULT_SEARCH_FILTERS);
    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
    const [savingReportState, setSavingReportState] = useState<SavingReportState | null>(null);

    // Ref para evitar loops de salvamento repetidos com o mesmo dado
    const lastSavedPayloadRef = useRef<string>('');

    /**
     * 📥 CARGA INICIAL (REIDRATAÇÃO DO BACKEND)
     * Garante que ao recarregar a página, a lista de relatórios (e planilhas vinculadas) seja recuperada.
     */
    useEffect(() => {
        if (!user) {
            setSavedReports([]);
            return;
        }

        const fetchReports = async () => {
            try {
                const { data, error } = await supabase
                    .from('saved_reports')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                if (data) {
                    const hydrated: SavedReport[] = data.map(r => ({
                        id: r.id,
                        name: r.name,
                        createdAt: r.created_at,
                        recordCount: r.record_count,
                        user_id: r.user_id,
                        data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data
                    }));
                    setSavedReports(hydrated);
                }
            } catch (err) {
                console.error("[ReportManager] Erro ao carregar relatórios históricos:", err);
            }
        };

        fetchReports();
    }, [user]);

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

    /**
     * 🔐 PERSISTÊNCIA MESTRE (UPSERT COM MERGE)
     * Salva as alterações de uma planilha ou conciliação sem apagar os dados existentes do outro tipo.
     */
    const overwriteSavedReport = useCallback(async (reportId: string, results: MatchResult[], spreadsheetData?: SpreadsheetData) => {
        if (!user || !reportId) return;
        
        // Busca o estado atual local para merge (evita perda de dados em atualizações parciais)
        const existingReport = savedReports.find(r => r.id === reportId);
        const currentData = existingReport?.data || { results: [], sourceFiles: [], bankStatementFile: null };

        // Bloqueio de salvamento vazio: só impede se AMBOS forem inexistentes
        if ((!results || results.length === 0) && !spreadsheetData && !currentData.results && !currentData.spreadsheet) return;

        // Dedup: Evita salvar exatamente o mesmo dado que já foi enviado
        const currentPayload = JSON.stringify({ r: results?.length || 0, s: !!spreadsheetData });
        if (lastSavedPayloadRef.current === currentPayload + reportId) return;
        lastSavedPayloadRef.current = currentPayload + reportId;

        // Lógica de Merge: Preserva o que já existe se o novo for omitido
        const mergedData = {
            ...currentData,
            results: (results && results.length > 0) ? results : currentData.results,
            spreadsheet: spreadsheetData || currentData.spreadsheet
        };

        const recordCount = spreadsheetData?.rows ? spreadsheetData.rows.length : (mergedData.results?.length || 0);

        // Atualiza estado local de forma otimista
        setSavedReports(prev => prev.map(r => r.id === reportId ? {
            ...r,
            recordCount,
            data: mergedData
        } : r));

        // Persistência Cloud
        const { error } = await supabase
            .from('saved_reports')
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
    
    /**
     * CRIA NOVO REGISTRO
     * Retorna o ID gerado para que o controlador possa marcar como "Relatório Ativo".
     */
    const confirmSaveReport = useCallback(async (name: string): Promise<string | null> => {
        if (!savingReportState || !user) return null;
        
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
            user_id: user.id,
            data: {
                results: savingReportState.results || [],
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
            return null;
        } else {
            showToast('Relatório criado!', 'success');
            return newReportId;
        }
    }, [savingReportState, user, showToast, closeSaveReportModal, savedReports.length]);

    const deleteOldReports = useCallback(async (dateThreshold: Date) => {
        if (!user) return;
        const reportsToDelete = savedReports.filter(r => new Date(r.createdAt) < dateThreshold);
        if (reportsToDelete.length === 0) return;
        setSavedReports(prev => prev.filter(r => new Date(r.createdAt) >= dateThreshold));
        await supabase.from('saved_reports').delete().lt('created_at', dateThreshold.toISOString()).eq('user_id', user.id);
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
