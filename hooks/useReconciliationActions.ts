import { useCallback } from 'react';
import { MatchResult, Church, ReconciliationStatus, MatchMethod, Contributor } from '../types';
import { groupResultsByChurch } from '../services/processingService';
import { consolidationService } from '../services/ConsolidationService';

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

  const confirmManualIdentification = useCallback(async (txId: string, churchId: string) => {
    const church = referenceData.churches.find((c: Church) => c.id === churchId);
    if (!church) return;

    const currentResults = [...reconciliation.fullMatchResults];
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

    const currentResults = [...reconciliation.fullMatchResults];
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

    // ✅ ATUALIZAÇÃO DOS RELATÓRIOS SALVOS (Para refletir no SearchView imediatamente)
    if (reportManager?.setSavedReports) {
      reportManager.setSavedReports((prev: any[]) => {
        let anyReportUpdated = false;
        const updated = prev.map(report => {
          if (!report.data?.results) return report;
          let reportUpdated = false;
          const newResults = report.data.results.map((r: any) => {
            if (txIds.includes(r.transaction?.id)) {
              const contributor: Contributor = r.contributor || {
                name: r.transaction.cleanedDescription || r.transaction.description,
                amount: r.transaction.amount,
                cleanedName: r.transaction.cleanedDescription || r.transaction.description
              };
              reportUpdated = true;
              anyReportUpdated = true;
              return { 
                ...r, 
                status: ReconciliationStatus.IDENTIFIED,
                contributor,
                church,
                matchMethod: MatchMethod.MANUAL,
                similarity: 100,
                contributorAmount: contributor.amount,
                divergence: undefined
              };
            }
            return r;
          });
          if (!reportUpdated) return report;
          return { ...report, data: { ...report.data, results: newResults } };
        });
        return anyReportUpdated ? updated : prev;
      });
    }

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
      await consolidationService.updateConfirmationStatus(idsToUpdate, confirmed);
    }

    const currentResults = reconciliation.fullMatchResults.map((r: MatchResult) => {
      if (txIds.includes(r.transaction.id)) {
        return {
          ...r,
          isConfirmed: confirmed,
          transaction: { ...r.transaction, isConfirmed: confirmed }
        };
      }
      return r;
    });

    reconciliation.setMatchResults(currentResults);

    // ✅ ATUALIZAÇÃO DOS RELATÓRIOS SALVOS (Para refletir no SearchView imediatamente)
    if (reportManager?.setSavedReports) {
      reportManager.setSavedReports((prev: any[]) => {
        let anyReportUpdated = false;
        const updated = prev.map(report => {
          if (!report.data?.results) return report;
          let reportUpdated = false;
          const newResults = report.data.results.map((r: any) => {
            if (txIds.includes(r.transaction?.id)) {
              reportUpdated = true;
              anyReportUpdated = true;
              return { 
                ...r, 
                isConfirmed: confirmed, 
                transaction: { ...r.transaction, isConfirmed: confirmed } 
              };
            }
            return r;
          });
          if (!reportUpdated) return report;
          return { ...report, data: { ...report.data, results: newResults } };
        });
        return anyReportUpdated ? updated : prev;
      });
    }

    showToast(
      confirmed
        ? "Registros confirmados e bloqueados."
        : "Bloqueio removido.",
      "success"
    );

    if (onAfterAction) onAfterAction(currentResults);

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
      await consolidationService.updateTransactionStatus(txId, 'pending');
    }

    reconciliation.revertMatch(txId);

    showToast("Identificação desfeita.", "success");

    setTimeout(() => {
      if (onAfterAction) onAfterAction(reconciliation.fullMatchResults);
    }, 100);

  }, [reconciliation, showToast, onAfterAction]);


  return {
    confirmManualIdentification,
    confirmBulkManualIdentification,
    undoIdentification,
    toggleConfirmation
  };
};