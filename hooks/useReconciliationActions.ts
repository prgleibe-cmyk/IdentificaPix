
import { useCallback } from 'react';
import { MatchResult, Church, ReconciliationStatus, MatchMethod } from '../types';
// Fixed: Imported groupResultsByChurch from processingService instead of using require
import { groupResultsByChurch } from '../services/processingService';

interface UseReconciliationActionsProps {
  reconciliation: any;
  referenceData: any;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const useReconciliationActions = ({
  reconciliation,
  referenceData,
  showToast
}: UseReconciliationActionsProps) => {
  
  const confirmManualIdentification = useCallback((txId: string, churchId: string) => {
    const church = referenceData.churches.find((c: Church) => c.id === churchId);
    if (!church) return;
    
    const originalResult = reconciliation.matchResults.find((r: MatchResult) => r.transaction.id === txId);
    if (!originalResult) return;

    const updatedResult: MatchResult = {
      ...originalResult,
      status: ReconciliationStatus.IDENTIFIED,
      church: church,
      matchMethod: MatchMethod.MANUAL,
      similarity: 100,
      divergence: undefined
    };
    
    reconciliation.updateReportData(updatedResult);
    referenceData.learnAssociation(updatedResult);
    
    reconciliation.closeManualIdentify();
    showToast("Identificado manualmente.", "success");
  }, [reconciliation, referenceData, showToast]);

  const confirmBulkManualIdentification = useCallback((txIds: string[], churchId: string) => {
    const church = referenceData.churches.find((c: Church) => c.id === churchId);
    if (!church) return;
    
    // 1. Cria uma nova lista baseada no estado atual para garantir imutabilidade e re-render
    const currentResults = [...reconciliation.matchResults];
    let affectedCount = 0;
    
    txIds.forEach(id => {
      const idx = currentResults.findIndex(r => r.transaction.id === id);
      if (idx !== -1) {
        const original = currentResults[idx];
        
        // 2. Cria o novo objeto de resultado para este item do lote
        const updated: MatchResult = {
          ...original,
          status: ReconciliationStatus.IDENTIFIED, // Muda para Identificado
          church, // Define a igreja escolhida
          matchMethod: MatchMethod.MANUAL,
          similarity: 100,
          contributorAmount: original.transaction.amount || original.contributor?.amount,
          divergence: undefined
        };
        
        currentResults[idx] = updated;
        
        // 3. Opcional: Aprende a associação para usos futuros automáticos
        referenceData.learnAssociation(updated);
        affectedCount++;
      }
    });
    
    // 4. Atualiza o estado principal do motor de reconciliação
    reconciliation.setMatchResults(currentResults);
    
    // 5. Força a regeneração do preview (necessário para atualizar as abas de Relatórios)
    if (reconciliation.setReportPreviewData) {
        // SEPARAÇÃO RÍGIDA POR MONTANTE EFETIVO (Elimina Duplicação)
        const incomeResults = currentResults.filter(r => {
            const val = r.status === ReconciliationStatus.PENDING ? (r.contributorAmount || 0) : r.transaction.amount;
            return val >= 0;
        });
        
        const expenseResults = currentResults.filter(r => {
            const val = r.status === ReconciliationStatus.PENDING ? (r.contributorAmount || 0) : r.transaction.amount;
            return val < 0;
        });

        reconciliation.setReportPreviewData({
            income: groupResultsByChurch(incomeResults),
            expenses: { 'all_expenses_group': expenseResults }
        });
    }
    
    // 6. Fecha o modal e limpa a seleção
    reconciliation.closeManualIdentify();
    showToast(`${affectedCount} registros identificados para ${church.name}.`, "success");
  }, [reconciliation, referenceData, showToast]);

  const undoIdentification = useCallback((txId: string) => {
    reconciliation.revertMatch(txId);
    showToast("Identificação desfeita.", "success");
  }, [reconciliation, showToast]);

  return {
    confirmManualIdentification,
    confirmBulkManualIdentification,
    undoIdentification
  };
};
