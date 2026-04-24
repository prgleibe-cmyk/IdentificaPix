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

  const confirmManualIdentification = useCallback(async (txId: string, churchId: string, contributionType?: string, paymentMethod?: string) => {
    const church = referenceData.churches.find((c: Church) => c.id === churchId);
    if (!church) return;

    const currentResults = [...reconciliation.fullMatchResults];
    const idx = currentResults.findIndex(r => r.transaction.id === txId);
    if (idx === -1) return;

    const originalResult = currentResults[idx];

    const finalContributionType = contributionType !== undefined ? contributionType : originalResult.contributionType;
    const finalPaymentMethod = paymentMethod !== undefined ? paymentMethod : originalResult.paymentMethod;

    console.log('📥 INPUT ANTES DO UPDATE', {
      selectedType: contributionType,
      selectedPaymentMethod: paymentMethod,
      originalType: originalResult.contributionType,
      originalPaymentMethod: originalResult.paymentMethod,
      finalType: finalContributionType,
      finalPaymentMethod: finalPaymentMethod
    });

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
      divergence: undefined,
      contributionType: finalContributionType,
      paymentMethod: finalPaymentMethod,
      updatedAt: new Date().toISOString()
    };

    currentResults[idx] = updatedResult;

    if (!txId.includes('ghost') && !txId.includes('sim')) {
      console.log("🧩 [HOOK -> UPDATE]", {
        id: txId,
        contributionType,
        paymentMethod
      });
      await consolidationService.updateTransactionStatus(
        txId, 
        'identified', 
        churchId, 
        originalResult.transaction.bank_id,
        contributor.id,
        false,
        finalContributionType,
        finalPaymentMethod
      );
    }

    reconciliation.setMatchResults(currentResults);
    if (onAfterAction) onAfterAction(currentResults);

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

        const finalContributionType = contributionType !== undefined ? contributionType : original.contributionType;
        const finalPaymentMethod = paymentMethod !== undefined ? paymentMethod : original.paymentMethod;

        console.log('📥 INPUT ANTES DO UPDATE (BulkItem)', {
          id,
          selectedType: contributionType,
          selectedPaymentMethod: paymentMethod,
          originalType: original.contributionType,
          originalPaymentMethod: original.paymentMethod,
          finalType: finalContributionType,
          finalPaymentMethod: finalPaymentMethod
        });

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
          divergence: undefined,
          contributionType: finalContributionType,
          paymentMethod: finalPaymentMethod,
          updatedAt: new Date().toISOString()
        };

        currentResults[idx] = updated;

        referenceData.learnAssociation(updated);

        if (!id.includes('ghost') && !id.includes('sim')) {
          console.log("🧩 [HOOK -> UPDATE] (BulkItem)", {
            id,
            contributionType,
            paymentMethod
          });
          await consolidationService.updateTransactionStatus(
            id, 
            'identified', 
            churchId, 
            original.transaction.bank_id,
            contributor.id,
            false,
            finalContributionType,
            finalPaymentMethod
          );
        }

        affectedCount++;
      }
    } finally {
      batchState.isBatchUpdating = false;
    }

    reconciliation.setMatchResults(currentResults);

    reconciliation.closeManualIdentify();

    showToast(`${affectedCount} registros identificados e aprendidos.`, "success");

    if (onAfterAction) onAfterAction(currentResults);

  }, [reconciliation, referenceData, showToast, onAfterAction]);



  const toggleConfirmation = useCallback(async (txIds: string[], confirmed: boolean) => {

    const idsToUpdate = txIds.filter(
      id =>
        /^[0-9a-fA-F-]{36}$/.test(id) &&
        !id.startsWith('ghost') &&
        !id.startsWith('sim')
    );

    if (idsToUpdate.length > 0) {
      // Sincronização atômica: Garante que cada transação persista sua igreja e banco ao confirmar
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
          const firstContributionType = first.contributionType;
          const firstPaymentMethod = first.paymentMethod;

          // Verificamos se todos os itens compartilham os mesmos metadados para aplicar Bulk Update
          const isUniform = resultsToUpdate.every(r => {
            const cId = r.church?.id || r._churchId;
            const bId = r.transaction.bank_id;
            const ctId = r.contributor?.id;
            const cType = r.contributionType;
            const pMethod = r.paymentMethod;
            return cId === firstChurchId && bId === firstBankId && ctId === firstContributorId && cType === firstContributionType && pMethod === firstPaymentMethod;
          });

          if (isUniform) {
            // Otimização: Chamada única em lote
            const allIds = resultsToUpdate.map(r => r.transaction.id);
            console.log("🧩 [HOOK -> UPDATE] (Toggle-Bulk)", {
              ids: allIds,
              contributionType: firstContributionType,
              paymentMethod: firstPaymentMethod
            });
            await consolidationService.updateConfirmationStatus(allIds, confirmed, firstChurchId, firstBankId, firstContributorId, firstContributionType, firstPaymentMethod);
          } else {
            // Fallback: Mantém o comportamento original sequencial se houver variações
            for (const result of resultsToUpdate) {
              const churchId = result.church?.id || result._churchId;
              const bankId = result.transaction.bank_id;
              const contributorId = result.contributor?.id;
              const cType = result.contributionType;
              const pMethod = result.paymentMethod;
              console.log("🧩 [HOOK -> UPDATE] (Toggle-Sequential)", {
                id: result.transaction.id,
                contributionType: cType,
                paymentMethod: pMethod
              });
              await consolidationService.updateConfirmationStatus([result.transaction.id], confirmed, churchId, bankId, contributorId, cType, pMethod);
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

    if (onAfterAction) onAfterAction(currentResults);

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
        transaction: { ...r.transaction, isConfirmed: false },
        updatedAt: new Date().toISOString()
      } : r
    );

    reconciliation.setMatchResults(updatedResults);
    if (onAfterAction) onAfterAction(updatedResults);

    showToast("Identificação desfeita.", "success");

  }, [reconciliation, showToast, onAfterAction]);


  return {
    confirmManualIdentification,
    confirmBulkManualIdentification,
    undoIdentification,
    toggleConfirmation
  };
};