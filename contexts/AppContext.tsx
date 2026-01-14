
import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { useReferenceData } from '../hooks/useReferenceData';
import { useReportManager } from '../hooks/useReportManager';
import { useReconciliation } from '../hooks/useReconciliation';
import { 
    Bank, Church, MatchResult, Transaction, 
    DeletingItem, SpreadsheetData, SavingReportState 
} from '../types';
import { supabase } from '../services/supabaseClient';
import { consolidationService } from '../services/ConsolidationService';
import { groupResultsByChurch, PLACEHOLDER_CHURCH } from '../services/processingService';

interface AppContextType {
    // Reference Data
    banks: Bank[];
    churches: Church[];
    fileModels: any[];
    similarityLevel: number;
    setSimilarityLevel: (val: number) => void;
    dayTolerance: number;
    setDayTolerance: (val: number) => void;
    customIgnoreKeywords: string[];
    addIgnoreKeyword: (k: string) => void;
    removeIgnoreKeyword: (k: string) => void;
    contributionKeywords: string[];
    addContributionKeyword: (k: string) => void;
    removeContributionKeyword: (k: string) => void;
    learnedAssociations: any[];
    learnAssociation: (match: MatchResult) => Promise<void>;
    
    editingBank: Bank | null;
    openEditBank: (b: Bank) => void;
    closeEditBank: () => void;
    updateBank: (id: string, name: string) => Promise<void>;
    addBank: (name: string) => Promise<boolean>;
    
    editingChurch: Church | null;
    openEditChurch: (c: Church) => void;
    closeEditChurch: () => void;
    updateChurch: (id: string, data: any) => Promise<void>;
    addChurch: (data: any) => Promise<boolean>;

    fetchModels: () => Promise<void>;

    // Report Manager
    savedReports: any[];
    maxSavedReports: number;
    searchFilters: any;
    setSearchFilters: (filters: any) => void;
    clearSearchFilters: () => void;
    isSearchFiltersOpen: boolean;
    openSearchFilters: () => void;
    closeSearchFilters: () => void;
    savingReportState: SavingReportState | null;
    openSaveReportModal: (state: SavingReportState) => void;
    closeSaveReportModal: () => void;
    confirmSaveReport: (name: string) => Promise<void>;
    updateSavedReportName: (id: string, name: string) => Promise<void>;
    saveFilteredReport: (results: MatchResult[]) => void;
    overwriteSavedReport: (id: string, results: MatchResult[], spreadsheet?: SpreadsheetData) => Promise<void>;
    deleteOldReports: (date: Date) => Promise<void>;
    allHistoricalResults: MatchResult[];
    
    // Reconciliation
    activeBankFiles: { bankId: string, content: string, fileName: string, processedTransactions?: Transaction[] }[]; 
    selectedBankIds: string[]; 
    toggleBankSelection: (bankId: string) => void; 
    bankStatementFile: any; // Deprecated check
    setBankStatementFile: React.Dispatch<React.SetStateAction<{ bankId: string, content: string, fileName: string, processedTransactions?: Transaction[] }[]>>; // RAW SETTER EXPOSED
    
    contributorFiles: any[];
    matchResults: MatchResult[];
    setMatchResults: (results: MatchResult[]) => void;
    reportPreviewData: any;
    setReportPreviewData: (data: any) => void;
    hasActiveSession: boolean;
    setHasActiveSession: (active: boolean) => void;
    activeReportId: string | null;
    setActiveReportId: (id: string | null) => void;
    
    handleStatementUpload: (content: string, name: string, id: string, file: File) => void;
    handleContributorsUpload: (content: string, name: string, id: string, file?: File) => void;
    removeBankStatementFile: (bankId?: string) => void; 
    removeContributorFile: (id: string) => void;
    handleCompare: () => Promise<void>;
    updateReportData: (row: MatchResult, type: 'income' | 'expenses', idToRemove?: string) => void;
    resetReconciliation: () => void;
    isCompareDisabled: boolean;
    comparisonType: any;
    setComparisonType: (type: any) => void;

    // Manual Identification / Modals
    manualIdentificationTx: Transaction | null;
    bulkIdentificationTxs: Transaction[] | null;
    openManualIdentify: (id: string) => void;
    closeManualIdentify: () => void;
    confirmManualIdentification: (txId: string, churchId: string) => void;
    confirmBulkManualIdentification: (txIds: string[], churchId: string) => void;

    manualMatchState: any;
    openManualMatchModal: (record: MatchResult) => void;
    closeManualMatchModal: () => void;
    confirmManualAssociation: (tx: Transaction) => void;

    divergenceConfirmation: any;
    openDivergenceModal: (match: MatchResult) => void;
    closeDivergenceModal: () => void;
    confirmDivergence: (match: MatchResult) => void;
    rejectDivergence: (match: MatchResult) => void;

    // UI States
    initialDataLoaded: boolean;
    deletingItem: DeletingItem | null;
    openDeleteConfirmation: (item: DeletingItem) => void;
    closeDeleteConfirmation: () => void;
    confirmDeletion: () => void;

    isPaymentModalOpen: boolean;
    openPaymentModal: () => void;
    closePaymentModal: () => void;

    isRecompareModalOpen: boolean;
    openRecompareModal: () => void;
    closeRecompareModal: () => void;

    pendingTraining: any;
    setPendingTraining: (val: any) => void;
    handleTrainingSuccess: (model: any, data: any) => void;
    openLabManually: (file?: any) => void;

    smartEditTarget: MatchResult | null;
    openSmartEdit: (target: MatchResult) => void;
    closeSmartEdit: () => void;
    saveSmartEdit: (updated: MatchResult) => void;

    isUpdateFilesModalOpen: boolean;
    openUpdateFilesModal: () => void;
    closeUpdateFilesModal: () => void;

    isSyncing: boolean;
    
    // View Saved Report
    viewSavedReport: (id: string) => Promise<void>;
    activeSpreadsheetData: SpreadsheetData | null;
    setActiveSpreadsheetData: (data: SpreadsheetData | null) => void;
    
    summary: any;
    
    loadingAiId: string | null;
    handleAnalyze: (tx: Transaction, contributors: any[]) => void;
    aiSuggestion: any;

    handleGmailSyncSuccess: (transactions: Transaction[]) => void;
    
    effectiveIgnoreKeywords: string[];
    saveCurrentReportChanges: () => void;
    
    undoIdentification: (transactionId: string) => void;
    findMatchResult: (transactionId: string) => MatchResult | undefined;
}

export const AppContext = createContext<AppContextType>(null!);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, systemSettings } = useAuth();
    const { showToast, setIsLoading, setActiveView } = useUI();
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    
    // UI State for Modals
    const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isRecompareModalOpen, setIsRecompareModalOpen] = useState(false);
    const [smartEditTarget, setSmartEditTarget] = useState<MatchResult | null>(null);
    const [isUpdateFilesModalOpen, setIsUpdateFilesModalOpen] = useState(false);
    const [activeSpreadsheetData, setActiveSpreadsheetData] = useState<SpreadsheetData | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // --- Hooks ---
    const referenceData = useReferenceData(user, showToast);
    const reportManager = useReportManager(user, showToast);
    
    const effectiveIgnoreKeywords = useMemo(() => {
        const adminKeywords = systemSettings?.globalIgnoreKeywords || [];
        const userKeywords = referenceData.customIgnoreKeywords || [];
        return Array.from(new Set([...userKeywords, ...adminKeywords]));
    }, [referenceData.customIgnoreKeywords, systemSettings]);

    const reconciliation = useReconciliation({
        user,
        churches: referenceData.churches,
        banks: referenceData.banks,
        fileModels: referenceData.fileModels,
        similarityLevel: referenceData.similarityLevel,
        dayTolerance: referenceData.dayTolerance,
        customIgnoreKeywords: effectiveIgnoreKeywords, 
        contributionKeywords: referenceData.contributionKeywords,
        learnedAssociations: referenceData.learnedAssociations,
        showToast,
        setIsLoading,
        setActiveView
    });

    // --- FETCH DE DADOS E HIDRATAÇÃO ---
    useEffect(() => {
        if (!user) {
            setInitialDataLoaded(true);
            return;
        }
        
        const fetchData = async () => {
            setIsSyncing(true);
            try {
                // 1. DADOS ESSENCIAIS (Bancos, Igrejas, Relatórios)
                const [churchesRes, banksRes, reportsRes] = await Promise.all([
                    supabase.from('churches').select('*').order('name'),
                    supabase.from('banks').select('*').order('name'),
                    supabase.from('saved_reports')
                        .select('id, name, created_at, record_count, user_id') 
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false }),
                ]);

                if (churchesRes.data) referenceData.setChurches(churchesRes.data as any);
                if (banksRes.data) referenceData.setBanks(banksRes.data as any);
                if (reportsRes.data) {
                    reportManager.setSavedReports((reportsRes.data || []).map(r => ({ 
                        id: r.id, 
                        name: r.name, 
                        createdAt: r.created_at, 
                        recordCount: r.record_count, 
                        user_id: r.user_id, 
                        data: null 
                    })));
                }

                // 2. TENTATIVA DE RECUPERAÇÃO DA LISTA VIVA (Multi-Banco)
                try {
                    const pendingTxs = await consolidationService.getPendingTransactions(user.id);
                    
                    if (pendingTxs && pendingTxs.length > 0) {
                        console.log(`[Hydration] Recuperando ${pendingTxs.length} transações vivas do banco.`);
                        
                        // Agrupa transações por bank_id
                        const txsByBank: Record<string, Transaction[]> = {};
                        const defaultBankId = banksRes.data && banksRes.data.length > 0 ? banksRes.data[0].id : 'active-session-bank';

                        pendingTxs.forEach(dbTx => {
                            // Se não tiver bank_id, joga no primeiro banco disponível ou default
                            const targetBank = dbTx.bank_id || defaultBankId;
                            
                            if (!txsByBank[targetBank]) txsByBank[targetBank] = [];
                            
                            txsByBank[targetBank].push({
                                id: dbTx.id,
                                date: dbTx.transaction_date,
                                amount: dbTx.amount,
                                description: dbTx.description,
                                cleanedDescription: dbTx.description, 
                                contributionType: dbTx.type,
                                originalAmount: String(dbTx.amount)
                            });
                        });

                        // Reconstrói o estado activeBankFiles
                        // Nota: Como não salvamos o conteúdo bruto no DB para economizar,
                        // reconstruímos um "conteúdo virtual" para fins de visualização se necessário.
                        const reconstructedFiles = Object.entries(txsByBank).map(([bankId, transactions]) => {
                            const virtualContent = transactions
                                .map(t => `${t.date};${t.description};${t.amount};${t.contributionType}`)
                                .join('\n');
                            
                            // Tenta achar o nome do banco
                            const bankName = banksRes.data?.find(b => b.id === bankId)?.name || 'Banco Desconhecido';

                            return {
                                bankId,
                                content: virtualContent,
                                fileName: `Sessão Ativa (${bankName})`,
                                processedTransactions: transactions
                            };
                        });

                        // Atualiza o estado no hook de reconciliação
                        // Precisamos usar o setter exposto pelo hook modificado
                        reconciliation.setBankStatementFile(reconstructedFiles as any); 

                        // Pré-seleciona todos os bancos recuperados
                    }
                } catch (dbError) {
                    console.warn("[Hydration] Falha ao carregar Lista Viva:", dbError);
                }

            } catch (err) { 
                console.error('Critical sync failed', err); 
            } finally { 
                setIsSyncing(false); 
                setInitialDataLoaded(true);
            }
        };
        
        fetchData();
    }, [user?.id]);

    // --- Actions ---

    const openDeleteConfirmation = useCallback((item: DeletingItem) => setDeletingItem(item), []);
    const closeDeleteConfirmation = useCallback(() => setDeletingItem(null), []);

    const confirmDeletion = useCallback(async () => {
        if (!deletingItem) return;
        
        try {
            switch(deletingItem.type) {
                case 'bank':
                    referenceData.setBanks(prev => prev.filter(b => b.id !== deletingItem.id));
                    if (user) await supabase.from('banks').delete().eq('id', deletingItem.id);
                    break;
                case 'church':
                    referenceData.setChurches(prev => prev.filter(c => c.id !== deletingItem.id));
                    if (user) await supabase.from('churches').delete().eq('id', deletingItem.id);
                    break;
                case 'report-saved':
                    reportManager.setSavedReports(prev => prev.filter(r => r.id !== deletingItem.id));
                    if (user) await supabase.from('saved_reports').delete().eq('id', deletingItem.id);
                    break;
                case 'report-row':
                    reconciliation.setMatchResults(prev => prev.filter(r => r.transaction.id !== deletingItem.id));
                    const newResults = reconciliation.matchResults.filter(r => r.transaction.id !== deletingItem.id);
                    reconciliation.setReportPreviewData({
                        income: groupResultsByChurch(newResults.filter(r => r.transaction.amount > 0 || r.status === 'PENDENTE')),
                        expenses: { 'all_expenses_group': newResults.filter(r => r.transaction.amount < 0) }
                    });
                    break;
                case 'uploaded-files':
                    reconciliation.clearFiles();
                    break;
                case 'match-results':
                    reconciliation.setMatchResults([]);
                    reconciliation.setReportPreviewData(null);
                    reconciliation.setHasActiveSession(false);
                    reconciliation.setActiveReportId(null);
                    break;
                case 'learned-associations':
                    referenceData.setLearnedAssociations([]);
                    if (user) await supabase.from('learned_associations').delete().eq('user_id', user.id);
                    break;
                case 'all-data':
                    referenceData.setBanks([]);
                    referenceData.setChurches([]);
                    referenceData.setLearnedAssociations([]);
                    reconciliation.resetReconciliation();
                    if (user) {
                        await supabase.from('banks').delete().eq('user_id', user.id);
                        await supabase.from('churches').delete().eq('user_id', user.id);
                        await supabase.from('learned_associations').delete().eq('user_id', user.id);
                    }
                    break;
            }
            showToast("Item excluído com sucesso.", "success");
        } catch (e) {
            console.error(e);
            showToast("Erro ao excluir item.", "error");
        } finally {
            setDeletingItem(null);
        }
    }, [deletingItem, referenceData, reportManager, reconciliation, user, showToast]);

    // Manual Identification
    const openManualIdentify = useCallback((id: string) => {
        const result = reconciliation.matchResults.find(r => r.transaction.id === id);
        if (result) {
            reconciliation.setManualIdentificationTx(result.transaction);
        }
    }, [reconciliation.matchResults, reconciliation.setManualIdentificationTx]);

    const confirmManualIdentification = useCallback(async (txId: string, churchId: string) => {
        const church = referenceData.churches.find(c => c.id === churchId);
        if (!church) return;

        const result = reconciliation.matchResults.find(r => r.transaction.id === txId);
        if (result) {
            const updated: MatchResult = {
                ...result,
                status: 'IDENTIFICADO',
                church,
                matchMethod: 'MANUAL',
                similarity: 100
            };
            reconciliation.updateReportData(updated, 'income');
            await referenceData.learnAssociation(updated);
            try {
                await consolidationService.markAsIdentified(txId);
            } catch (e) { console.warn("Failed to mark as identified in DB", e); }

            reconciliation.setManualIdentificationTx(null);
            showToast("Identificação manual realizada e aprendida.", "success");
        }
    }, [reconciliation, referenceData, showToast]);

    const confirmBulkManualIdentification = useCallback((txIds: string[], churchId: string) => {
        const church = referenceData.churches.find(c => c.id === churchId);
        if (!church) return;

        txIds.forEach(id => {
            const result = reconciliation.matchResults.find(r => r.transaction.id === id);
            if (result) {
                const updated: MatchResult = {
                    ...result,
                    status: 'IDENTIFICADO',
                    church,
                    matchMethod: 'MANUAL',
                    similarity: 100
                };
                reconciliation.updateReportData(updated, 'income');
                referenceData.learnAssociation(updated);
                consolidationService.markAsIdentified(id).catch(() => {});
            }
        });
        
        reconciliation.setBulkIdentificationTxs(null);
        showToast(`${txIds.length} transações identificadas em massa.`, "success");
    }, [reconciliation, referenceData, showToast]);

    const saveCurrentReportChanges = useCallback(() => {
        if (reconciliation.activeReportId) {
            reportManager.overwriteSavedReport(reconciliation.activeReportId, reconciliation.matchResults);
        }
    }, [reconciliation.activeReportId, reconciliation.matchResults, reportManager]);

    // View Saved Report Logic
    const viewSavedReport = useCallback(async (reportId: string) => {
        setIsLoading(true);
        try {
            let report = reportManager.savedReports.find(r => r.id === reportId);
            
            if (!report) {
                const { data: dbReport, error } = await supabase.from('saved_reports').select('*').eq('id', reportId).single();
                if (error || !dbReport) throw new Error("Relatório não encontrado.");
                
                const parsedData = typeof dbReport.data === 'string' ? JSON.parse(dbReport.data as string) : dbReport.data;
                report = {
                    id: dbReport.id,
                    name: dbReport.name,
                    createdAt: dbReport.created_at,
                    recordCount: dbReport.record_count,
                    user_id: dbReport.user_id,
                    data: parsedData
                };
            } else if (!report.data) {
                const { data: reportContent, error } = await supabase
                    .from('saved_reports')
                    .select('data')
                    .eq('id', reportId)
                    .single();

                if (error) throw error;

                if (reportContent) {
                    const parsedData = typeof reportContent.data === 'string' 
                        ? JSON.parse(reportContent.data) 
                        : reportContent.data;
                    
                    report = { ...report, data: parsedData };
                    reportManager.setSavedReports(prev => prev.map(r => r.id === reportId ? { ...r, data: parsedData } : r));
                }
            }

            if (!report || !report.data) throw new Error("Conteúdo do relatório vazio.");

            reconciliation.clearFiles();
            setActiveSpreadsheetData(null);

            if (report.data.spreadsheet) {
                setActiveSpreadsheetData(report.data.spreadsheet);
                reconciliation.setActiveReportId(reportId);
                setActiveView('smart_analysis');
                showToast(`Planilha "${report.name}" carregada.`, "success");
            } else {
                let livePendingTransactions: Transaction[] = [];
                if (user) {
                    try {
                        const pendingDb = await consolidationService.getPendingTransactions(user.id);
                        if (pendingDb) {
                            livePendingTransactions = pendingDb.map(tx => ({
                                id: tx.id,
                                date: tx.transaction_date,
                                amount: tx.amount,
                                description: tx.description,
                                cleanedDescription: tx.description,
                                contributionType: tx.type,
                                originalAmount: String(tx.amount)
                            }));
                        }
                    } catch (dbError) {
                        console.warn("Offline or DB Error getting live pending transactions:", dbError);
                    }
                }

                const savedIdentifiedResults = report.data.results
                    .filter((r: any) => r.status === 'IDENTIFICADO' || r.status === 'RESOLVED')
                    .map((r: any) => ({ 
                        ...r, 
                        church: r.church || referenceData.churches.find(c => c.id === r._churchId) || PLACEHOLDER_CHURCH 
                    }));

                const livePendingResults: MatchResult[] = livePendingTransactions.map(tx => ({
                    transaction: tx,
                    contributor: null,
                    status: 'NÃO IDENTIFICADO',
                    church: PLACEHOLDER_CHURCH,
                    matchMethod: undefined,
                    similarity: 0
                }));

                const combinedResults = [...savedIdentifiedResults, ...livePendingResults];

                reconciliation.setMatchResults(combinedResults);
                reconciliation.setReportPreviewData({
                    income: groupResultsByChurch(combinedResults.filter((r: any) => r.transaction.amount > 0 || r.status === 'PENDENTE')),
                    expenses: { 'all_expenses_group': combinedResults.filter((r: any) => r.transaction.amount < 0) }
                });
                
                reconciliation.setHasActiveSession(true); 
                reconciliation.setActiveReportId(reportId); 
                setActiveView('reports'); 
                
                if (livePendingTransactions.length > 0) {
                    showToast(`Relatório "${report.name}" carregado com Lista Viva atualizada.`, "success");
                } else {
                    showToast(`Relatório "${report.name}" carregado (Histórico).`, "success");
                }
            }

        } catch (error: any) {
            console.error(error);
            showToast("Erro ao abrir relatório: " + error.message, "error");
        } finally {
            setIsLoading(false);
        }
    }, [reportManager, reconciliation, setActiveView, setIsLoading, showToast, user, referenceData.churches]);

    const handleGmailSyncSuccess = useCallback((transactions: Transaction[]) => {
        const csvContent = ""; // Virtual
        const virtualFile = new File([csvContent], "gmail_import.csv", { type: "text/csv" });
        
        reconciliation.handleStatementUpload(csvContent, "Importação Gmail", "gmail-import-bank", virtualFile);
        
        setTimeout(() => reconciliation.handleCompare(), 500);
    }, [reconciliation]);

    const undoIdentification = useCallback(async (transactionId: string) => {
        const result = reconciliation.matchResults.find(r => r.transaction.id === transactionId);
        if (result && result.status === 'IDENTIFICADO') {
            reconciliation.updateReportData({
                ...result,
                status: 'NÃO IDENTIFICADO',
                church: PLACEHOLDER_CHURCH,
                contributor: null,
                matchMethod: undefined,
                similarity: 0
            }, 'income');
            
            try {
                await consolidationService.markAsPending(transactionId);
            } catch(e) { console.warn("Failed to revert status in DB", e); }

            showToast("Identificação desfeita.", "success");
        }
    }, [reconciliation, showToast]);

    const findMatchResult = useCallback((id: string) => {
        return reconciliation.matchResults.find(r => r.transaction.id === id);
    }, [reconciliation.matchResults]);

    const summary = useMemo(() => {
        const total = reconciliation.matchResults.length;
        const identifiedCount = reconciliation.matchResults.filter(r => r.status === 'IDENTIFICADO').length;
        const unidentifiedCount = reconciliation.matchResults.filter(r => r.status === 'NÃO IDENTIFICADO' || r.status === 'PENDENTE').length;
        
        const auto = reconciliation.matchResults.filter(r => r.status === 'IDENTIFICADO' && r.matchMethod !== 'MANUAL');
        const manual = reconciliation.matchResults.filter(r => r.status === 'IDENTIFICADO' && r.matchMethod === 'MANUAL');
        const pending = reconciliation.matchResults.filter(r => r.status === 'NÃO IDENTIFICADO' || r.status === 'PENDENTE');

        const totalValue = reconciliation.matchResults.reduce((acc, r) => acc + (r.transaction.amount || 0), 0);

        const churchMap = new Map<string, number>();
        reconciliation.matchResults.forEach(r => {
            if (r.status === 'IDENTIFICADO' && r.church && r.church.id !== 'unidentified') {
                const current = churchMap.get(r.church.name) || 0;
                churchMap.set(r.church.name, current + (r.contributorAmount || r.transaction.amount));
            }
        });
        const valuePerChurch = Array.from(churchMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

        const methodBreakdown = {
            AUTOMATIC: reconciliation.matchResults.filter(r => r.matchMethod === 'AUTOMATIC').length,
            MANUAL: reconciliation.matchResults.filter(r => r.matchMethod === 'MANUAL').length,
            LEARNED: reconciliation.matchResults.filter(r => r.matchMethod === 'LEARNED').length,
            AI: reconciliation.matchResults.filter(r => r.matchMethod === 'AI').length
        };

        return {
            total,
            identifiedCount,
            unidentifiedCount,
            autoConfirmed: { count: auto.length, value: auto.reduce((s, r) => s + (r.transaction.amount || 0), 0) },
            manualConfirmed: { count: manual.length, value: manual.reduce((s, r) => s + (r.transaction.amount || 0), 0) },
            pending: { count: pending.length, value: pending.reduce((s, r) => s + (r.transaction.amount || 0), 0) },
            totalValue,
            valuePerChurch,
            methodBreakdown,
            isHistorical: !!reconciliation.activeReportId
        };
    }, [reconciliation.matchResults, reconciliation.activeReportId]);

    const openSmartEdit = useCallback((target: MatchResult) => setSmartEditTarget(target), []);
    const closeSmartEdit = useCallback(() => setSmartEditTarget(null), []);
    const saveSmartEdit = useCallback(async (updated: MatchResult) => {
        reconciliation.updateReportData(updated, 'income');
        if (updated.status === 'IDENTIFICADO') {
            await referenceData.learnAssociation(updated);
            consolidationService.markAsIdentified(updated.transaction.id).catch(() => {});
        }
        setSmartEditTarget(null);
        showToast("Registro atualizado com sucesso.", "success");
    }, [reconciliation, referenceData, showToast]);

    const contextValue: AppContextType = {
        ...referenceData,
        ...reportManager,
        ...reconciliation,
        
        // Exposed modified state
        activeBankFiles: reconciliation.activeBankFiles,
        selectedBankIds: reconciliation.selectedBankIds,
        toggleBankSelection: reconciliation.toggleBankSelection,
        bankStatementFile: reconciliation.activeBankFiles.length > 0 ? reconciliation.activeBankFiles[0] : null, // Compatibilidade
        setBankStatementFile: reconciliation.setBankStatementFile, // Pass raw setter

        initialDataLoaded,
        deletingItem,
        openDeleteConfirmation,
        closeDeleteConfirmation,
        confirmDeletion,
        
        isPaymentModalOpen,
        openPaymentModal: () => setIsPaymentModalOpen(true),
        closePaymentModal: () => setIsPaymentModalOpen(false),
        
        isRecompareModalOpen,
        openRecompareModal: () => setIsRecompareModalOpen(true),
        closeRecompareModal: () => setIsRecompareModalOpen(false),
        
        manualIdentificationTx: reconciliation.manualIdentificationTx,
        bulkIdentificationTxs: reconciliation.bulkIdentificationTxs,
        openManualIdentify, 
        closeManualIdentify: reconciliation.closeManualIdentify,
        confirmManualIdentification,
        confirmBulkManualIdentification,
        
        smartEditTarget,
        openSmartEdit,
        closeSmartEdit,
        saveSmartEdit,
        
        isUpdateFilesModalOpen,
        openUpdateFilesModal: () => setIsUpdateFilesModalOpen(true),
        closeUpdateFilesModal: () => setIsUpdateFilesModalOpen(false),
        
        isSyncing,
        viewSavedReport,
        activeSpreadsheetData,
        setActiveSpreadsheetData,
        summary,
        effectiveIgnoreKeywords,
        saveCurrentReportChanges,
        handleGmailSyncSuccess,
        undoIdentification,
        findMatchResult
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};
