
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
    const canDelete = subscription?.permissions?.excluir_registros !== false;

    const confirmDeletion = useCallback(async () => {
        if (!modalController.deletingItem) return;
        const { type, id } = modalController.deletingItem;
        
        try {
            switch (type) {
                case 'bank': {
                    console.log(`[WRITE:FIX] Excluindo banco com effectiveUserId: ${effectiveUserId}`);
                    const { error } = await supabase.from('banks').delete().eq('id', id).eq('user_id', effectiveUserId);
                    if (error) throw error;
                    referenceData.setBanks((prev: any[]) => prev.filter(b => b.id !== id));
                    showToast("Banco excluído.", "success");
                    break;
                }
                case 'church': {
                    console.log(`[WRITE:FIX] Excluindo igreja com effectiveUserId: ${effectiveUserId}`);
                    const { error } = await supabase.from('churches').delete().eq('id', id).eq('user_id', effectiveUserId);
                    if (error) throw error;
                    referenceData.setChurches((prev: any[]) => prev.filter(c => c.id !== id));
                    showToast("Igreja excluída.", "success");
                    break;
                }
                case 'report-saved': {
                    console.log(`[WRITE:FIX] Excluindo relatório salvo com effectiveUserId: ${effectiveUserId}`);
                    const { error } = await supabase.from('saved_reports').delete().eq('id', id).eq('user_id', effectiveUserId);
                    if (error) throw error;
                    reportManager.setSavedReports((prev: any[]) => prev.filter(r => r.id !== id));
                    showToast("Relatório excluído.", "success");
                    break;
                }
                case 'report-row': {
                    if (!canDelete) {
                        console.warn('Usuário sem permissão para excluir registros');
                        showToast("Você não possui permissão para excluir registros.", "error");
                        return;
                    }

                    // Se não for um registro fantasma, remove permanentemente do banco de dados
                    if (!id.startsWith('ghost-')) {
                        await consolidationService.deleteTransactionById(id);
                    }
                    
                    // Remove do estado da reconciliação (UI do relatório)
                    reconciliation.removeTransaction(id);
                    
                    // Força a sincronização da Lista Viva para atualizar os contadores no UploadView
                    if (reconciliation.hydrate) {
                        await reconciliation.hydrate();
                    }
                    
                    showToast("Linha removida permanentemente.", "success");
                    break;
                }
                case 'all-data': {
                    reconciliation.resetReconciliation();
                    await supabase.rpc('delete_pending_transactions'); 
                    showToast("Todos os dados temporários foram limpos.", "success");
                    break;
                }
                case 'uploaded-files': {
                    await supabase.rpc('delete_pending_transactions');
                    reconciliation.setBankStatementFile([]);
                    reconciliation.setSelectedBankIds([]);
                    showToast("Arquivos e transações limpos.", "success");
                    break;
                }
                case 'match-results': {
                    reconciliation.setMatchResults([]);
                    reconciliation.setReportPreviewData(null);
                    reconciliation.setHasActiveSession(false);
                    showToast("Resultados limpos.", "success");
                    break;
                }
                case 'learned-associations': {
                    console.log(`[WRITE:FIX] Removendo learned_associations com effectiveUserId: ${effectiveUserId}`);
                    const { error } = await supabase.from('learned_associations').delete().eq('user_id', effectiveUserId);
                    if (error) throw error;
                    referenceData.setLearnedAssociations([]);
                    showToast("Associações aprendidas removidas.", "success");
                    break;
                }
                default:
                    console.warn("Tipo de exclusão não tratado:", type);
            }
        } catch (error: any) {
            console.error("Erro ao excluir:", error);
            showToast("Erro ao excluir item: " + error.message, "error");
        } finally {
            modalController.closeDeleteConfirmation();
        }
    }, [user, modalController, referenceData, reportManager, reconciliation, showToast]);

    return { confirmDeletion };
};
