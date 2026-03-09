import { useCallback } from 'react';
import { MatchResult, Church, ReconciliationStatus, MatchMethod, Contributor } from '../types';
import { groupResultsByChurch } from '../services/processingService';
import { consolidationService } from '../services/ConsolidationService';

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

  const confirmManualIdentification = useCallback(async (txId: string, churchId: string) => {

    const church = referenceData.churches.find((c: Church) => c.id === churchId);
    if (!church) return;

    const currentResults = [...reconciliation.matchResults];
    const idx = currentResults.findIndex(r => r.transaction.id === txId);
    if (idx === -1) return;

    const originalResult = currentResults[idx];

    const contributor: Contributor = originalResult.contributor || {
      name: originalResult.transaction.cleanedDescription || originalResult.transaction.description,
      amount: originalResult.transaction.amount,
      cleanedName: originalResult.transaction.cleanedDescription || originalResult.transaction.description
    };

    const updatedResult: MatchResult = {
      ...originalResult,
      status: ReconciliationStatus.IDENTIFIED,
      contributor,
      church,
      matchMethod: MatchMethod.MANUAL,
      similarity: 100,
      contributorAmount: contributor.amount,
      divergence: undefined
    };

    currentResults[idx] = updatedResult;

    if (!txId.includes('ghost') && !txId.includes('sim')) {
      await consolidationService.updateTransactionStatus(txId, 'identified');
    }

    reconciliation.setMatchResults(currentResults);

    referenceData.learnAssociation(updatedResult);

    reconciliation.closeManualIdentify();

    showToast("Identificado e aprendido pela IA.", "success");

    if (onAfterAction) onAfterAction(currentResults);

  }, [reconciliation, referenceData, showToast, onAfterAction]);


  const confirmBulkManualIdentification = useCallback(async (txIds: string[], churchId: string) => {

    const church = referenceData.churches.find((c: Church) => c.id === churchId);
    if (!church) return;

    const currentResults = [...reconciliation.matchResults];
    let affectedCount = 0;

    for (const id of txIds) {

      const idx = currentResults.findIndex(r => r.transaction.id === id);

      if (idx === -1) continue;

      const original = currentResults[idx];

      if (original.isConfirmed) continue;

      const contributor: Contributor = original.contributor || {
        name: original.transaction.cleanedDescription || original.transaction.description,
        amount: original.transaction.amount,
        cleanedName: original.transaction.cleanedDescription || original.transaction.description
      };

      const updated: MatchResult = {
        ...original,
        status: ReconciliationStatus.IDENTIFIED,
        contributor,
        church,
        matchMethod: MatchMethod.MANUAL,
        similarity: 100,
        contributorAmount: contributor.amount,
        divergence: undefined
      };

      currentResults[idx] = updated;

      referenceData.learnAssociation(updated);

      if (!id.includes('ghost') && !id.includes('sim')) {
        await consolidationService.updateTransactionStatus(id, 'identified');
      }

      affectedCount++;
    }

    reconciliation.setMatchResults(currentResults);

    if (reconciliation.setReportPreviewData) {

      const incomeResults = currentResults.filter(r => {
        const val = r.status === ReconciliationStatus.PENDING
          ? (r.contributorAmount || 0)
          : r.transaction.amount;

        return val >= 0;
      });

      const expenseResults = currentResults.filter(r => {
        const val = r.status === ReconciliationStatus.PENDING
          ? (r.contributorAmount || 0)
          : r.transaction.amount;

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


  /**
   * 🔒 CONFIRMAÇÃO FINAL (CORRIGIDA)
   * Agora usa imutabilidade para garantir persistência correta
   */
  const toggleConfirmation = useCallback(async (txIds: string[], confirmed: boolean) => {

    const idsToUpdate = txIds.filter(id => !id.startsWith('ghost') && !id.startsWith('sim'));

    if (idsToUpdate.length > 0) {
      await consolidationService.updateConfirmationStatus(idsToUpdate, confirmed);
    }

    const updatedResults: MatchResult[] = reconciliation.matchResults.map((r: MatchResult) => {

      if (!txIds.includes(r.transaction.id)) return r;

      return {
        ...r,
        isConfirmed: confirmed,
        transaction: {
          ...r.transaction,
          isConfirmed: confirmed
        }
      };

    });

    reconciliation.setMatchResults(updatedResults);

    showToast(
      confirmed
        ? "Registros confirmados e bloqueados."
        : "Bloqueio removido.",
      "success"
    );

    if (onAfterAction) onAfterAction(updatedResults);

  }, [reconciliation, showToast, onAfterAction]);


  /**
   * ↩️ DESFAZER IDENTIFICAÇÃO
   */
  const undoIdentification = useCallback(async (txId: string) => {

    const existing = reconciliation.matchResults.find(
      (r: MatchResult) => r.transaction.id === txId
    );

    if (existing?.isConfirmed) {
      showToast("Remova o bloqueio antes de desfazer.", "error");
      return;
    }

    if (!txId.includes('ghost') && !txId.includes('sim')) {
      await consolidationService.updateTransactionStatus(txId, 'pending');
    }

    reconciliation.revertMatch(txId);

    showToast("Identificação desfeita.", "success");

    const updatedResults = reconciliation.matchResults.map((r: MatchResult) => {

      if (r.transaction.id !== txId) return r;

      return {
        ...r,
        status: ReconciliationStatus.PENDING,
        contributor: undefined,
        church: undefined,
        matchMethod: undefined
      };

    });

    if (onAfterAction) onAfterAction(updatedResults);

  }, [reconciliation, showToast, onAfterAction]);


  return {
    confirmManualIdentification,
    confirmBulkManualIdentification,
    undoIdentification,
    toggleConfirmation
  };
};