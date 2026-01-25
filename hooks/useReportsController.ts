
import { useState, useMemo, useEffect, useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { MatchResult } from '../types';
import { ExportService } from '../services/ExportService';
import { filterByUniversalQuery } from '../services/processingService';

export type ReportCategory = 'general' | 'churches' | 'unidentified' | 'expenses';

export const useReportsController = () => {
    const { 
        reportPreviewData, 
        activeReportId, 
        saveCurrentReportChanges, 
        openSaveReportModal, 
        matchResults,
        updateReportData,
        runAiAutoIdentification
    } = useContext(AppContext);
    
    const { language } = useTranslation();
    const { setActiveView } = useUI();
    
    const [activeCategory, setActiveCategory] = useState<ReportCategory>('general');
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Sincronização de seleção automática ao trocar de categoria
    useEffect(() => {
        if (!reportPreviewData) return;

        if (activeCategory === 'general') {
            setSelectedReportId('general_all');
        } else if (activeCategory === 'churches') {
            const churchIds = Object.keys(reportPreviewData.income).filter(k => k !== 'unidentified').sort();
            if (churchIds.length > 0) {
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
    }, [activeCategory, reportPreviewData]);

    const churchList = useMemo(() => {
        if (!reportPreviewData?.income) return [];
        return Object.entries(reportPreviewData.income)
            .filter(([id]) => id !== 'unidentified')
            .map(([id, results]) => {
                const res = results as MatchResult[];
                return {
                    id,
                    name: res[0]?.church?.name || 'Igreja Desconhecida',
                    count: res.length,
                    total: res.reduce((sum, r) => sum + r.transaction.amount, 0)
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [reportPreviewData]);

    const counts = useMemo(() => {
        const general = reportPreviewData ? Object.values(reportPreviewData.income).flat().length : 0;
        const churchesCount = churchList.length;
        const pending = reportPreviewData?.income['unidentified']?.length || 0;
        const expenses = reportPreviewData?.expenses['all_expenses_group']?.length || 0;
        return { general, churches: churchesCount, pending, expenses };
    }, [churchList, reportPreviewData]);

    const activeData = useMemo(() => {
        if (!reportPreviewData) return [];
        let data: MatchResult[] = [];
        
        if (activeCategory === 'general') {
            data = (Object.values(reportPreviewData.income) as MatchResult[][]).flat();
        } else if (activeCategory === 'expenses') {
            data = reportPreviewData.expenses['all_expenses_group'] || [];
        } else if (selectedReportId) {
            data = reportPreviewData.income[selectedReportId] || [];
        }

        if (searchTerm.trim()) {
            data = data.filter(r => filterByUniversalQuery(r, searchTerm));
        }
        return data;
    }, [reportPreviewData, selectedReportId, activeCategory, searchTerm]);

    const sortedData = useMemo(() => {
        if (!sortConfig) return activeData;
        return [...activeData].sort((a, b) => {
            let valA: any, valB: any;
            const key = sortConfig.key;

            // Lógica Especial para Nome/Descrição (Smart Sort)
            if (key === 'contributor.name' || key === 'transaction.description') {
                valA = a.contributor?.name || a.contributor?.cleanedName || a.transaction.cleanedDescription || a.transaction.description || '';
                valB = b.contributor?.name || b.contributor?.cleanedName || b.transaction.cleanedDescription || b.transaction.description || '';
            } else if (key.includes('.')) {
                const parts = key.split('.');
                valA = parts.reduce((obj: any, k) => obj?.[k], a);
                valB = parts.reduce((obj: any, k) => obj?.[k], b);
            } else {
                valA = (a as any)[key];
                valB = (b as any)[key];
            }

            // Normalização segura para comparação
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
        const count = activeData.length;
        const total = activeData.reduce((sum, r) => sum + (r.status === 'PENDENTE' ? (r.contributorAmount || r.contributor?.amount || 0) : r.transaction.amount), 0);
        const autoTxs = activeData.filter(r => r.status === 'IDENTIFICADO' && r.matchMethod !== 'MANUAL');
        const manualTxs = activeData.filter(r => r.status === 'IDENTIFICADO' && r.matchMethod === 'MANUAL');
        const pendingTxs = activeData.filter(r => r.status === 'PENDENTE' || r.status === 'NÃO IDENTIFICADO');

        return { 
            count, total, 
            auto: autoTxs.length, autoValue: autoTxs.reduce((s, r) => s + r.transaction.amount, 0),
            manual: manualTxs.length, manualValue: manualTxs.reduce((s, r) => s + r.transaction.amount, 0),
            pending: pendingTxs.length, pendingValue: pendingTxs.reduce((s, r) => s + (r.status === 'PENDENTE' ? (r.contributorAmount || r.contributor?.amount || 0) : r.transaction.amount), 0)
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
        searchTerm, setSearchTerm,
        sortConfig, setSortConfig,
        handleSort,
        churchList, counts, activeSummary, sortedData,
        activeReportId, saveCurrentReportChanges, runAiAutoIdentification,
        handleDownload, handlePrint, handleSaveReport, updateReportData,
        setActiveView, reportPreviewData
    };
};
