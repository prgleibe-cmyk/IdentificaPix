
import { useCallback } from 'react';
import { MatchResult, Church, ReconciliationStatus, MatchMethod, Contributor } from '../types';
import { groupResultsByChurch } from '../services/processingService';

interface UseReconciliationActionsProps {
  reconciliation: any;
  referenceData: any;
  showToast: (msg: string, type: 'success' | 'error') => void;
  onAfterAction?: (updatedResults: MatchResult[]) => void;
}

export const useReconciliationActions = ({
  reconciliation,
  referenceData,
  showToast,
  onAfterAction
}: UseReconciliationActionsProps) => {
  
  const confirmManualIdentification = useCallback((txId: string, churchId: string) => {
    const church = referenceData.churches.find((c: Church) => c.id === churchId);
    if (!church) return;
    
    const currentResults = [...reconciliation.matchResults];
    const idx = currentResults.findIndex(r => r.transaction.id === txId);
    if (idx === -1) return;

    const originalResult = currentResults[idx];
    
    // 🎯 AJUSTE CRÍTICO: Se não houver contribuinte, cria um virtual baseado na descrição
    // Isso garante que a função learnAssociation tenha dados para salvar.
    const contributor: Contributor = originalResult.contributor || {
        name: originalResult.transaction.cleanedDescription || originalResult.transaction.description,
        amount: originalResult.transaction.amount,
        cleanedName: originalResult.transaction.cleanedDescription || originalResult.transaction.description
    };

    const updatedResult: MatchResult = {
      ...originalResult,
      status: ReconciliationStatus.IDENTIFIED,
      contributor: contributor,
      church: church,
      matchMethod: MatchMethod.MANUAL,
      similarity: 100,
      contributorAmount: contributor.amount,
      divergence: undefined
    };
    
    currentResults[idx] = updatedResult;
    
    // Agora o aprendizado funcionará pois o updatedResult tem church e contributor
    reconciliation.setMatchResults(currentResults);
    referenceData.learnAssociation(updatedResult);
    
    reconciliation.closeManualIdentify();
    showToast("Identificado e aprendido pela IA.", "success");

    if (onAfterAction) onAfterAction(currentResults);
  }, [reconciliation, referenceData, showToast, onAfterAction]);

  const confirmBulkManualIdentification = useCallback((txIds: string[], churchId: string) => {
    const church = referenceData.churches.find((c: Church) => c.id === churchId);
    if (!church) return;
    
    const currentResults = [...reconciliation.matchResults];
    let affectedCount = 0;
    
    txIds.forEach(id => {
      const idx = currentResults.findIndex(r => r.transaction.id === id);
      if (idx !== -1) {
        const original = currentResults[idx];
        
        const contributor: Contributor = original.contributor || {
            name: original.transaction.cleanedDescription || original.transaction.description,
            amount: original.transaction.amount,
            cleanedName: original.transaction.cleanedDescription || original.transaction.description
        };

        const updated: MatchResult = {
          ...original,
          status: ReconciliationStatus.IDENTIFIED,
          contributor: contributor,
          church,
          matchMethod: MatchMethod.MANUAL,
          similarity: 100,
          contributorAmount: contributor.amount,
          divergence: undefined
        };
        currentResults[idx] = updated;
        referenceData.learnAssociation(updated);
        affectedCount++;
      }
    });
    
    reconciliation.setMatchResults(currentResults);
    
    if (reconciliation.setReportPreviewData) {
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
    
    reconciliation.closeManualIdentify();
    showToast(`${affectedCount} registros identificados e aprendidos.`, "success");

    if (onAfterAction) onAfterAction(currentResults);
  }, [reconciliation, referenceData, showToast, onAfterAction]);

  const undoIdentification = useCallback((txId: string) => {
    reconciliation.revertMatch(txId);
    showToast("Identificação desfeita.", "success");
    
    setTimeout(() => {
        if (onAfterAction) onAfterAction(reconciliation.matchResults);
    }, 100);
  }, [reconciliation, showToast, onAfterAction]);

  return {
    confirmManualIdentification,
    confirmBulkManualIdentification,
    undoIdentification
  };
};
