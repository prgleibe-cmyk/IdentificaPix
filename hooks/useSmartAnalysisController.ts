
import React, { useState, useContext, useCallback, useMemo, useEffect, useRef } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { getAuthToken } from '../services/auth/authAdapter';
import { MatchResult, SpreadsheetData, ManualRow, ColumnDef } from '../types';
import { analysisProcessor, SortConfig } from '../services/analysisProcessor';
import { rankingService } from '../services/rankingService';
import { PLACEHOLDER_CHURCH, groupResultsByChurch } from '../services/processingService';

export const useSmartAnalysisController = () => {
    const { t } = useTranslation();
    const { 
        matchResults, setMatchResults, setReportPreviewData, setHasActiveSession,
        savedReports, openSaveReportModal, activeSpreadsheetData, activeReportId,
        setActiveReportId, overwriteSavedReport, churches, banks,
        user, subscription, fullMatchResults, reportData
    } = useContext(AppContext);
    const { showToast, setIsLoading } = useUI();

    // Todos os lançamentos consolidados/ativos disponíveis para apuração
    const effectiveRecords = useMemo(() => {
        if (matchResults && matchResults.length > 0) return matchResults;
        if (fullMatchResults && fullMatchResults.length > 0) return fullMatchResults;
        if (reportData && reportData.length > 0) return reportData.map((d: any) => d.raw || d);
        return [];
    }, [matchResults, fullMatchResults, reportData]);

    // Permissões e dados filtrados para usuários secundários
    const isSecondaryUser = Boolean(
        subscription?.ownerId && 
        subscription?.ownerId !== user?.id && 
        subscription?.role !== 'owner' && 
        subscription?.role !== 'admin' && 
        subscription?.role !== 'principal'
    );
    const allowedChurchIds = subscription?.churchIds || [];
    const allowedBankIds = subscription?.bankIds || [];

    const availableChurches = useMemo(() => {
        if (!churches) return [];
        if (isSecondaryUser && allowedChurchIds.length > 0) {
            return churches.filter((c: any) => allowedChurchIds.includes(c.id));
        }
        return churches;
    }, [churches, isSecondaryUser, allowedChurchIds]);

    const availableBanks = useMemo(() => {
        if (!banks) return [];
        if (isSecondaryUser && allowedBankIds.length > 0) {
            return banks.filter((b: any) => allowedBankIds.includes(b.id));
        }
        return banks;
    }, [banks, isSecondaryUser, allowedBankIds]);

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

    // Estados do Modal e Filtros do Ranking
    const [isRankingModalOpen, setIsRankingModalOpen] = useState(false);
    const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>([]);
    const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
    
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
            setIsDirty((manualRows || []).length > 0 || reportTitle !== 'Relatório Financeiro');
        }
    }, [manualRows, columns, reportTitle, reportLogo, signatures, getSnapshot, activeReportId]);

    const generateRankingFromData = useCallback((
        data: MatchResult[], 
        reportName: string,
        options?: { selectedChurchIds?: string[]; selectedBankIds?: string[] }
    ) => {
        setIsRankingLoading(true);
        setManualRows([]);
        setTimeout(() => {
            try {
                const { rows, columns: cols, title } = rankingService.generateRanking(
                    data, 
                    availableChurches, 
                    reportName,
                    {
                        selectedChurchIds: options?.selectedChurchIds,
                        selectedBankIds: options?.selectedBankIds,
                        banks: availableBanks
                    }
                );
                setColumns(cols);
                setManualRows(rows);
                setReportTitle(title);
                setActiveTemplate('ranking');
                if ((rows || []).length === 0) showToast("Nenhum dado encontrado para o ranking com os filtros selecionados.", "error");
            } catch (error) {
                showToast("Erro ao processar dados para o ranking.", "error");
            } finally { setIsRankingLoading(false); }
        }, 50); 
    }, [availableChurches, availableBanks, showToast]);

    const handleRankingClick = () => {
        setIsRankingModalOpen(true);
    };

    const handleConfirmRanking = async (config: {
        churchIds: string[];
        bankIds: string[];
        sourceType: 'session' | 'saved_report';
        selectedReportId?: string;
    }) => {
        setIsRankingModalOpen(false);
        setSelectedChurchIds(config.churchIds);
        setSelectedBankIds(config.bankIds);

        if (config.sourceType === 'saved_report' && config.selectedReportId) {
            const report = savedReports.find(r => r.id === config.selectedReportId);
            if (!report) {
                showToast("Relatório salvo não encontrado.", "error");
                return;
            }
            setIsLoading(true);
            try {
                let results = report.data?.results;
                let spreadsheet = report.data?.spreadsheet;

                if (!results && !spreadsheet) {
                    const token = await getAuthToken();
                    const ownerId = subscription.ownerId || user?.id;

                    const response = await fetch(`/api/reference/report/${report.id}?ownerId=${ownerId}`, {
                        method: 'GET',
                        cache: 'no-store',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        const resData = await response.json();
                        const rawData = resData.data;
                        let parsedData;
                        try {
                            parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                        } catch (error) {
                            console.error("JSON corrompido detectado:", error);
                            parsedData = { results: [], spreadsheet: null };
                        }
                        results = parsedData?.results;
                    }
                }

                if ((results || []).length > 0) {
                    setActiveReportId(report.id);
                    setHasActiveSession(true);
                    const hydrated = (results || []).map((r: any) => ({ 
                        ...r, 
                        church: (availableChurches || []).find((c: any) => c.id === (r.church?.id || r._churchId)) || r.church || PLACEHOLDER_CHURCH 
                    }));
                    setMatchResults(hydrated);
                    setReportPreviewData({
                        income: groupResultsByChurch((hydrated || []).filter((r: any) => r.transaction.amount > 0 || r.status === 'PENDENTE')),
                        expenses: { 'all_expenses_group': (hydrated || []).filter((r: any) => r.transaction.amount < 0) }
                    });
                    
                    generateRankingFromData(hydrated, report.name, {
                        selectedChurchIds: config.churchIds,
                        selectedBankIds: config.bankIds
                    });
                    showToast(`Ranking gerado a partir da planilha "${report.name}".`, "success");
                } else {
                    showToast("A planilha selecionada não contém lançamentos para apuração.", "error");
                }
            } catch (error) {
                showToast("Erro ao carregar dados da planilha.", "error");
            } finally {
                setIsLoading(false);
            }
        } else {
            // Origem: Lançamentos Ativos / Livro Caixa / Sessão
            const dataToUse = effectiveRecords;
            if (dataToUse.length > 0) {
                generateRankingFromData(dataToUse, activeReportId ? '' : 'Lançamentos Consolidados', {
                    selectedChurchIds: config.churchIds,
                    selectedBankIds: config.bankIds
                });
                showToast("Ranking gerado com sucesso.", "success");
            } else {
                showToast("Nenhum lançamento ativo encontrado para gerar o ranking.", "error");
            }
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
                const token = await getAuthToken();
                const ownerId = subscription.ownerId || user?.id;

                const response = await fetch(`/api/reference/report/${report.id}?ownerId=${ownerId}`, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const resData = await response.json();
                    const rawData = resData.data;
                    let parsedData;
                    try {
                        parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                    } catch (error) {
                        console.error("JSON corrompido detectado:", error);
                        parsedData = {
                            results: [],
                            spreadsheet: null
                        };
                    }
                    results = parsedData?.results;
                    spreadsheet = parsedData?.spreadsheet;
                }
            }

            if ((results || []).length > 0 || spreadsheet) {
                setActiveReportId(report.id);
                setHasActiveSession(true);

                if ((results || []).length > 0) {
                    const hydrated = (results || []).map((r: any) => ({ 
                        ...r, 
                        church: (availableChurches || []).find((c: any) => c.id === (r.church?.id || r._churchId)) || r.church || PLACEHOLDER_CHURCH 
                    }));
                    setMatchResults(hydrated);
                    setReportPreviewData({
                        income: groupResultsByChurch((hydrated || []).filter((r: any) => r.transaction.amount > 0 || r.status === 'PENDENTE')),
                        expenses: { 'all_expenses_group': (hydrated || []).filter((r: any) => r.transaction.amount < 0) }
                    });
                    
                    if (!spreadsheet) {
                        generateRankingFromData(hydrated, report.name, {
                            selectedChurchIds,
                            selectedBankIds
                        });
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
        handleSave, sortedRows, summaryData, savedReports, activeReportId, isDirty,
        // Novos estados e controles de Ranking por Caixas e Igrejas
        isRankingModalOpen, setIsRankingModalOpen,
        selectedChurchIds, setSelectedChurchIds,
        selectedBankIds, setSelectedBankIds,
        availableChurches, availableBanks,
        handleConfirmRanking,
        matchResults,
        effectiveRecords
    };
};
