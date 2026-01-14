
import React, { createContext, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { useReferenceData } from '../hooks/useReferenceData';
import { useReconciliation } from '../hooks/useReconciliation';
import { useReportManager } from '../hooks/useReportManager';
import { 
    Bank, Church, MatchResult, Transaction, 
    SavedReport, SearchFilters, SavingReportState, 
    DeletingItem, SpreadsheetData, FileModel, 
    LearnedAssociation, ChurchFormData
} from '../types';
import { consolidationService } from '../services/ConsolidationService';
import { PLACEHOLDER_CHURCH } from '../services/processingService';
import { supabase } from '../services/supabaseClient';

export const AppContext = createContext<any>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { showToast, setIsLoading, setActiveView } = useUI();

    // 1. Reference Data (Banks, Churches, Models, Keywords)
    const referenceData = useReferenceData(user, showToast);

    // 2. Report Manager (Saved Reports, Filters)
    const reportManager = useReportManager(user, showToast);

    // 3. Reconciliation Engine (Files, Matching, Results)
    const reconciliation = useReconciliation({
        user,
        churches: referenceData.churches,
        banks: referenceData.banks,
        fileModels: referenceData.fileModels,
        similarityLevel: referenceData.similarityLevel,
        dayTolerance: referenceData.dayTolerance,
        customIgnoreKeywords: referenceData.customIgnoreKeywords,
        contributionKeywords: referenceData.contributionKeywords,
        learnedAssociations: referenceData.learnedAssociations,
        showToast,
        setIsLoading,
        setActiveView
    });

    // --- Summary Calculation (Fix for Dashboard Crash) ---
    const summary = useMemo(() => {
        const results = reconciliation.matchResults || [];
        
        // Calculate stats
        const identified = results.filter(r => r.status === 'IDENTIFICADO');
        const unidentified = results.filter(r => r.status !== 'IDENTIFICADO'); // 'NÃO IDENTIFICADO' or 'PENDENTE'
        
        const identifiedCount = identified.length;
        const unidentifiedCount = unidentified.length;
        
        const autoConfirmed = identified.filter(r => !r.matchMethod || r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED');
        const manualConfirmed = identified.filter(r => r.matchMethod === 'MANUAL' || r.matchMethod === 'AI');
        const pending = unidentified;

        const totalValue = results.reduce((acc, r) => acc + (r.transaction.amount || 0), 0);
        
        const autoValue = autoConfirmed.reduce((acc, r) => acc + (r.transaction.amount || 0), 0);
        const manualValue = manualConfirmed.reduce((acc, r) => acc + (r.transaction.amount || 0), 0);
        const pendingValue = pending.reduce((acc, r) => acc + (r.transaction.amount || 0), 0);

        const methodBreakdown = {
            AUTOMATIC: identified.filter(r => r.matchMethod === 'AUTOMATIC' || !r.matchMethod).length,
            MANUAL: identified.filter(r => r.matchMethod === 'MANUAL').length,
            LEARNED: identified.filter(r => r.matchMethod === 'LEARNED').length,
            AI: identified.filter(r => r.matchMethod === 'AI').length,
        };

        // Value per church
        const churchMap = new Map<string, number>();
        identified.forEach(r => {
            if (r.church) {
                const current = churchMap.get(r.church.name) || 0;
                churchMap.set(r.church.name, current + (r.transaction.amount || 0));
            }
        });
        const valuePerChurch = Array.from(churchMap.entries()).sort((a, b) => b[1] - a[1]);

        return {
            identifiedCount,
            unidentifiedCount,
            totalValue,
            autoConfirmed: { value: autoValue, count: autoConfirmed.length },
            manualConfirmed: { value: manualValue, count: manualConfirmed.length },
            pending: { value: pendingValue, count: pending.length },
            methodBreakdown,
            valuePerChurch,
            isHistorical: !!reconciliation.activeReportId
        };
    }, [reconciliation.matchResults, reconciliation.activeReportId]);

    // --- Modal States ---
    const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isRecompareModalOpen, setIsRecompareModalOpen] = useState(false);
    const [isUpdateFilesModalOpen, setIsUpdateFilesModalOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeSpreadsheetData, setActiveSpreadsheetData] = useState<SpreadsheetData | null>(null);
    
    // Separate state for Smart Edit Modal
    const [smartEditTarget, setSmartEditTarget] = useState<MatchResult | null>(null);

    // --- Actions ---

    const openDeleteConfirmation = useCallback((item: DeletingItem) => setDeletingItem(item), []);
    const closeDeleteConfirmation = useCallback(() => setDeletingItem(null), []);
    
    const confirmDeletion = useCallback(async () => {
        if (!deletingItem) return;
        
        setIsLoading(true);
        try {
            if (deletingItem.type === 'bank') {
                // Check if bank has active files
                const hasFiles = reconciliation.activeBankFiles.some(f => f.bankId === deletingItem.id);
                if (hasFiles) {
                    showToast("Remova o extrato deste banco antes de excluí-lo.", "error");
                    setDeletingItem(null);
                    setIsLoading(false);
                    return;
                }
                const { error } = await supabase.from('banks').delete().eq('id', deletingItem.id);
                if (!error) {
                    referenceData.setBanks(prev => prev.filter(b => b.id !== deletingItem.id));
                    showToast("Banco excluído.", "success");
                } else throw error;

            } else if (deletingItem.type === 'church') {
                const { error } = await supabase.from('churches').delete().eq('id', deletingItem.id);
                if (!error) {
                    referenceData.setChurches(prev => prev.filter(c => c.id !== deletingItem.id));
                    showToast("Igreja excluída.", "success");
                } else throw error;

            } else if (deletingItem.type === 'report-saved') {
                const { error } = await supabase.from('saved_reports').delete().eq('id', deletingItem.id);
                if (!error) {
                    reportManager.setSavedReports(prev => prev.filter(r => r.id !== deletingItem.id));
                    showToast("Relatório excluído.", "success");
                } else throw error;

            } else if (deletingItem.type === 'report-row') {
                reconciliation.setMatchResults(prev => prev.filter(r => r.transaction.id !== deletingItem.id));
                // Trigger re-grouping indirectly by updating matchResults
                reconciliation.setReportPreviewData(prev => {
                    if (!prev) return null;
                    // Simple refresh of preview data structure
                    return prev; 
                });
                showToast("Linha removida.", "success");

            } else if (deletingItem.type === 'all-data') {
                await reconciliation.resetReconciliation();
                // Optionally clear other data if needed
            } else if (deletingItem.type === 'uploaded-files') {
                reconciliation.clearFiles();
                showToast("Arquivos limpos.", "success");
            } else if (deletingItem.type === 'match-results') {
                reconciliation.setMatchResults([]);
                reconciliation.setReportPreviewData(null);
                showToast("Resultados limpos.", "success");
            } else if (deletingItem.type === 'learned-associations') {
                const { error } = await supabase.from('learned_associations').delete().eq('user_id', user?.id);
                if (!error) {
                    referenceData.setLearnedAssociations([]);
                    showToast("Associações limpas.", "success");
                } else throw error;
            }

        } catch (e: any) {
            console.error(e);
            showToast("Erro ao excluir: " + e.message, "error");
        } finally {
            setDeletingItem(null);
            setIsLoading(false);
        }
    }, [deletingItem, reconciliation, referenceData, reportManager, user, showToast, setIsLoading]);

    const undoIdentification = useCallback(async (transactionId: string) => {
        const result = reconciliation.matchResults.find(r => r.transaction.id === transactionId);
        if (result && result.status === 'IDENTIFICADO') {
            
            const isGhost = result.transaction.id.startsWith('ghost-');
            
            const targetStatus = isGhost ? 'PENDENTE' : 'NÃO IDENTIFICADO';
            const targetChurch = isGhost ? result.church : PLACEHOLDER_CHURCH;
            const targetContributor = isGhost ? result.contributor : null;

            reconciliation.updateReportData({
                ...result,
                status: targetStatus,
                church: targetChurch, 
                contributor: targetContributor,
                matchMethod: undefined,
                similarity: 0
            }, 'income'); 
            
            try {
                await consolidationService.markAsPending(transactionId);
            } catch(e) { console.warn("Failed to revert status in DB", e); }

            showToast("Identificação desfeita.", "success");
        }
    }, [reconciliation, showToast]);

    const handleGmailSyncSuccess = useCallback((transactions: Transaction[]) => {
        const header = "Data;Descrição;Valor;Tipo\n";
        const rows = transactions.map(t => {
            const dateParts = t.date.split('-');
            const brDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
            return `${brDate};${t.description};${t.amount};${t.contributionType}`;
        }).join('\n');
        
        const csvContent = header + rows;
        const fileName = `Gmail Import ${new Date().toLocaleDateString()}`;
        const virtualFile = new File([csvContent], "gmail.csv", { type: 'text/csv' });
        
        reconciliation.handleStatementUpload(csvContent, fileName, 'gmail-virtual-bank', virtualFile);
    }, [reconciliation]);

    const openManualIdentify = useCallback((transactionId: string) => {
        const tx = reconciliation.matchResults.find(r => r.transaction.id === transactionId)?.transaction;
        if (tx) reconciliation.setManualIdentificationTx(tx);
    }, [reconciliation]);

    const confirmManualIdentification = useCallback(async (transactionId: string, churchId: string) => {
        const church = referenceData.churches.find(c => c.id === churchId);
        if (!church) return;

        const result = reconciliation.matchResults.find(r => r.transaction.id === transactionId);
        if (result) {
            const updatedResult: MatchResult = {
                ...result,
                status: 'IDENTIFICADO',
                church: church,
                matchMethod: 'MANUAL',
                similarity: 100,
                contributorAmount: result.transaction.amount 
            };
            
            reconciliation.updateReportData(updatedResult, 'income');
            
            referenceData.learnAssociation(updatedResult);

            if (user) {
                await consolidationService.markAsIdentified(transactionId);
            }
            
            showToast("Identificação manual confirmada.", "success");
        }
        reconciliation.setManualIdentificationTx(null);
    }, [referenceData, reconciliation, user, showToast]);

    const confirmBulkManualIdentification = useCallback(async (ids: string[], churchId: string) => {
        for (const id of ids) {
            await confirmManualIdentification(id, churchId);
        }
        reconciliation.setBulkIdentificationTxs(null);
    }, [confirmManualIdentification, reconciliation]);

    const openSmartEdit = useCallback((record: MatchResult) => setSmartEditTarget(record), []);
    const closeSmartEdit = useCallback(() => setSmartEditTarget(null), []);
    
    const saveSmartEdit = useCallback((updatedRecord: MatchResult) => {
        reconciliation.updateReportData(updatedRecord, 'income');
        setSmartEditTarget(null);
        showToast("Edição salva.", "success");
    }, [reconciliation, showToast]);

    const value = {
        banks: referenceData.banks,
        addBank: referenceData.addBank,
        updateBank: referenceData.updateBank,
        openEditBank: referenceData.openEditBank,
        closeEditBank: referenceData.closeEditBank,
        editingBank: referenceData.editingBank,
        
        churches: referenceData.churches,
        addChurch: referenceData.addChurch,
        updateChurch: referenceData.updateChurch,
        openEditChurch: referenceData.openEditChurch,
        closeEditChurch: referenceData.closeEditChurch,
        editingChurch: referenceData.editingChurch,

        fileModels: referenceData.fileModels,
        fetchModels: referenceData.fetchModels,
        
        similarityLevel: referenceData.similarityLevel,
        setSimilarityLevel: referenceData.setSimilarityLevel,
        dayTolerance: referenceData.dayTolerance,
        setDayTolerance: referenceData.setDayTolerance,
        
        customIgnoreKeywords: referenceData.customIgnoreKeywords,
        addIgnoreKeyword: referenceData.addIgnoreKeyword,
        removeIgnoreKeyword: referenceData.removeIgnoreKeyword,
        
        contributionKeywords: referenceData.contributionKeywords,
        addContributionKeyword: referenceData.addContributionKeyword,
        removeContributionKeyword: referenceData.removeContributionKeyword,
        
        learnedAssociations: referenceData.learnedAssociations,
        learnAssociation: referenceData.learnAssociation,

        savedReports: reportManager.savedReports,
        updateSavedReportName: reportManager.updateSavedReportName,
        updateSavedReportTransaction: reportManager.updateSavedReportTransaction,
        overwriteSavedReport: reportManager.overwriteSavedReport,
        deleteOldReports: reportManager.deleteOldReports,
        allHistoricalResults: reportManager.allHistoricalResults,
        maxSavedReports: reportManager.maxSavedReports,
        
        searchFilters: reportManager.searchFilters,
        setSearchFilters: reportManager.setSearchFilters,
        clearSearchFilters: reportManager.clearSearchFilters,
        isSearchFiltersOpen: reportManager.isSearchFiltersOpen,
        openSearchFilters: reportManager.openSearchFilters,
        closeSearchFilters: reportManager.closeSearchFilters,
        
        savingReportState: reportManager.savingReportState,
        openSaveReportModal: reportManager.openSaveReportModal,
        closeSaveReportModal: reportManager.closeSaveReportModal,
        confirmSaveReport: reportManager.confirmSaveReport,
        saveFilteredReport: reportManager.saveFilteredReport,

        activeBankFiles: reconciliation.activeBankFiles,
        selectedBankIds: reconciliation.selectedBankIds,
        toggleBankSelection: reconciliation.toggleBankSelection,
        setBankStatementFile: reconciliation.setBankStatementFile,
        
        contributorFiles: reconciliation.contributorFiles,
        matchResults: reconciliation.matchResults,
        setMatchResults: reconciliation.setMatchResults,
        reportPreviewData: reconciliation.reportPreviewData,
        setReportPreviewData: reconciliation.setReportPreviewData,
        hasActiveSession: reconciliation.hasActiveSession,
        setHasActiveSession: reconciliation.setHasActiveSession,
        activeReportId: reconciliation.activeReportId,
        setActiveReportId: reconciliation.setActiveReportId,
        
        comparisonType: reconciliation.comparisonType,
        setComparisonType: reconciliation.setComparisonType,
        
        pendingTraining: reconciliation.pendingTraining,
        setPendingTraining: reconciliation.setPendingTraining,
        
        handleStatementUpload: reconciliation.handleStatementUpload,
        handleContributorsUpload: reconciliation.handleContributorsUpload,
        removeBankStatementFile: reconciliation.removeBankStatementFile,
        removeContributorFile: reconciliation.removeContributorFile,
        
        handleCompare: reconciliation.handleCompare,
        isCompareDisabled: reconciliation.isCompareDisabled,
        updateReportData: reconciliation.updateReportData,
        resetReconciliation: reconciliation.resetReconciliation,
        
        manualIdentificationTx: reconciliation.manualIdentificationTx,
        setManualIdentificationTx: reconciliation.setManualIdentificationTx,
        bulkIdentificationTxs: reconciliation.bulkIdentificationTxs,
        setBulkIdentificationTxs: reconciliation.setBulkIdentificationTxs,
        closeManualIdentify: reconciliation.closeManualIdentify,
        
        manualMatchState: reconciliation.manualMatchState,
        openManualMatchModal: reconciliation.openManualMatchModal,
        closeManualMatchModal: reconciliation.closeManualMatchModal,
        confirmManualAssociation: reconciliation.confirmManualAssociation,
        
        divergenceConfirmation: reconciliation.divergenceConfirmation,
        openDivergenceModal: reconciliation.openDivergenceModal,
        closeDivergenceModal: reconciliation.closeDivergenceModal,
        confirmDivergence: reconciliation.confirmDivergence,
        rejectDivergence: reconciliation.rejectDivergence,
        
        loadingAiId: reconciliation.loadingAiId,
        aiSuggestion: reconciliation.aiSuggestion,
        handleAnalyze: reconciliation.handleAnalyze,
        
        handleTrainingSuccess: reconciliation.handleTrainingSuccess,

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
        
        isUpdateFilesModalOpen,
        openUpdateFilesModal: () => setIsUpdateFilesModalOpen(true),
        closeUpdateFilesModal: () => setIsUpdateFilesModalOpen(false),
        
        isSyncing,
        activeSpreadsheetData,
        
        undoIdentification,
        handleGmailSyncSuccess,
        openManualIdentify,
        confirmManualIdentification,
        confirmBulkManualIdentification,
        
        smartEditTarget,
        openSmartEdit,
        closeSmartEdit,
        saveSmartEdit,
        
        summary, // <--- ADDED SUMMARY HERE
        
        initialDataLoaded: true,
        findMatchResult: (id: string) => reconciliation.matchResults.find(r => r.transaction.id === id)
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
