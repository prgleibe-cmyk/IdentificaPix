
import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { useReferenceData } from '../hooks/useReferenceData';
import { useReconciliation } from '../hooks/useReconciliation';
import { useReportManager } from '../hooks/useReportManager';
import { 
    MatchResult, 
    Transaction, 
    DeletingItem,
    SpreadsheetData,
    Contributor
} from '../types';
import { PLACEHOLDER_CHURCH, groupResultsByChurch } from '../services/processingService';
import { supabase } from '../services/supabaseClient';

export const AppContext = createContext<any>(null!);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, systemSettings } = useAuth();
    const { showToast, setIsLoading, setActiveView } = useUI();
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);

    // --- Hooks Management ---
    const referenceData = useReferenceData(user, showToast);
    const reportManager = useReportManager(user, showToast);
    
    const effectiveIgnoreKeywords = useMemo(() => {
        return [...(referenceData.customIgnoreKeywords || []), ...(systemSettings.globalIgnoreKeywords || [])];
    }, [referenceData.customIgnoreKeywords, systemSettings.globalIgnoreKeywords]);

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

    // --- Modals State ---
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isUpdateFilesModalOpen, setIsUpdateFilesModalOpen] = useState(false);
    const [smartEditTarget, setSmartEditTarget] = useState<MatchResult | null>(null);
    const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // --- Actions ---
    const openPaymentModal = () => setIsPaymentModalOpen(true);
    const closePaymentModal = () => setIsPaymentModalOpen(false);
    
    const openUpdateFilesModal = () => setIsUpdateFilesModalOpen(true);
    const closeUpdateFilesModal = () => setIsUpdateFilesModalOpen(false);

    const openSmartEdit = (target: MatchResult) => setSmartEditTarget(target);
    const closeSmartEdit = () => setSmartEditTarget(null);
    
    const saveSmartEdit = (result: MatchResult) => {
        // Chamada simplificada para a API atômica
        reconciliation.updateReportData(result);
        if (result.status === 'IDENTIFICADO' && result.contributor && result.church) {
             referenceData.learnAssociation(result);
        }
        closeSmartEdit();
        showToast("Identificação atualizada.", "success");
    };

    const openDeleteConfirmation = (item: DeletingItem) => setDeletingItem(item);
    const closeDeleteConfirmation = () => setDeletingItem(null);

    const confirmDeletion = async () => {
        if (!deletingItem) return;
        const { type, id } = deletingItem;
        
        try {
            if (type === 'bank') {
                const { error } = await supabase.from('banks').delete().eq('id', id);
                if (error) throw error;
                referenceData.setBanks(prev => prev.filter(b => b.id !== id));
                showToast("Banco excluído.", "success");
            } else if (type === 'church') {
                const { error } = await supabase.from('churches').delete().eq('id', id);
                if (error) throw error;
                referenceData.setChurches(prev => prev.filter(c => c.id !== id));
                showToast("Igreja excluída.", "success");
            } else if (type === 'report-saved') {
                const { error } = await supabase.from('saved_reports').delete().eq('id', id);
                if (error) throw error;
                reportManager.setSavedReports(prev => prev.filter(r => r.id !== id));
                showToast("Relatório excluído.", "success");
            } else if (type === 'report-row') {
                // Usa a nova função de remoção explícita
                reconciliation.removeTransaction(id);
                showToast("Linha removida.", "success");
            } else if (type === 'all-data') {
                reconciliation.resetReconciliation();
                await supabase.rpc('delete_pending_transactions'); 
                reconciliation.clearFiles();
                showToast("Todos os dados temporários foram limpos.", "success");
            } else if (type === 'uploaded-files') {
                reconciliation.clearFiles();
                await supabase.rpc('delete_pending_transactions');
                showToast("Arquivos e transações limpos.", "success");
            } else if (type === 'match-results') {
                reconciliation.setMatchResults([]);
                reconciliation.setReportPreviewData(null);
                reconciliation.setHasActiveSession(false);
                showToast("Resultados limpos.", "success");
            } else if (type === 'learned-associations') {
                const { error } = await supabase.from('learned_associations').delete().eq('user_id', user.id);
                if (error) throw error;
                referenceData.setLearnedAssociations([]);
                showToast("Associações aprendidas removidas.", "success");
            }
        } catch (error: any) {
            console.error("Erro ao excluir:", error);
            showToast("Erro ao excluir item: " + error.message, "error");
        } finally {
            closeDeleteConfirmation();
        }
    };

    const openManualIdentify = (txId: string) => {
        const tx = reconciliation.matchResults.find(r => r.transaction.id === txId)?.transaction;
        if (tx) reconciliation.setManualIdentificationTx(tx);
    };

    const confirmManualIdentification = (txId: string, churchId: string) => {
        const church = referenceData.churches.find(c => c.id === churchId);
        if (!church) return;
        
        const originalResult = reconciliation.matchResults.find(r => r.transaction.id === txId);
        if (!originalResult) return;

        const updatedResult: MatchResult = {
            ...originalResult,
            status: 'IDENTIFICADO',
            church: church,
            matchMethod: 'MANUAL',
            similarity: 100,
            divergence: undefined
        };
        
        // Chamada atômica e simplificada
        reconciliation.updateReportData(updatedResult);
        referenceData.learnAssociation(updatedResult);
        
        // O hook updateReportData agora gerencia a remoção de fantasmas internamente.

        reconciliation.closeManualIdentify();
        showToast("Identificado manualmente.", "success");
    };

    const confirmBulkManualIdentification = (txIds: string[], churchId: string) => {
         const church = referenceData.churches.find(c => c.id === churchId);
         if (!church) return;
         
         txIds.forEach(id => {
             const original = reconciliation.matchResults.find(r => r.transaction.id === id);
             if (original) {
                 const updated: MatchResult = {
                     ...original,
                     status: 'IDENTIFICADO',
                     church,
                     matchMethod: 'MANUAL',
                     similarity: 100
                 };
                 reconciliation.updateReportData(updated);
                 referenceData.learnAssociation(updated);
             }
         });
         reconciliation.closeManualIdentify();
         showToast(`${txIds.length} transações identificadas.`, "success");
    };

    const undoIdentification = (txId: string) => {
        reconciliation.revertMatch(txId);
        showToast("Identificação desfeita.", "success");
    };

    const handleGmailSyncSuccess = (transactions: Transaction[]) => {
        reconciliation.importGmailTransactions(transactions);
        setTimeout(() => reconciliation.handleCompare(), 500);
    };

    // --- Derived State: Summary ---
    const summary = useMemo(() => {
        const results = reconciliation.matchResults;
        const hasSession = reconciliation.hasActiveSession;
        
        let identifiedCount = 0;
        let unidentifiedCount = 0;
        let totalValue = 0;
        let valuePerChurch: [string, number][] = [];
        let methodBreakdown: Record<string, number> = { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 };
        
        let autoVal = 0, manualVal = 0, pendingVal = 0;

        if (hasSession && results.length > 0) {
            identifiedCount = results.filter(r => r.status === 'IDENTIFICADO').length;
            unidentifiedCount = results.filter(r => r.status === 'NÃO IDENTIFICADO' || r.status === 'PENDENTE').length;
            
            results.forEach(r => {
                if (r.status === 'IDENTIFICADO') {
                    const val = r.transaction.amount;
                    totalValue += val;
                    if (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI') manualVal += val;
                    else autoVal += val;
                    
                    const method = r.matchMethod || 'AUTOMATIC';
                    methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
                } else {
                    pendingVal += (r.contributorAmount || r.transaction.amount);
                }
            });

            // Group by Church
            const grouped = groupResultsByChurch(results.filter(r => r.status === 'IDENTIFICADO'));
            valuePerChurch = Object.values(grouped).map(group => {
                const churchName = group[0]?.church?.name || 'Desconhecida';
                const total = group.reduce((acc, curr) => acc + curr.transaction.amount, 0);
                return [churchName, total] as [string, number];
            }).sort((a, b) => b[1] - a[1]);

        } else if (reportManager.savedReports.length > 0) {
            // Aggregate from Saved Reports
            reportManager.savedReports.forEach(rep => {
                if (rep.data && rep.data.results) {
                    const repResults = rep.data.results as MatchResult[];
                    identifiedCount += repResults.filter(r => r.status === 'IDENTIFICADO').length;
                    
                    repResults.forEach(r => {
                        if (r.status === 'IDENTIFICADO') {
                            const method = r.matchMethod || 'AUTOMATIC';
                            methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
                        }
                    });
                }
            });
        }

        return {
            identifiedCount,
            unidentifiedCount,
            totalValue,
            autoConfirmed: { value: autoVal },
            manualConfirmed: { value: manualVal },
            pending: { value: pendingVal },
            valuePerChurch,
            methodBreakdown,
            isHistorical: !hasSession && reportManager.savedReports.length > 0
        };
    }, [reconciliation.matchResults, reconciliation.hasActiveSession, reportManager.savedReports]);

    const activeSpreadsheetData = useMemo(() => {
        if (!reconciliation.activeReportId) return undefined;
        const report = reportManager.savedReports.find(r => r.id === reconciliation.activeReportId);
        return report?.data?.spreadsheet;
    }, [reconciliation.activeReportId, reportManager.savedReports]);

    useEffect(() => {
        if (user !== undefined) setInitialDataLoaded(true);
    }, [user]);

    const value = useMemo(() => ({
        // Reference Data
        ...referenceData,
        effectiveIgnoreKeywords,
        
        // Report Manager
        ...reportManager,
        
        // Reconciliation
        ...reconciliation,
        
        // App State
        initialDataLoaded,
        summary,
        activeSpreadsheetData,
        
        // Modals & UI
        isPaymentModalOpen,
        openPaymentModal,
        closePaymentModal,
        isUpdateFilesModalOpen,
        openUpdateFilesModal,
        closeUpdateFilesModal,
        smartEditTarget,
        openSmartEdit,
        closeSmartEdit,
        saveSmartEdit,
        isSyncing,
        handleGmailSyncSuccess,
        
        // Deletion
        deletingItem,
        openDeleteConfirmation,
        closeDeleteConfirmation,
        confirmDeletion,
        
        // Manual Actions
        openManualIdentify,
        confirmManualIdentification,
        confirmBulkManualIdentification,
        undoIdentification

    }), [
        referenceData, effectiveIgnoreKeywords, reportManager, reconciliation, 
        initialDataLoaded, summary, activeSpreadsheetData, 
        isPaymentModalOpen, isUpdateFilesModalOpen, smartEditTarget, isSyncing,
        deletingItem
    ]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
