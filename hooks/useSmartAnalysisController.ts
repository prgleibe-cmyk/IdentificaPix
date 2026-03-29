
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
    
    // Estados para controle de alterações (Dirty State)
    const [isDirty, setIsDirty] = useState(false);
    const lastSavedData = useRef<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Função utilitária para capturar o estado atual da planilha em string
    const getSnapshot = useCallback(() => {
        return JSON.stringify({
            title: reportTitle,
            logo: reportLogo,
            cols: columns,
            rows: manualRows,
            sigs: signatures
        });
    }, [reportTitle, reportLogo, columns, manualRows, signatures]);

    // Efeito para carregar dados de um relatório salvo (Reidratação REAL)
    useEffect(() => {
        if (activeSpreadsheetData && activeReportId) {
            setManualRows(activeSpreadsheetData.rows || []);
            setColumns(activeSpreadsheetData.columns || analysisProcessor.createDefaultColumns());
            setReportTitle(activeSpreadsheetData.title || 'Relatório Financeiro');
            setSignatures(activeSpreadsheetData.signatures || ['Tesoureiro', 'Pastor Responsável']);
            setReportLogo(activeSpreadsheetData.logo || null);
            setActiveTemplate('manual_structure');
            
            // Define o ponto de referência para detecção de alterações
            lastSavedData.current = JSON.stringify({
                title: activeSpreadsheetData.title,
                logo: activeSpreadsheetData.logo,
                cols: activeSpreadsheetData.columns,
                rows: activeSpreadsheetData.rows,
                sigs: activeSpreadsheetData.signatures || []
            });
            setIsDirty(false);
        }
    }, [activeSpreadsheetData, activeReportId]);

    // Efeito para monitorar alterações e atualizar isDirty
    useEffect(() => {
        const current = getSnapshot();
        // Se temos um relatório ativo, comparamos com o último salvo
        if (activeReportId && lastSavedData.current) {
            setIsDirty(current !== lastSavedData.current);
        } else {
            // Se for planilha nova, consideramos dirty se houver conteúdo
            setIsDirty(manualRows.length > 0 || reportTitle !== 'Relatório Financeiro');
        }
    }, [manualRows, columns, reportTitle, reportLogo, signatures, getSnapshot, activeReportId]);

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
        lastSavedData.current = ''; 
        setIsDirty(false);
        showToast("Nova planilha criada.", "success");
    };

    const handleSelectReport = async (report: any) => {
        setShowReportSelector(false);
        setIsLoading(true);
        try {
            let results = report.data?.results;
            let spreadsheet = report.data?.spreadsheet;

            if (!results && !spreadsheet) {
                const { data } = await supabase.from('saved_reports').select('data').eq('id', report.id).single();
                const parsedData = typeof data?.data === 'string' ? JSON.parse(data.data) : data?.data;
                results = parsedData?.results;
                spreadsheet = parsedData?.spreadsheet;
            }

            if (results?.length > 0 || spreadsheet) {
                setActiveReportId(report.id);
                setHasActiveSession(true);

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
                    
                    if (!spreadsheet) {
                        generateRankingFromData(hydrated, report.name);
                    }
                }
                
                showToast(`Relatório "${report.name}" carregado.`, "success");
            } else { 
                showToast("Relatório vazio.", "error"); 
            }
        } catch (error: any) { 
            showToast("Erro ao processar relatório.", "error"); 
        } finally { setIsLoading(false); }
    };

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
        if (activeReportId) {
            if (!isDirty) return;
            
            overwriteSavedReport(activeReportId, [], data);
            lastSavedData.current = getSnapshot(); 
            setIsDirty(false);
        } else {
            openSaveReportModal({ type: 'spreadsheet', groupName: reportTitle, spreadsheetData: data, results: [] });
        }
    };

    const sortedRows = useMemo(() => analysisProcessor.sortRows(manualRows, sortConfig), [manualRows, sortConfig]);
    const summaryData = useMemo(() => analysisProcessor.calculateSummary(manualRows), [manualRows]);

    return {
        activeTemplate, setActiveTemplate, reportTitle, setReportTitle, reportLogo, signatures, setSignatures,
        manualRows, setManualRows, isRankingLoading, columns, setColumns, sortConfig, setSortConfig,
        sumModal, setSumModal, sumValue, setSumValue, showReportSelector, setShowReportSelector,
        fileInputRef, handleRankingClick, handleManualClick, handleSelectReport, handleLogoUpload,
        handleSave, sortedRows, summaryData, savedReports, activeReportId, isDirty
    };
};
