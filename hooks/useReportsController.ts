import { useState, useMemo, useEffect, useContext, useCallback, useRef } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { MatchResult, ReconciliationStatus } from '../types';
import { ExportService } from '../services/ExportService';
import { consolidationService } from '../services/ConsolidationService';
import { filterByUniversalQuery, applyAdvancedFilters } from '../services/processingService';

export type ReportCategory = 'general' | 'churches' | 'unidentified' | 'expenses';

export const useReportsController = () => {
    const { 
        reportPreviewData, 
        activeReportId, 
        saveCurrentReportChanges, 
        openSaveReportModal, 
        matchResults,
        updateReportData,
        runAiAutoIdentification,
        searchFilters,
        selectedBankId,
        setSelectedBankId,
        bankList,
        hydrate,
        regenerateReportPreview
    } = useContext(AppContext);
    
    const { language } = useTranslation();
    const { setActiveView } = useUI();
    const { subscription, user } = useAuth();
    
    const [activeCategory, setActiveCategory] = useState<ReportCategory>('general');
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const syncHashRef = useRef<string>('');
    const isProcessingRef = useRef(false);
    const debounceRef = useRef<any>(null);
    const lastSyncTimeRef = useRef<number>(0);

    const stableKey = useMemo(() => {
        const currentTotal = (matchResults || []).length;
        const currentIdentified = (matchResults || []).filter(r => r.status === ReconciliationStatus.IDENTIFIED || r.status === ReconciliationStatus.RESOLVED).length;
        const currentConfirmed = (matchResults || []).filter(r => !!r.isConfirmed).length;
        const currentWithChurch = (matchResults || []).filter(r => r.church?.id && r.church.id !== 'unidentified').length;
        return `${currentTotal}-${currentIdentified}-${currentConfirmed}-${currentWithChurch}`;
    }, [matchResults]);

    // 🔄 SINCRONIZAÇÃO DO PREVIEW: Sempre que os resultados mudarem, o preview deve ser atualizado
    // Isso garante que ações de "Identificar" e "Confirmar" reflitam imediatamente no relatório
    useEffect(() => {
        if (matchResults && matchResults.length > 0 && regenerateReportPreview) {
            if (stableKey !== syncHashRef.current) {
                if (debounceRef.current) {
                    clearTimeout(debounceRef.current);
                }

                debounceRef.current = setTimeout(() => {
                    if (isProcessingRef.current) return;

                    const now = Date.now();
                    const timeSinceLastSync = now - lastSyncTimeRef.current;

                    // 🛡️ BLOQUEIO DE SINCRONIZAÇÃO REDUNDANTE DURANTE REALTIME ATIVO
                    // Se houve um sync há menos de 1.5 segundos, pulamos este para evitar tempestade de processamento
                    // Isso é essencial quando múltiplos deltas realtime chegam em sequência rápida
                    if (timeSinceLastSync < 1500) {
                        console.log("[useReportsController] Sync redundante bloqueado (sessão realtime ativa/estabilizada)");
                        return;
                    }

                    isProcessingRef.current = true;
                    console.log("[useReportsController] Sincronizando preview de relatório...");
                    syncHashRef.current = stableKey;
                    lastSyncTimeRef.current = now;
                    
                    try {
                        regenerateReportPreview(matchResults);
                    } catch (e) {
                        console.error("[useReportsController] Erro na sincronização do preview:", e);
                    } finally {
                        isProcessingRef.current = false;
                    }
                }, 800); // Janela de estabilização aumentada para 800ms
            }
        }
    }, [stableKey, regenerateReportPreview, matchResults]);

    // Forçar categoria para membros
    useEffect(() => {
        const isSecondary = subscription.ownerId && subscription.ownerId !== user?.id;
        if (isSecondary && subscription.congregationIds && (subscription.congregationIds || []).length > 0) {
            setActiveCategory('churches');
            if (!selectedReportId || !(subscription.congregationIds || []).includes(selectedReportId)) {
                setSelectedReportId(subscription.congregationIds[0]);
            }
        }
    }, [subscription, selectedReportId, user?.id]);

    useEffect(() => {
        if (!reportPreviewData) return;
        
        const isSecondary = subscription.ownerId && subscription.ownerId !== user?.id;
        // Se for membro, garante que está na categoria correta e com uma igreja válida
        if (isSecondary && subscription.congregationIds && (subscription.congregationIds || []).length > 0) {
            setActiveCategory('churches');
            if (!selectedReportId || !(subscription.congregationIds || []).includes(selectedReportId)) {
                setSelectedReportId(subscription.congregationIds[0]);
            }
            return;
        }

        if (activeCategory === 'general') {
            setSelectedReportId('general_all');
        } else if (activeCategory === 'churches') {
            const incomeData = reportPreviewData.income || {};
            const churchIds = Object.keys(incomeData).filter(k => k !== 'unidentified').sort();
            if ((churchIds || []).length > 0) {
                if (!selectedReportId || !churchIds.includes(selectedReportId) || selectedReportId === 'general_all') {
                    setSelectedReportId(churchIds[0]);
                }
            } else {
                setSelectedReportId(null);
            }
        } else if (activeCategory === 'unidentified') {
            setSelectedReportId('unidentified');
        } else if (activeCategory === 'expenses') {
            setSelectedReportId('all_expenses_group');
        }
    }, [activeCategory, reportPreviewData, subscription]);

    const churchList = useMemo(() => {
        if (!reportPreviewData?.income) return [];
        let entries = Object.entries(reportPreviewData.income)
            .filter(([id]) => id !== 'unidentified');
            
        const isSecondary = subscription.ownerId && subscription.ownerId !== user?.id;
        if (isSecondary && subscription.congregationIds && (subscription.congregationIds || []).length > 0) {
            entries = entries.filter(([id]) => (subscription.congregationIds || []).includes(id));
        }

        return entries.map(([id, results]) => {
                const res = Array.isArray(results) ? results : [];
                return {
                    id,
                    name: res[0]?.church?.name || 'Igreja Desconhecida',
                    count: (res || []).length,
                    total: res.reduce((sum, r) => sum + (r.transaction?.amount || 0), 0)
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [reportPreviewData, subscription]);

    const counts = useMemo(() => {
        const incomeGroups = reportPreviewData?.income || {};
        
        const isSecondary = subscription.ownerId && subscription.ownerId !== user?.id;
        if (isSecondary && subscription.congregationIds && (subscription.congregationIds || []).length > 0) {
            return { 
                general: 0, 
                churches: (subscription.congregationIds || []).length, 
                pending: 0, 
                expenses: 0 
            };
        }

        const general = (Object.values(incomeGroups).flat() || []).length;
        const churchesCount = (churchList || []).length;
        const pending = (incomeGroups['unidentified'] || []).length;
        const expenses = (reportPreviewData?.expenses?.['all_expenses_group'] || []).length;
        return { general, churches: churchesCount, pending, expenses };
    }, [churchList, reportPreviewData, subscription]);

    const activeData = useMemo(() => {
        if (!reportPreviewData) return [];
        let data: MatchResult[] = [];
        
        try {
            const isSecondary = subscription.ownerId && subscription.ownerId !== user?.id;
            // 1. Seleção da base por categoria com trava de segurança para membros
            if (isSecondary && subscription.congregationIds && (subscription.congregationIds || []).length > 0) {
                if (selectedReportId && (subscription.congregationIds || []).includes(selectedReportId)) {
                    data = reportPreviewData.income?.[selectedReportId] || [];
                } else {
                    data = reportPreviewData.income?.[subscription.congregationIds[0]] || [];
                }
            } else if (activeCategory === 'general') {
                const incomeGroups = reportPreviewData.income || {};
                data = (Object.values(incomeGroups) as MatchResult[][]).flat();
            } else if (activeCategory === 'expenses') {
                data = reportPreviewData.expenses?.['all_expenses_group'] || [];
            } else if (selectedReportId) {
                data = reportPreviewData.income?.[selectedReportId] || [];
            }

            // 1.5 Filtro por Banco (Global)
            if (selectedBankId && selectedBankId !== 'all') {
                data = data.filter(r => String(r.transaction?.bank_id) === selectedBankId);
            } else if (isSecondary && subscription.bankIds && (subscription.bankIds || []).length > 0) {
                // Se for "Todos os Bancos", mas o usuário tem restrição, filtra pelos autorizados
                data = (data || []).filter(r => (subscription.bankIds || []).includes(String(r.transaction?.bank_id)));
            }

            // 2. Aplicação de Filtros Avançados (Modal)
            // Filtro de Período (DateRange) - Aplicado explicitamente na camada de renderização
            if (searchFilters.dateRange && (searchFilters.dateRange.start || searchFilters.dateRange.end)) {
                const start = searchFilters.dateRange.start ? new Date(searchFilters.dateRange.start).getTime() : null;
                const end = searchFilters.dateRange.end ? new Date(searchFilters.dateRange.end).getTime() + 86400000 : null;
                
                data = data.filter(r => {
                    const dateStr = r.status === 'PENDENTE' ? (r.contributor?.date || r.transaction?.date) : r.transaction?.date;
                    if (!dateStr) return true;
                    
                    // Normalização básica para garantir comparação de data pura
                    const itemDate = new Date(dateStr.split('T')[0]).getTime();
                    if (start && itemDate < start) return false;
                    if (end && itemDate >= end) return false;
                    return true;
                });
            }

            // Outros filtros avançados
            if (searchFilters) {
                data = applyAdvancedFilters(data, searchFilters);
            }

            // 3. Aplicação do Filtro de Busca Rápida (Texto)
            if (searchTerm && searchTerm.trim()) {
                data = data.filter(r => filterByUniversalQuery(r, searchTerm));
            }
        } catch (e) {
            console.error("[useReportsController] Erro ao processar activeData:", e);
        }
        
        // Fallback absoluto para garantir que nunca seja undefined
        return Array.isArray(data) ? data : [];
    }, [reportPreviewData, selectedReportId, activeCategory, searchTerm, searchFilters, selectedBankId, subscription]);

    const sortedData = useMemo(() => {
        const source = Array.isArray(activeData) ? activeData : [];
        if ((source || []).length === 0) return [];
        if (!sortConfig) return source;

        return [...source].sort((a, b) => {
            let valA: any, valB: any;
            const key = sortConfig.key;

            if (key === 'contributor.name' || key === 'transaction.description') {
                valA = a.contributor?.name || a.contributor?.cleanedName || a.transaction?.cleanedDescription || a.transaction?.description || '';
                valB = b.contributor?.name || b.contributor?.cleanedName || b.transaction?.cleanedDescription || b.transaction?.description || '';
            } else if (key.includes('.')) {
                const parts = key.split('.');
                valA = parts.reduce((obj: any, k) => obj?.[k], a);
                valB = parts.reduce((obj: any, k) => obj?.[k], b);
            } else {
                valA = (a as any)[key];
                valB = (b as any)[key];
            }

            valA = (valA ?? ''); 
            valB = (valB ?? '');
            
            if (typeof valA === 'string' && typeof valB === 'string') { 
                valA = valA.toLowerCase(); 
                valB = valB.toLowerCase(); 
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [activeData, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const activeSummary = useMemo(() => {
        if (!Array.isArray(activeData)) {
            return { count: 0, total: 0, auto: 0, autoValue: 0, manual: 0, manualValue: 0, pending: 0, pendingValue: 0 };
        }

        const total = activeData.reduce((sum, r) => sum + (r.status === 'PENDENTE' ? (r.contributorAmount || 0) : (r.transaction?.amount || 0)), 0);
        const autoTxs = activeData.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod || r.matchMethod === 'TEMPLATE'));
        const manualTxs = activeData.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));
        const pendingTxs = activeData.filter(r => r.status === 'PENDENTE' || r.status === 'NÃO IDENTIFICADO');

        return { 
            count: (activeData || []).length, total, 
            auto: (autoTxs || []).length, autoValue: autoTxs.reduce((s, r) => s + (r.transaction?.amount || 0), 0),
            manual: (manualTxs || []).length, manualValue: manualTxs.reduce((s, r) => s + (r.transaction?.amount || 0), 0),
            pending: (pendingTxs || []).length, pendingValue: pendingTxs.reduce((s, r) => s + (r.status === 'PENDENTE' ? (r.contributorAmount || 0) : (r.transaction?.amount || 0)), 0)
        };
    }, [activeData]);

    const handleDownload = () => ExportService.downloadCsv(sortedData, `relatorio_${new Date().toISOString().slice(0,10)}.csv`);
    
    const handlePrint = () => {
        const title = activeCategory === 'general' ? 'Relatório Geral' : activeCategory === 'churches' ? (churchList.find(c => c.id === selectedReportId)?.name || 'Relatório') : activeCategory === 'unidentified' ? 'Pendentes' : 'Saídas';
        ExportService.printHtml(sortedData, title, activeSummary, language);
    };

    const handleSaveReport = () => openSaveReportModal({ type: 'global', results: matchResults, groupName: 'Geral' });

    return {
        activeCategory, setActiveCategory,
        selectedReportId, setSelectedReportId,
        selectedBankId, setSelectedBankId,
        searchTerm, setSearchTerm,
        sortConfig, setSortConfig,
        handleSort,
        churchList, bankList, counts, activeSummary, sortedData,
        activeReportId, saveCurrentReportChanges, runAiAutoIdentification,
        handleDownload, handlePrint, handleSaveReport, updateReportData,
        setActiveView, reportPreviewData,
        searchFilters
    };
};