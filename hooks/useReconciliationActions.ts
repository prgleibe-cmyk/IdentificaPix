import { useCallback } from 'react';
import { MatchResult, Church, ReconciliationStatus, MatchMethod, Contributor } from '../types';
import { groupResultsByChurch } from '../services/processingService';
import { consolidationService } from '../services/ConsolidationService';
import { batchState } from './reconciliation/useCloudSync';
import { supabase } from '../services/supabaseClient';
import { LaunchService } from '../services/LaunchService';

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

  const confirmBulkManualIdentification = useCallback(async (
    txIds: string[], 
    churchId: string, 
    contributionType?: string, 
    paymentMethod?: string,
    selectedDate?: string,
    manualDescription?: string,
    manualAmount?: string
  ) => {
    const church = referenceData.churches.find((c: Church) => c.id === churchId);
    if (!church) return;

    let affectedCount = 0;
    const isManualLaunch = txIds.some(id => id.startsWith('ghost-manual-'));

    if (isManualLaunch) {
      batchState.isBatchUpdating = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) {
          throw new Error("Usuário não autenticado no confirmBulkManualIdentification.");
        }

        let amount = 0;
        if (manualAmount) {
          const sanitizedAmount = manualAmount.replace(/\./g, '').replace(',', '.').trim();
          amount = parseFloat(sanitizedAmount) || 0;
        }

        const ghostTx = reconciliation.bulkIdentificationTxs?.find((tx: any) => txIds.includes(tx.id)) || 
                        reconciliation.bulkIdentificationTxs?.find((tx: any) => tx.id.startsWith('ghost-manual-'));
        const originalDesc = ghostTx?.description || '';
        const isEntrada = originalDesc.toLowerCase().includes('entrada') || 
                          (manualDescription ? manualDescription.toLowerCase().includes('entrada') : false);
        const txType: 'income' | 'expense' = isEntrada ? 'income' : 'expense';

        let finalAmount = amount;
        if (txType === 'expense' && finalAmount > 0) {
          finalAmount = -finalAmount;
        } else if (txType === 'income' && finalAmount < 0) {
          finalAmount = Math.abs(finalAmount);
        }

        const finalDescription = manualDescription ? manualDescription.trim() : (isEntrada ? 'Lançamento Manual Entrada' : 'Lançamento Manual Saída');
        const finalDate = selectedDate || new Date().toISOString().split('T')[0];

        // Geração de hash robusto e de acordo com o sistema
        const stableRaw = finalDescription.replace(/\r\n/g, '\n').trim();
        const globalHashKey = `U${userId}|Bmanual|R${stableRaw}|D${finalDate}|A${finalAmount}`;
        const globalHash = LaunchService.computeBaseHash(globalHashKey);

        const newTxPayload = {
          user_id: userId,
          status: 'pending' as const,
          is_confirmed: false,
          amount: finalAmount,
          type: txType,
          transaction_date: finalDate,
          description: finalDescription,
          bank_id: null,
          row_hash: globalHash
        };

        const result = await consolidationService.addTransactions([newTxPayload]);

        // 1. Capturar e validar ID REAL do Supabase
        const realId = result?.[0]?.id;

        if (!realId || !/^[0-9a-fA-F-]{36}$/.test(realId)) {
          throw new Error(`ID REAL inválido retornado pelo banco após INSERT: ${realId}`);
        }

        // 2. Construir MatchResult temporário sem depender do ghost
        const tempOriginal: MatchResult = {
          transaction: {
            id: realId,
            date: finalDate,
            description: finalDescription,
            rawDescription: finalDescription,
            amount: finalAmount,
            isConfirmed: false,
            cleanedDescription: finalDescription
          },
          contributor: null,
          status: ReconciliationStatus.PENDING,
          church,
          isConfirmed: false,
          updatedAt: new Date().toISOString()
        };

        // 3. Executar o mesmo fluxo oficial já existente de identificação usando o ID REAL
        const contributor = buildSafeContributor(tempOriginal, contributionType, paymentMethod);

        // No fluxo manual: NÃO gerar contributorId fake/temporário
        if (contributor.id && contributor.id.startsWith('temp-')) {
          delete contributor.id;
        }

        const isValidUuid = (id: any) => id && /^[0-9a-fA-F-]{36}$/.test(id);
        const finalContributorId = isValidUuid(contributor.id) ? contributor.id : undefined;

        const updatePayload = {
          id: realId,
          status: 'identified' as const,
          churchId,
          bankId: undefined,
          contributorId: finalContributorId,
          isConfirmed: false,
          type: txType,
          paymentMethod
        };

        const updateResult = await consolidationService.updateTransactionStatus(
          realId,
          'identified',
          churchId,
          undefined,
          finalContributorId,
          false,
          txType, // 🔥 CORREÇÃO: Passar txType ('income' | 'expense') para garantir validador e tipo corretos!
          paymentMethod,
          contributionType,
          paymentMethod
        );

        if (!updateResult) {
          throw new Error(`Falha ao identificar a transação com ID REAL no updateTransactionStatus.`);
        }

        // 4. Registrar o aprendizado (Association) usando o ID real
        const updatedMatchResult: MatchResult = {
          ...tempOriginal,
          status: ReconciliationStatus.IDENTIFIED,
          isConfirmed: false,
          contributor,
          church,
          _churchId: church.id,
          matchMethod: MatchMethod.MANUAL,
          similarity: 100,
          contributorAmount: contributor.amount,
          contributionType: contributor.contributionType,
          paymentMethod: contributor.paymentMethod,
          updatedAt: new Date().toISOString()
        };

        referenceData.learnAssociation(updatedMatchResult);

        // 5. Sincronização Realtime (Padrão de Propagação Imediata)
        if (reconciliation.triggerSync) {
          reconciliation.triggerSync(updatedMatchResult);
        }

        // Remove ghost-manual do estado da UI para que seja mapeado pelo realtime naturalmente quando chegar do BD
        batchState.isAtomicUpdate = true;
        reconciliation.setMatchResults((prev: MatchResult[]) => {
          const final = prev.filter(r => !txIds.includes(r.transaction.id));
          if (onAfterAction) onAfterAction(final);
          return final;
        });

        affectedCount = 1;
      } catch (error: any) {
        console.error("[confirmBulkManualIdentification] Erro ao salvar lançamento manual:", error);
        showToast("Erro ao salvar lançamento manual.", "error");
        throw error;
      } finally {
        batchState.isBatchUpdating = false;
      }

      reconciliation.closeManualIdentify();
      showToast("Lançamento manual criado com sucesso.", "success");
      return;
    }

    batchState.isBatchUpdating = true;

    try {
      // 1. Persistência Assíncrona (Processamento em Lote)
      for (const id of txIds) {
        const original = reconciliation.fullMatchResults.find((r: MatchResult) => r.transaction.id === id);
        if (!original || original.isConfirmed) continue;

        const contributor = buildSafeContributor(original, contributionType, paymentMethod);

        if (!id.includes('ghost') && !id.startsWith('sim')) {
          const itemType = (original.transaction.amount >= 0) ? 'income' : 'expense';
          await consolidationService.updateTransactionStatus(
            id, 
            'identified', 
            churchId, 
            original.transaction.bank_id,
            contributor.id,
            false,
            itemType,
            undefined,
            contributionType,
            paymentMethod
          );
        }
        affectedCount++;
      }

      // 2. Atualização Atômica de Estado (Padrão idêntico ao toggleConfirmation com consistência total)
      batchState.isAtomicUpdate = true;
      reconciliation.setMatchResults((prev: MatchResult[]) => {
        const finalResults = prev.map(r => {
          if (!txIds.includes(r.transaction.id) || r.isConfirmed) return r;

          const contributor = buildSafeContributor(r, contributionType, paymentMethod);

          const updated: MatchResult = {
            ...r,
            status: ReconciliationStatus.IDENTIFIED,
            isConfirmed: false,
            contributor: { ...contributor },
            church,
            _churchId: church.id,
            matchMethod: MatchMethod.MANUAL,
            similarity: 100,
            contributorAmount: contributor.amount,
            contributionType: contributor.contributionType, // Proteção contra sobrescrita
            paymentMethod: contributor.paymentMethod,       // Proteção contra sobrescrita
            transaction: { 
              ...r.transaction,
              isConfirmed: false 
            },
            updatedAt: new Date().toISOString()
          };

          // Aprender a associação para IA
          referenceData.learnAssociation(updated);

          // 3. Sincronização Realtime (Padrão de Propagação Imediata)
          if (reconciliation.triggerSync) {
            reconciliation.triggerSync(updated);
          }

          return updated;
        });

        if (onAfterAction) onAfterAction(finalResults);
        return finalResults;
      });

    } finally {
      batchState.isBatchUpdating = false;
    }

    reconciliation.closeManualIdentify();
    showToast(`${affectedCount} registros identificados.`, "success");

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
          : ( (r.contributor || r.church || r._churchId) ? ReconciliationStatus.IDENTIFIED : ReconciliationStatus.UNIDENTIFIED);
        
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

    batchState.isAtomicUpdate = true;
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
        church: null,
        _churchId: null,
        isConfirmed: false,
        contributionType: null,
        paymentMethod: null,
        transaction: { ...r.transaction, isConfirmed: false },
        updatedAt: new Date().toISOString()
      } : r
    );

    batchState.isAtomicUpdate = true;
    reconciliation.setMatchResults(updatedResults);

    if (onAfterAction) onAfterAction(updatedResults);

    const undone = updatedResults.find(r => r.transaction.id === txId);

    if (undone && reconciliation.triggerSync) {
      reconciliation.triggerSync(undone);
    }

    showToast("Identificação desfeita.", "success");

  }, [reconciliation, showToast, onAfterAction]);


  return {
    confirmBulkManualIdentification,
    undoIdentification,
    toggleConfirmation
  };
};