
import { useCallback } from 'react';
import { MatchResult, Church, ReconciliationStatus, MatchMethod } from '../types';

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
    
    // Lista de resultados atuais para manipulação eficiente
    const currentResults = [...reconciliation.matchResults];
    
    txIds.forEach(id => {
      const idx = currentResults.findIndex(r => r.transaction.id === id);
      if (idx !== -1) {
        const original = currentResults[idx];
        
        // Se for um registro fantasma (PENDENTE), vira IDENTIFICADO direto
        // Se for uma transação real, vira IDENTIFICADO
        const updated: MatchResult = {
          ...original,
          status: ReconciliationStatus.IDENTIFIED,
          church,
          matchMethod: MatchMethod.MANUAL,
          similarity: 100,
          contributorAmount: original.transaction.amount || original.contributor?.amount
        };
        
        currentResults[idx] = updated;
        referenceData.learnAssociation(updated);
      }
    });
    
    // Atualiza o estado global de uma vez só
    reconciliation.setMatchResults(currentResults);
    
    // Regenera o preview para refletir as mudanças nas abas
    if (reconciliation.regenerateReportPreview) {
        reconciliation.regenerateReportPreview(currentResults);
    }
    
    reconciliation.closeManualIdentify();
    showToast(`${txIds.length} transações movidas para ${church.name}.`, "success");
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
