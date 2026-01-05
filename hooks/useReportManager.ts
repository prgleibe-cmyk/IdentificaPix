
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { usePersistentState } from './usePersistentState';
import { SavedReport, SearchFilters, SavingReportState, MatchResult } from '../types';
import { User } from '@supabase/supabase-js';

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
// Ajustado para 60 relatórios (Equivalente a 5 anos de histórico mensal).
const MAX_REPORTS_PER_USER = 60;

export const useReportManager = (user: User | null, showToast: (msg: string, type: 'success' | 'error') => void) => {
    
    // --- User Scoping for Local Storage ---
    const userSuffix = user ? `-${user.id}` : '-guest';

    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [searchFilters, setSearchFilters] = usePersistentState<SearchFilters>(`identificapix-search-filters${userSuffix}`, DEFAULT_SEARCH_FILTERS);
    
    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
    const [savingReportState, setSavingReportState] = useState<SavingReportState | null>(null);

    // --- Search Filters Actions ---
    const openSearchFilters = useCallback(() => setIsSearchFiltersOpen(true), []);
    const closeSearchFilters = useCallback(() => setIsSearchFiltersOpen(false), []);
    const clearSearchFilters = useCallback(() => setSearchFilters(DEFAULT_SEARCH_FILTERS), [setSearchFilters]);

    // --- Saved Reports Actions ---
    const updateSavedReportName = useCallback(async (reportId: string, newName: string) => {
        if(!user) return;
        setSavedReports(prev => prev.map(r => r.id === reportId ? { ...r, name: newName } : r));
        const { error } = await supabase.from('saved_reports').update({ name: newName }).eq('id', reportId);
        if (error) showToast('Erro ao renomear relatório.', 'error');
        else showToast('Relatório renomeado.', 'success');
    }, [user, showToast]);

    const updateSavedReportTransaction = useCallback(async (transactionId: string, updatedRow: MatchResult) => {
        if (!user) return;

        // Find the report containing the transaction
        const reportIndex = savedReports.findIndex(r => r.data?.results.some(res => res.transaction.id === transactionId));
        
        if (reportIndex === -1) return;

        const report = savedReports[reportIndex];
        if (!report.data) return;

        // Create updated results array
        const updatedResults = report.data.results.map(res => 
            res.transaction.id === transactionId ? updatedRow : res
        );

        // Update Local State
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

        // Update Supabase
        const { error } = await supabase
            .from('saved_reports')
            .update({ data: updatedReport.data as any }) // Cast to any to satisfy Json type
            .eq('id', report.id);

        if (error) {
            showToast('Erro ao atualizar relatório salvo.', 'error');
        } else {
            showToast('Relatório salvo atualizado.', 'success');
        }
    }, [user, savedReports, setSavedReports, showToast]);

    // NOVO: Sobrescreve um relatório inteiro (usado para salvar alterações da sessão)
    const overwriteSavedReport = useCallback(async (reportId: string, results: MatchResult[]) => {
        if (!user) return;

        const reportIndex = savedReports.findIndex(r => r.id === reportId);
        if (reportIndex === -1) return;

        const report = savedReports[reportIndex];
        
        const updatedReport: SavedReport = {
            ...report,
            recordCount: results.length,
            data: {
                results: results,
                sourceFiles: [], // Mantém limpo ou preserva se necessário (simplificado)
                bankStatementFile: null
            }
        };

        // Update Local State
        setSavedReports(prev => {
            const newReports = [...prev];
            newReports[reportIndex] = updatedReport;
            return newReports;
        });

        // Update Supabase
        const { error } = await supabase
            .from('saved_reports')
            .update({ 
                data: updatedReport.data as any,
                record_count: results.length 
            })
            .eq('id', reportId);

        if (error) {
            showToast('Erro ao salvar alterações.', 'error');
        } else {
            showToast('Alterações salvas com sucesso!', 'success');
        }
    }, [user, savedReports, setSavedReports, showToast]);

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
        
        // CHECK DE LIMITE DE ARMAZENAMENTO
        if (savedReports.length >= MAX_REPORTS_PER_USER) {
            showToast(`Limite de ${MAX_REPORTS_PER_USER} relatórios atingido. Exclua alguns antigos para salvar novos.`, 'error');
            closeSaveReportModal();
            return;
        }

        const newReport: SavedReport = {
            id: `rep-${Date.now()}`,
            name: name,
            createdAt: new Date().toISOString(),
            recordCount: savingReportState.results.length,
            user_id: user.id,
            data: {
                results: savingReportState.results,
                sourceFiles: [],
                bankStatementFile: null
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
            showToast('Erro ao salvar relatório no banco de dados.', 'error');
        } else {
            showToast('Relatório salvo com sucesso!', 'success');
        }
    }, [savingReportState, user, showToast, closeSaveReportModal, savedReports.length]);

    // Função para deletar relatórios antigos em massa
    const deleteOldReports = useCallback(async (dateThreshold: Date) => {
        if (!user) return;

        const reportsToDelete = savedReports.filter(r => new Date(r.createdAt) < dateThreshold);
        if (reportsToDelete.length === 0) {
            showToast("Nenhum relatório encontrado anterior a esta data.", "error");
            return;
        }

        // Optimistic UI Update
        setSavedReports(prev => prev.filter(r => new Date(r.createdAt) >= dateThreshold));

        const { error } = await supabase
            .from('saved_reports')
            .delete()
            .lt('created_at', dateThreshold.toISOString())
            .eq('user_id', user.id);

        if (error) {
            // Revert state (complex, requires refetching usually, but simplified here)
            showToast("Erro ao excluir relatórios no servidor.", "error");
        } else {
            showToast(`${reportsToDelete.length} relatórios antigos foram excluídos.`, "success");
        }
    }, [user, savedReports, showToast]);

    const allHistoricalResults = useMemo(() => {
        return savedReports
            .filter(r => r.data && r.data.results)
            .flatMap(report => report.data!.results);
    }, [savedReports]);

    return useMemo(() => ({
        savedReports, setSavedReports,
        maxSavedReports: MAX_REPORTS_PER_USER, // EXPOSED CONSTANT
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
