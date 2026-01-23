import React, { useState, useContext, useCallback, useMemo, useEffect, useRef } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { supabase } from '../services/supabaseClient';
import { MatchResult, SpreadsheetData, ManualRow, ColumnDef } from '../types';
import { analysisProcessor, SortConfig } from '../services/analysisProcessor';
import { rankingService } from '../services/rankingService';
import { PLACEHOLDER_CHURCH, groupResultsByChurch } from '../services/processingService';

export const useSmartAnalysisController = () => {
    const { t } = useTranslation();
    const { 
        matchResults, setMatchResults, setReportPreviewData, setHasActiveSession,
        savedReports, openSaveReportModal, activeSpreadsheetData, activeReportId,
        setActiveReportId, overwriteSavedReport, churches 
    } = useContext(AppContext);
    const { showToast, setIsLoading } = useUI();

    const [activeTemplate, setActiveTemplate] = useState<'ranking' | 'manual_structure'>('ranking');
    const [reportTitle, setReportTitle] = useState('Relatório Financeiro');
    const [reportLogo, setReportLogo] = useState<string | null>(null);
    const [signatures, setSignatures] = useState<string[]>(['Tesoureiro', 'Pastor Responsável']);
    const [manualRows, setManualRows] = useState<ManualRow[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(false);
    const [columns, setColumns] = useState<ColumnDef[]>(analysisProcessor.createDefaultColumns());
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [sumModal, setSumModal] = useState<{ isOpen: boolean, rowId: string, colId: string, currentValue: number } | null>(null);
    const [sumValue, setSumValue] = useState('');
    const [showReportSelector, setShowReportSelector] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (activeSpreadsheetData && activeReportId) {
            setManualRows(activeSpreadsheetData.rows);
            setColumns(activeSpreadsheetData.columns);
            setReportTitle(activeSpreadsheetData.title);
            setSignatures(activeSpreadsheetData.signatures || []);
            setReportLogo(activeSpreadsheetData.logo);
            setActiveTemplate('manual_structure');
        }
    }, [activeSpreadsheetData, activeReportId]);

    const generateRankingFromData = useCallback((data: MatchResult[], reportName: string) => {
        setIsRankingLoading(true);
        setManualRows([]);
        setTimeout(() => {
            try {
                const { rows, columns: cols, title } = rankingService.generateRanking(data, churches, reportName);
                setColumns(cols);
                setManualRows(rows);
                setReportTitle(title);
                setActiveTemplate('ranking');
                if (rows.length === 0) showToast("Relatório vazio ou sem dados para ranking.", "error");
            } catch (error) {
                showToast("Erro ao processar dados para o ranking.", "error");
            } finally { setIsRankingLoading(false); }
        }, 50); 
    }, [churches, showToast]);

    const handleRankingClick = () => {
        if (matchResults.length > 0) {
            generateRankingFromData(matchResults, activeReportId ? '' : 'Sessão Atual');
        } else {
            setShowReportSelector(true);
        }
    };

    const handleManualClick = () => {
        if (activeReportId) setActiveReportId(null);
        setActiveTemplate('manual_structure');
        setManualRows([]);
        setReportTitle("Relatório Manual");
        setColumns(analysisProcessor.createDefaultColumns());
        showToast("Nova planilha criada.", "success");
    };

    const handleSelectReport = async (report: any) => {
        setShowReportSelector(false);
        setIsLoading(true);
        try {
            let results = report.data?.results;
            if (!results) {
                const { data } = await supabase.from('saved_reports').select('data').eq('id', report.id).single();
                const parsedData = typeof data?.data === 'string' ? JSON.parse(data.data) : data?.data;
                results = parsedData?.results;
            }
            if (results?.length > 0) {
                const hydrated = results.map((r: any) => ({ 
                    ...r, 
                    church: churches.find((c: any) => c.id === (r.church?.id || r._churchId)) || r.church || PLACEHOLDER_CHURCH 
                }));
                setMatchResults(hydrated);
                setReportPreviewData({
                    income: groupResultsByChurch(hydrated.filter((r: any) => r.transaction.amount > 0 || r.status === 'PENDENTE')),
                    expenses: { 'all_expenses_group': hydrated.filter((r: any) => r.transaction.amount < 0) }
                });
                setActiveReportId(report.id);
                setHasActiveSession(true);
                generateRankingFromData(hydrated, report.name);
                showToast(`Relatório "${report.name}" carregado.`, "success");
            } else { showToast("Relatório vazio.", "error"); }
        } catch (error: any) { 
            showToast("Erro ao processar relatório.", "error"); 
        } finally { setIsLoading(false); }
    };

    // Fix: Added React to imports and typed event as React.ChangeEvent
    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setReportLogo(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSave = () => {
        const data: SpreadsheetData = { title: reportTitle, logo: reportLogo, columns, rows: manualRows, signatures };
        if (activeReportId) overwriteSavedReport(activeReportId, [], data);
        else openSaveReportModal({ type: 'spreadsheet', groupName: reportTitle, spreadsheetData: data, results: [] });
    };

    const sortedRows = useMemo(() => analysisProcessor.sortRows(manualRows, sortConfig), [manualRows, sortConfig]);
    const summaryData = useMemo(() => analysisProcessor.calculateSummary(manualRows), [manualRows]);

    return {
        activeTemplate, setActiveTemplate, reportTitle, setReportTitle, reportLogo, signatures, setSignatures,
        manualRows, setManualRows, isRankingLoading, columns, setColumns, sortConfig, setSortConfig,
        sumModal, setSumModal, sumValue, setSumValue, showReportSelector, setShowReportSelector,
        fileInputRef, handleRankingClick, handleManualClick, handleSelectReport, handleLogoUpload,
        handleSave, sortedRows, summaryData, savedReports, activeReportId
    };
};