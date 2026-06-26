
import { useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { DeletingItem } from '../types';
import { consolidationService } from '../services/ConsolidationService';
import { useAuth } from '../contexts/AuthContext';

interface UseDataDeletionProps {
    user: any;
    modalController: any;
    referenceData: any;
    reportManager: any;
    reconciliation: any;
    showToast: (msg: string, type: 'success' | 'error') => void;
}

export const useDataDeletion = ({
    user,
    modalController,
    referenceData,
    reportManager,
    reconciliation,
    showToast
}: UseDataDeletionProps) => {
    const { subscription } = useAuth();
    const effectiveUserId = subscription?.ownerId || user?.owner_id || user?.id;

    const confirmDeletion = useCallback(async () => {
        if (!modalController.deletingItem) return;
        const { type, id, meta } = modalController.deletingItem;
        
        try {
            switch (type) {
                case 'bank': {
                    console.log(`[WRITE:FIX] Excluindo banco com effectiveUserId: ${effectiveUserId} no VPS`);
                    const res = await fetch(`/api/v1/banks/${id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error("Erro ao excluir banco do VPS");
                    if (referenceData?.setBanks) {
                        referenceData.setBanks((prev: any[]) => prev.filter(b => b.id !== id));
                    }
                    showToast("Banco excluído.", "success");
                    break;
                }
                case 'church': {
                    console.log(`[WRITE:FIX] Excluindo igreja com effectiveUserId: ${effectiveUserId} no VPS`);
                    const res = await fetch(`/api/v1/churches/${id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error("Erro ao excluir igreja do VPS");
                    if (referenceData?.setChurches) {
                        referenceData.setChurches((prev: any[]) => prev.filter(c => c.id !== id));
                    }
                    showToast("Igreja excluída.", "success");
                    break;
                }
                case 'report-saved': {
                    console.log(`[WRITE:FIX] Excluindo relatório salvo com effectiveUserId: ${effectiveUserId} no VPS`);
                    
                    // 🚩 Se o relatório excluído for o ATIVO, limpa a sessão antes para evitar crash de renderização
                    if (String(reconciliation?.activeReportId) === String(id)) {
                        console.log("[useDataDeletion] Relatório ativo sendo excluído. Limpando sessão.");
                        reconciliation.setActiveReportId?.(null);
                        reconciliation.setHasActiveSession?.(false);
                        reconciliation.setMatchResults?.([]);
                        reconciliation.setReportPreviewData?.(null);
                        reconciliation.setActiveSpreadsheetData?.(null);
                    }

                    const res = await fetch(`/api/v1/saved_reports/${id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error("Erro ao excluir relatório do VPS");
                    
                    if (typeof reportManager?.setSavedReports === 'function') {
                        reportManager.setSavedReports((prev: any[]) => prev.filter(r => r && r.id !== id));
                    }
                    
                    showToast("Relatório excluído.", "success");
                    break;
                }
                case 'report-row': {
                    // Se não for um registro fantasma, remove permanentemente do banco de dados
                    if (id && !id.startsWith('ghost-')) {
                        await consolidationService.deleteTransactionById(id);
                    }
                    
                    // Remove do estado da reconciliação (UI do relatório)
                    reconciliation.removeTransaction?.(id);
                    
                    // Força a sincronização da Lista Viva para atualizar os contadores no UploadView
                    if (reconciliation.hydrate) {
                        await reconciliation.hydrate();
                    }
                    
                    showToast("Linha removida permanentemente.", "success");
                    break;
                }
                case 'report-row-bulk': {
                    const ids: string[] = meta?.ids || [];
                    if (ids.length > 0) {
                        const dbIds = ids.filter((x: string) => x && !x.startsWith('ghost-'));
                        if (dbIds.length > 0) {
                            await consolidationService.deleteTransactionsByIds(dbIds);
                        }
                        
                        // Remove do estado da reconciliação (UI do relatório)
                        reconciliation.removeTransactions?.(ids);
                        
                        // Força a sincronização da Lista Viva para atualizar os contadores no UploadView
                        if (reconciliation.hydrate) {
                            await reconciliation.hydrate();
                        }
                        
                        showToast(`${ids.length} linhas removidas permanentemente.`, "success");
                    }
                    break;
                }
                case 'all-data': {
                    reconciliation.resetReconciliation?.();
                    await supabase.rpc('delete_pending_transactions'); 
                    showToast("Todos os dados temporários foram limpos.", "success");
                    break;
                }
                case 'uploaded-files': {
                    await supabase.rpc('delete_pending_transactions');
                    reconciliation.setBankStatementFile?.([]);
                    reconciliation.setSelectedBankIds?.([]);
                    showToast("Arquivos e transações limpos.", "success");
                    break;
                }
                case 'match-results': {
                    reconciliation.setMatchResults?.([]);
                    reconciliation.setReportPreviewData?.(null);
                    reconciliation.setHasActiveSession?.(false);
                    showToast("Resultados limpos.", "success");
                    break;
                }
                case 'learned-associations': {
                    console.log(`[WRITE:FIX] Removendo learned_associations com effectiveUserId: ${effectiveUserId} no VPS`);
                    const res = await fetch(`/api/v1/learned_associations/by-user/${effectiveUserId}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error("Erro ao remover associações do VPS");
                    referenceData.setLearnedAssociations?.([]);
                    showToast("Associações aprendidas removidas.", "success");
                    break;
                }
                default:
                    console.warn("Tipo de exclusão não tratado:", type);
            }
        } catch (error: any) {
            console.error("Erro crítico ao excluir:", error);
            showToast("Erro ao excluir item: " + (error.message || "Erro desconhecido"), "error");
        } finally {
            modalController?.closeDeleteConfirmation?.();
        }
    }, [user, subscription, modalController, referenceData, reportManager, reconciliation, showToast, effectiveUserId]);

    return { confirmDeletion };
};
