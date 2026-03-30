import { useState, useMemo, useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { SavedReport, Language } from '../types';

export type SortKey = 'name' | 'createdAt' | 'recordCount';
export type SortDirection = 'asc' | 'desc';

export const useSavedReportsController = () => {
    const { 
        savedReports, 
        viewSavedReport, 
        openDeleteConfirmation, 
        updateSavedReportName, 
        maxSavedReports 
    } = useContext(AppContext);
    
    const { t, language } = useTranslation();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
        key: 'createdAt', 
        direction: 'desc' 
    });

    // Filtro e Ordenação
    const processedReports = useMemo(() => {
        let result = [...savedReports];

        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            result = result.filter(report =>
                report.name.toLowerCase().includes(lowerQ)
            );
        }

        result.sort((a, b) => {
            let valA: any = a[sortConfig.key];
            let valB: any = b[sortConfig.key];

            if (sortConfig.key === 'createdAt') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            }
            
            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [savedReports, searchQuery, sortConfig]);

    // Handlers
    const handleSort = useCallback((key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    }, []);

    const handleStartEdit = useCallback((report: SavedReport) => {
        setEditingReportId(report.id);
        setEditName(report.name);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingReportId(null);
        setEditName('');
    }, []);

    const handleSaveEdit = useCallback((reportId: string) => {
        if (editName.trim()) {
            updateSavedReportName(reportId, editName);
            setEditingReportId(null);
            setEditName('');
        }
    }, [editName, updateSavedReportName]);

    // Cálculo de Armazenamento
    const usagePercent = Math.min(100, (savedReports.length / maxSavedReports) * 100);
    let storageColor = "bg-emerald-500";
    if (usagePercent > 80) storageColor = "bg-red-500";
    else if (usagePercent > 50) storageColor = "bg-amber-500";

    const formatDate = useCallback((isoString: string, lang: Language) => {
        return new Date(isoString).toLocaleString(lang, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }, []);

    return {
        savedReports,
        processedReports,
        searchQuery,
        setSearchQuery,
        editingReportId,
        editName,
        setEditName,
        sortConfig,
        usagePercent,
        storageColor,
        maxSavedReports,
        language,
        t,
        handleSort,
        handleStartEdit,
        handleCancelEdit,
        handleSaveEdit,
        formatDate,
        viewSavedReport,
        openDeleteConfirmation
    };
};