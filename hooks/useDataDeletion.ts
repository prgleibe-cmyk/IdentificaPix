
import { useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { DeletingItem } from '../types';
import { consolidationService } from '../services/ConsolidationService';

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

    const confirmDeletion = useCallback(async () => {
        if (!modalController.deletingItem) return;
        const { type, id } = modalController.deletingItem;
        
        try {
            switch (type) {
                case 'bank': {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    if (!token) throw new Error("Token não encontrado");

                    const response = await fetch(`/api/reference/delete/bank/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) throw new Error("Erro ao deletar banco via API");
                    referenceData.setBanks((prev: any[]) => prev.filter(b => b.id !== id));
                    showToast("Banco excluído.", "success");
                    break;
                }
                case 'church': {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    if (!token) throw new Error("Token não encontrado");

                    const response = await fetch(`/api/reference/delete/church/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) throw new Error("Erro ao deletar igreja via API");
                    referenceData.setChurches((prev: any[]) => prev.filter(c => c.id !== id));
                    showToast("Igreja excluída.", "success");
                    break;
                }
                case 'report-saved': {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    if (!token) throw new Error("Token não encontrado");

                    const response = await fetch(`/api/reference/delete/report/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) throw new Error("Erro ao deletar relatório via API");
                    reportManager.setSavedReports((prev: any[]) => prev.filter(r => r.id !== id));
                    showToast("Relatório excluído.", "success");
                    break;
                }
                case 'report-row': {
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
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    if (!token) throw new Error("Token não encontrado");

                    const response = await fetch(`/api/reference/delete/association/${user.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) throw new Error("Erro ao limpar associações via API");
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
