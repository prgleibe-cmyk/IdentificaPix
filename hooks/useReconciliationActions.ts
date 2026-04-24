import { useCallback } from 'react';
import { MatchResult, Church, ReconciliationStatus, MatchMethod, Contributor } from '../types';
import { groupResultsByChurch } from '../services/processingService';
import { consolidationService } from '../services/ConsolidationService';
import { batchState } from './reconciliation/useCloudSync';

interface UseReconciliationActionsProps {
  reconciliation: any;
  referenceData: any;
  reportManager?: any;
  showToast: (msg: string, type: 'success' | 'error') => void;
  onAfterAction?: (updatedResults: MatchResult[]) => void;
}

export const useReconciliationActions = ({
  reconciliation,
  referenceData,
  reportManager,
  showToast,
  onAfterAction
}: UseReconciliationActionsProps) => {

  // ✅ GARANTE CONTRIBUTOR SEMPRE VÁLIDO
  const buildSafeContributor = (original: MatchResult, contributionType?: string, paymentMethod?: string): Contributor => {
    const base = original.contributor;

    return {
      id: base?.id || `temp-${original.transaction.id}`, // 🔥 CORREÇÃO CRÍTICA
      name: base?.name || original.transaction.cleanedDescription || original.transaction.description,
      amount: base?.amount || original.transaction.amount,
      cleanedName: base?.cleanedName || original.transaction.cleanedDescription || original.transaction.description,
      contributionType: contributionType ?? base?.contributionType ?? null,
      paymentMethod: paymentMethod ?? base?.paymentMethod ?? null
    };
  };

  const confirmManualIdentification = useCallback(async (txId: string, churchId: string, contributionType?: string, paymentMethod?: string) => {
    const church = referenceData.churches.find((c: Church) => c.id === churchId);
    if (!church) return;

    const currentResults = [...reconciliation.fullMatchResults];
    const idx = currentResults.findIndex(r => r.transaction.id === txId);
    if (idx === -1) return;

    const originalResult = currentResults[idx];

    // ✅ USANDO BUILDER SEGURO
    const contributor: Contributor = buildSafeContributor(originalResult, contributionType, paymentMethod);

    const updatedResult: MatchResult = {
      ...originalResult,
      status: ReconciliationStatus.IDENTIFIED,
      isConfirmed: false,
      contributor: {
        ...contributor
      },
      church,
      matchMethod: MatchMethod.MANUAL,
      similarity: 100,
      contributorAmount: contributor.amount,
      divergence: undefined,
      contributionType: contributor.contributionType,
      paymentMethod: contributor.paymentMethod,
      transaction: { 
        ...originalResult.transaction,
        isConfirmed: false 
      },
      updatedAt: new Date().toISOString()
    };

    currentResults[idx] = updatedResult;

    if (!txId.includes('ghost') && !txId.includes('sim')) {
      await consolidationService.updateTransactionStatus(
        txId, 
        'identified', 
        churchId, 
        originalResult.transaction.bank_id,
        contributor.id, // 🔥 AGORA SEMPRE VÁLIDO
        false
      );
    }

    reconciliation.setMatchResults(currentResults);

    if (onAfterAction) onAfterAction(currentResults);
    
    // 🔥 CORREÇÃO: usar estado FINAL
    const final = currentResults.find(r => r.transaction.id === txId);
    if (final && reconciliation.triggerSync) {
      reconciliation.triggerSync(final);
    }

    referenceData.learnAssociation(updatedResult);

    reconciliation.closeManualIdentify();
    showToast("Identificado e aprendido pela IA.", "success");

  }, [reconciliation, referenceData, showToast, onAfterAction]);



  const confirmBulkManualIdentification = useCallback(async (txIds: string[], churchId: string, contributionType?: string, paymentMethod?: string) => {
    const church = referenceData.churches.find((c: Church) => c.id === churchId);
    if (!church) return;

    const currentResults = [...reconciliation.fullMatchResults];
    let affectedCount = 0;

    batchState.isBatchUpdating = true;
    try {
      for (const id of txIds) {
        const idx = currentResults.findIndex(r => r.transaction.id === id);
        if (idx === -1) continue;

        const original = currentResults[idx];
        if (original.isConfirmed) continue;

        // ✅ BUILDER SEGURO
        const contributor: Contributor = buildSafeContributor(original, contributionType, paymentMethod);

        const updated: MatchResult = {
          ...original,
          status: ReconciliationStatus.IDENTIFIED,
          isConfirmed: false,
          contributor: {
            ...contributor
          },
          church,
          matchMethod: MatchMethod.MANUAL,
          similarity: 100,
          contributorAmount: contributor.amount,
          divergence: undefined,
          contributionType: contributor.contributionType,
          paymentMethod: contributor.paymentMethod,
          transaction: {
            ...original.transaction,
            isConfirmed: false
          },
          updatedAt: new Date().toISOString()
        };

        currentResults[idx] = updated;

        referenceData.learnAssociation(updated);

        if (!id.includes('ghost') && !id.includes('sim')) {
          await consolidationService.updateTransactionStatus(
            id, 
            'identified', 
            churchId, 
            original.transaction.bank_id,
            contributor.id, // 🔥 GARANTIDO
            false
          );
        }

        affectedCount++;
      }
    } finally {
      batchState.isBatchUpdating = false;
    }

    reconciliation.setMatchResults(currentResults);

    if (onAfterAction) onAfterAction(currentResults);

    // 🔥 CORREÇÃO: sync com estado final
    if (reconciliation.triggerSync) {
      txIds.forEach(id => {
        const final = currentResults.find(r => r.transaction.id === id);
        if (final) reconciliation.triggerSync(final);
      });
    }

    reconciliation.closeManualIdentify();

    showToast(`${affectedCount} registros identificados e aprendidos.`, "success");

  }, [reconciliation, referenceData, showToast, onAfterAction]);



  const toggleConfirmation = useCallback(async (txIds: string[], confirmed: boolean) => {

    const idsToUpdate = txIds.filter(
      id =>
        /^[0-9a-fA-F-]{36}$/.test(id) &&
        !id.startsWith('ghost') &&
        !id.startsWith('sim')
    );

    if (idsToUpdate.length > 0) {
      batchState.isBatchUpdating = true;
      try {
        const resultsToUpdate = idsToUpdate
          .map(id => reconciliation.fullMatchResults.find((r: MatchResult) => r.transaction.id === id))
          .filter(Boolean);

        if (resultsToUpdate.length > 0) {
          const first = resultsToUpdate[0];
          const firstChurchId = first.church?.id || first._churchId;
          const firstBankId = first.transaction.bank_id;
          const firstContributorId = first.contributor?.id;

          const isUniform = resultsToUpdate.every(r => {
            const cId = r.church?.id || r._churchId;
            const bId = r.transaction.bank_id;
            const ctId = r.contributor?.id;
            return cId === firstChurchId && bId === firstBankId && ctId === firstContributorId;
          });

          if (isUniform) {
            const allIds = resultsToUpdate.map(r => r.transaction.id);
            await consolidationService.updateConfirmationStatus(allIds, confirmed, firstChurchId, firstBankId, firstContributorId);
          } else {
            for (const result of resultsToUpdate) {
              const churchId = result.church?.id || result._churchId;
              const bankId = result.transaction.bank_id;
              const contributorId = result.contributor?.id;
              await consolidationService.updateConfirmationStatus([result.transaction.id], confirmed, churchId, bankId, contributorId);
            }
          }
        }
      } finally {
        batchState.isBatchUpdating = false;
      }
    }

    const currentResults = reconciliation.fullMatchResults.map((r: MatchResult) => {
      if (txIds.includes(r.transaction.id)) {
        const newStatus = confirmed 
          ? ReconciliationStatus.RESOLVED 
          : (r.contributor ? ReconciliationStatus.IDENTIFIED : ReconciliationStatus.UNIDENTIFIED);
        
        return {
          ...r,
          status: newStatus,
          isConfirmed: confirmed,
          transaction: { ...r.transaction, isConfirmed: confirmed },
          updatedAt: new Date().toISOString()
        };
      }
      return r;
    });

    reconciliation.setMatchResults(currentResults);

    if (onAfterAction) onAfterAction(currentResults);

    // 🔥 CORREÇÃO: sync correto
    if (reconciliation.triggerSync) {
      txIds.forEach(id => {
        const final = currentResults.find(r => r.transaction.id === id);
        if (final) reconciliation.triggerSync(final);
      });
    }

    showToast(
      confirmed
        ? "Registros confirmados e bloqueados."
        : "Bloqueio removido.",
      "success"
    );

  }, [reconciliation, reportManager, showToast, onAfterAction]);



  const undoIdentification = useCallback(async (txId: string) => {

    const existing = reconciliation.fullMatchResults.find(
      (r: MatchResult) => r.transaction.id === txId
    );

    if (existing?.isConfirmed) {
      showToast("Remova o bloqueio antes de desfazer.", "error");
      return;
    }

    if (!txId.includes('ghost') && !txId.includes('sim')) {
      await consolidationService.updateTransactionStatus(txId, 'pending', null, undefined, null, false);
      await consolidationService.updateConfirmationStatus([txId], false, null, undefined, null);
    }

    const updatedResults = reconciliation.fullMatchResults.map((r: MatchResult) => 
      r.transaction.id === txId ? { 
        ...r, 
        status: ReconciliationStatus.UNIDENTIFIED,
        contributor: null,
        church: referenceData.PLACEHOLDER_CHURCH || r.church,
        isConfirmed: false,
        contributionType: null,
        paymentMethod: null,
        transaction: { ...r.transaction, isConfirmed: false },
        updatedAt: new Date().toISOString()
      } : r
    );

    reconciliation.setMatchResults(updatedResults);

    if (onAfterAction) onAfterAction(updatedResults);

    const undone = updatedResults.find(r => r.transaction.id === txId);

    if (undone && reconciliation.triggerSync) {
      reconciliation.triggerSync(undone);
    }

    showToast("Identificação desfeita.", "success");

  }, [reconciliation, showToast, onAfterAction]);


  return {
    confirmManualIdentification,
    confirmBulkManualIdentification,
    undoIdentification,
    toggleConfirmation
  };
};