import { useCallback } from 'react';
import { MatchResult, Church, ReconciliationStatus, MatchMethod, Contributor } from '../types';
import { groupResultsByChurch } from '../services/processingService';
import { consolidationService } from '../services/ConsolidationService';
import { batchState } from './reconciliation/useCloudSync';
import { getAuthSession } from '../services/auth/authAdapter';
import { LaunchService } from '../services/LaunchService';
import { extractNameAndCpf } from '../utils/contributorHelper';
import { CommunicationEventService } from '../services/CommunicationEventService';
import { ExpenseAttachment } from '../types/domain';
import { saveAttachmentsForTransaction } from '../services/expenseAttachmentService';

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

  // 🛡️ CRIAÇÃO AUTOMÁTICA DE CONTRIBUINTES VIA EXTRATO NA VPS
  const ensureRegisteredContributor = async (
    name: string,
    churchId: string,
    cpf?: string | null
  ): Promise<string | null> => {
    try {
      const canonical_name = name.trim().replace(/\s+/g, ' ').toUpperCase();
      if (!canonical_name || !churchId || churchId === 'church-1') return null;

      const cleanCpf = cpf ? cpf.replace(/\D/g, '') : '';
      const hasValidCpf = cleanCpf.length === 11 || cleanCpf.length === 14;

      // 1. Evitar duplicar registros buscando na base completa de contribuintes
      const listResp = await fetch('/api/v1/contributors');
      if (listResp.ok) {
        const list = await listResp.json();
        const existing = list.find((c: any) => {
          const cName = (c.canonical_name || c.name || '').toUpperCase().trim();
          const sameName = cName === canonical_name;
          const sameCpf = hasValidCpf && c.cpf && c.cpf.replace(/\D/g, '') === cleanCpf;
          return sameCpf || sameName;
        });
        if (existing) {
          console.log('[AutoRegister] Contribuinte já cadastrado na VPS:', existing.canonical_name || existing.name);
          return existing.id;
        }
      }

      // 🛡️ REGRA OBRIGATÓRIA: Todo cadastro deve conter CPF/CNPJ, Nome e Igreja.
      // Se não possui CPF/CNPJ válido (11 ou 14 dígitos), não cria novo cadastro para evitar duplicações/incompletos.
      if (!hasValidCpf) {
        console.log('[AutoRegister] Ignorando criação de novo cadastro: CPF/CNPJ obrigatório ausente para:', canonical_name);
        return null;
      }

      // 2. Realizar cadastro com dados completos
      console.log('[AutoRegister] Efetuando cadastro com CPF na VPS para:', canonical_name);
      const postResp = await fetch('/api/v1/contributors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          church_id: churchId,
          canonical_name,
          cpf: cleanCpf,
          status: 'active'
        })
      });

      if (postResp.ok) {
        const result = await postResp.json();
        console.log('[AutoRegister] Cadastrado com sucesso na VPS com ID:', result.id);
        
        // Atualiza a lista na UI re-sincronizando o hook global
        if (reconciliation.fetchContributorsToFiles) {
          reconciliation.fetchContributorsToFiles();
        }
        
        return result.id;
      }
    } catch (e) {
      console.error('[ensureRegisteredContributor] erro:', e);
    }
    return null;
  };

  const confirmBulkManualIdentification = useCallback(async (
    txIds: string[], 
    churchId: string, 
    contributionType?: string, 
    paymentMethod?: string,
    selectedDate?: string,
    manualDescription?: string,
    manualAmount?: string,
    unifiedContributorId?: string,
    manualType?: 'entrada' | 'saida',
    selectedBankId?: string,
    attachments?: ExpenseAttachment[]
  ) => {
    const church = referenceData.churches.find((c: Church) => c.id === churchId);
    if (!church) return;

    let affectedCount = 0;
    const isManualLaunch = txIds.some(id => id.startsWith('ghost-manual-'));

    if (isManualLaunch) {
      batchState.isBatchUpdating = true;
      try {
        const session = await getAuthSession();
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
        const isEntrada = manualType 
          ? manualType === 'entrada'
          : (originalDesc.toLowerCase().includes('entrada') || 
             (manualDescription ? manualDescription.toLowerCase().includes('entrada') : false));
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

        // 1. Resolver e preparar contribuinte antes da inserção
        const tempPreOriginal: MatchResult = {
          transaction: {
            id: 'temp-manual',
            date: finalDate,
            description: finalDescription,
            rawDescription: '',
            amount: finalAmount,
            type: txType,
            isConfirmed: false,
            cleanedDescription: finalDescription,
            bank_id: selectedBankId || undefined,
            source: 'manual',
            isManual: true
          },
          contributor: null,
          status: ReconciliationStatus.PENDING,
          church,
          isConfirmed: false,
          updatedAt: new Date().toISOString()
        };

        const contributor = buildSafeContributor(tempPreOriginal, contributionType, paymentMethod);

        let finalContributorId = unifiedContributorId;
        if (!finalContributorId && finalDescription) {
          const { name, cpf } = extractNameAndCpf(finalDescription);
          if (name) {
            finalContributorId = await ensureRegisteredContributor(name, churchId, cpf) || undefined;
          }
        }

        let registeredName = '';
        let originalContributorChurchId = '';
        if (finalContributorId) {
          contributor.id = finalContributorId;
          const foundContrib = reconciliation.contributorFiles
            ?.flatMap((f: any) => f.contributors || [])
            .find((c: any) => c.id === finalContributorId);
          if (foundContrib) {
            registeredName = foundContrib.name || foundContrib.cleanedName || foundContrib.canonical_name;
            originalContributorChurchId = foundContrib._churchId || foundContrib.church_id || foundContrib.church?.id || '';
          } else {
            const { name } = extractNameAndCpf(finalDescription);
            if (name) {
              registeredName = name.trim().replace(/\s+/g, ' ').toUpperCase();
            }
          }
        } else if (contributor.id && contributor.id.startsWith('temp-')) {
          delete contributor.id;
        }

        if (registeredName) {
          contributor.name = registeredName;
          contributor.cleanedName = registeredName;
        }
        if (originalContributorChurchId) {
          (contributor as any)._churchId = originalContributorChurchId;
          (contributor as any).church_id = originalContributorChurchId;
        }

        const isValidUuid = (id: any) => id && /^[0-9a-fA-F-]{36}$/.test(id);
        const actualContributorId = isValidUuid(contributor.id) ? contributor.id : undefined;

        // 2. Inserção Atômica já com status "identified" e todos os campos contábeis
        const newTxPayload = {
          user_id: userId,
          church_id: isValidUuid(churchId) ? churchId : null,
          status: 'identified' as const,
          is_confirmed: false,
          amount: finalAmount,
          type: txType,
          transaction_date: finalDate,
          description: finalDescription,
          bank_id: isValidUuid(selectedBankId) ? selectedBankId : null,
          row_hash: globalHash,
          source: 'manual',
          contributor_id: actualContributorId || null,
          contribution_type: contributionType || null,
          payment_method: paymentMethod || null
        };

        const result = await consolidationService.addTransactions([newTxPayload]);

        // 3. Capturar e validar ID REAL do banco
        const realId = result?.[0]?.id;

        if (!realId || !/^[0-9a-fA-F-]{36}$/.test(realId)) {
          throw new Error(`ID REAL inválido retornado pelo banco após INSERT: ${realId}`);
        }

        const tempOriginal: MatchResult = {
          transaction: {
            id: realId,
            date: finalDate,
            description: finalDescription,
            rawDescription: '',
            amount: finalAmount,
            type: txType,
            isConfirmed: false,
            cleanedDescription: finalDescription,
            bank_id: selectedBankId || undefined,
            source: 'manual',
            isManual: true,
            contributionType,
            paymentMethod
          },
          contributor,
          status: ReconciliationStatus.IDENTIFIED,
          church,
          isConfirmed: false,
          updatedAt: new Date().toISOString()
        };

        // Salva os comprovantes e faturas no armazenamento persistente
        if (attachments && attachments.length > 0) {
          try {
            await saveAttachmentsForTransaction(realId, attachments);
          } catch (attErr) {
            console.error('[confirmBulkManualIdentification] Erro ao persistir anexos:', attErr);
          }
        }

        // 4. Registrar o aprendizado (Association) usando o ID real
        const updatedMatchResult: MatchResult = {
          ...tempOriginal,
          transaction: {
            ...tempOriginal.transaction,
            type: txType,
            bank_id: selectedBankId || undefined,
            attachments: attachments && attachments.length > 0 ? attachments : undefined
          },
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
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

        // Substitui o ghost-manual pelo MatchResult com ID real no estado da UI, preservando todos os itens existentes
        batchState.isAtomicUpdate = true;
        reconciliation.setMatchResults((prev: MatchResult[]) => {
          const withoutGhostsAndReal = prev.filter(r => !txIds.includes(r.transaction.id) && r.transaction.id !== realId);
          const final = [...withoutGhostsAndReal, updatedMatchResult];
          if (onAfterAction) onAfterAction(final);
          return final;
        });

        // Mantém [SESSÃO_ATIVA] sincronizada com a lista completa combinada
        if (reportManager?.savedReports && reportManager?.overwriteSavedReport) {
          const liveReport = reportManager.savedReports.find((r: any) => r.name === '[SESSÃO_ATIVA]');
          if (liveReport) {
            const currentList = reconciliation.matchResults || [];
            const withoutGhostsAndReal = currentList.filter((r: MatchResult) => !txIds.includes(r.transaction.id) && r.transaction.id !== realId);
            reportManager.overwriteSavedReport(liveReport.id, [...withoutGhostsAndReal, updatedMatchResult]);
          }
        }

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
    const txToContributorIdMap = new Map<string, string>();

    try {
      // 1. Persistência Assíncrona (Processamento em Lote)
      for (const id of txIds) {
        const original = reconciliation.fullMatchResults.find((r: MatchResult) => r.transaction.id === id);
        if (!original || original.isConfirmed) continue;

        let finalContributorId = unifiedContributorId;

        // Se nenhum unificado foi passado de forma explícita, cadastra de forma automática
        if (!finalContributorId && !id.includes('ghost') && !id.startsWith('sim')) {
          const nameToUse = (txIds.length === 1 && manualDescription && manualDescription.trim().length > 0) 
            ? manualDescription.trim() 
            : extractNameAndCpf(original.transaction.description).name;
          
          const cpfToUse = (txIds.length === 1 && manualDescription && manualDescription.trim().length > 0) 
            ? undefined 
            : extractNameAndCpf(original.transaction.description).cpf;

          if (nameToUse) {
            finalContributorId = await ensureRegisteredContributor(nameToUse, churchId, cpfToUse) || undefined;
          }
        }

        if (finalContributorId) {
          txToContributorIdMap.set(id, finalContributorId);
        }

        const contributorIdToUse = finalContributorId || original.contributor?.id;

        if (!id.includes('ghost') && !id.startsWith('sim')) {
          const isSelectedCategorySaida = 
            (contributionType && (contributionType.toLowerCase().includes('saida') || contributionType.toLowerCase().includes('saída') || contributionType.toLowerCase().includes('despesa'))) ||
            (referenceData.contributionTypes || []).some((ct: any) => ct.name?.toUpperCase() === contributionType?.toUpperCase() && ct.type === 'saida');

          const isTxDescSaida = (() => {
            const d = (original.transaction.description || original.transaction.rawDescription || '').toLowerCase();
            return d.includes('pix enviado') || d.includes('pagamento') || d.includes('pagto') || d.includes('pago a') || d.includes('debito') || d.includes('débito') || d.includes('ted enviada') || d.includes('doc enviado');
          })();

          const isExpense = 
            manualType === 'saida' ||
            isSelectedCategorySaida ||
            (manualType !== 'entrada' && (
              Number(original.transaction.amount) < 0 ||
              original.transaction.type === 'expense' ||
              original.transaction.type === 'saida' ||
              original.contributionType?.toLowerCase().includes('saída') ||
              original.contributionType?.toLowerCase().includes('saida') ||
              original.contributionType?.toLowerCase().includes('despesa') ||
              isTxDescSaida
            ));

          const itemType: 'income' | 'expense' = isExpense ? 'expense' : 'income';
          const originalAmountNum = Number(original.transaction.amount) || 0;
          const finalAmount = isExpense ? -Math.abs(originalAmountNum) : Math.abs(originalAmountNum);
          const finalRefDate = selectedDate || original.reference_date || original.transaction.reference_date || undefined;

          await consolidationService.updateTransactionStatus(
            id, 
            'identified', 
            churchId, 
            original.transaction.bank_id,
            contributorIdToUse,
            false,
            itemType,
            undefined,
            contributionType,
            paymentMethod,
            finalRefDate,
            finalAmount
          );
        }
        affectedCount++;
      }

      // Salva anexos para as transações identificadas se houver
      if (attachments && attachments.length > 0) {
        try {
          for (const id of txIds) {
            await saveAttachmentsForTransaction(id, attachments);
          }
        } catch (attErr) {
          console.error('[confirmBulkManualIdentification] Erro ao salvar anexos não-manual:', attErr);
        }
      }

      // 2. Atualização Atômica de Estado (Padrão idêntico ao toggleConfirmation com consistência total)
      batchState.isAtomicUpdate = true;
      reconciliation.setMatchResults((prev: MatchResult[]) => {
        const finalResults = prev.map(r => {
          if (!txIds.includes(r.transaction.id) || r.isConfirmed) return r;

          const matchingContributorId = txToContributorIdMap.get(r.transaction.id) || unifiedContributorId;

          const isSelectedCategorySaida = 
            (contributionType && (contributionType.toLowerCase().includes('saida') || contributionType.toLowerCase().includes('saída') || contributionType.toLowerCase().includes('despesa'))) ||
            (referenceData.contributionTypes || []).some((ct: any) => ct.name?.toUpperCase() === contributionType?.toUpperCase() && ct.type === 'saida');

          const isTxDescSaida = (() => {
            const d = (r.transaction.description || r.transaction.rawDescription || '').toLowerCase();
            return d.includes('pix enviado') || d.includes('pagamento') || d.includes('pagto') || d.includes('pago a') || d.includes('debito') || d.includes('débito') || d.includes('ted enviada') || d.includes('doc enviado');
          })();

          const isExpense = 
            manualType === 'saida' ||
            isSelectedCategorySaida ||
            (manualType !== 'entrada' && (
              Number(r.transaction.amount) < 0 ||
              r.transaction.type === 'expense' ||
              r.transaction.type === 'saida' ||
              r.contributionType?.toLowerCase().includes('saída') ||
              r.contributionType?.toLowerCase().includes('saida') ||
              r.contributionType?.toLowerCase().includes('despesa') ||
              isTxDescSaida
            ));

          const finalTxType: 'income' | 'expense' = isExpense ? 'expense' : 'income';
          const originalAmountNum = Number(r.transaction.amount) || (r.contributor ? Number(r.contributor.amount) : 0);
          const finalAmount = isExpense ? -Math.abs(originalAmountNum) : Math.abs(originalAmountNum);

          const contributor = {
            ...buildSafeContributor(r, contributionType, paymentMethod),
            ...(matchingContributorId ? { id: matchingContributorId } : {}),
            amount: finalAmount,
            reference_date: selectedDate || r.reference_date || r.transaction.reference_date || null
          };

          let registeredName = '';
          let originalContributorChurchId = '';
          if (matchingContributorId) {
            const foundContrib = reconciliation.contributorFiles
              ?.flatMap((f: any) => f.contributors || [])
              .find((c: any) => c.id === matchingContributorId);
            if (foundContrib) {
              registeredName = foundContrib.name || foundContrib.cleanedName || foundContrib.canonical_name;
              originalContributorChurchId = foundContrib._churchId || foundContrib.church_id || foundContrib.church?.id || '';
            } else {
              // Fallback se acabou de ser criado e ainda não refletiu na lista
              const nameToUse = (txIds.length === 1 && manualDescription && manualDescription.trim().length > 0)
                ? manualDescription.trim()
                : extractNameAndCpf(r.transaction.description).name;
              if (nameToUse) {
                registeredName = nameToUse.trim().replace(/\s+/g, ' ').toUpperCase();
              }
            }
          }

          if (registeredName) {
            contributor.name = registeredName;
            contributor.cleanedName = registeredName;
          }
          if (originalContributorChurchId) {
            (contributor as any)._churchId = originalContributorChurchId;
            (contributor as any).church_id = originalContributorChurchId;
          }

          const finalRefDate = selectedDate || r.reference_date || r.transaction.reference_date || null;

          const updated: MatchResult = {
            ...r,
            status: ReconciliationStatus.IDENTIFIED,
            isConfirmed: false,
            contributor: { ...contributor },
            church,
            _churchId: church.id,
            matchMethod: MatchMethod.MANUAL,
            similarity: 100,
            contributorAmount: finalAmount,
            contributionType: contributor.contributionType, // Proteção contra sobrescrita
            paymentMethod: contributor.paymentMethod,       // Proteção contra sobrescrita
            reference_date: finalRefDate,
            transaction: { 
              ...r.transaction,
              type: finalTxType,
              amount: finalAmount,
              contributionType: contributor.contributionType,
              reference_date: finalRefDate,
              isConfirmed: false,
              attachments: (attachments && attachments.length > 0) ? attachments : r.transaction.attachments
            },
            attachments: (attachments && attachments.length > 0) ? attachments : r.attachments,
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
            await Promise.all(
              resultsToUpdate.map(async (result) => {
                const churchId = result.church?.id || result._churchId;
                const bankId = result.transaction.bank_id;
                const contributorId = result.contributor?.id;
                await consolidationService.updateConfirmationStatus([result.transaction.id], confirmed, churchId, bankId, contributorId);
              })
            );
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
        if (final) {
          reconciliation.triggerSync(final);

          // Efeito colateral desacoplado: Central de Comunicação (ContributionConfirmed)
          if (confirmed) {
            CommunicationEventService.publish('ContributionConfirmed', {
              church_id: final.church?.id || final._churchId,
              contributor_id: final.contributor?.id,
              contributor_name: final.contributor?.name,
              contributor_phone: final.contributor?.whatsapp || final.contributor?.phone,
              reference_id: final.transaction.id,
              amount: final.transaction.amount,
              description: final.transaction.description,
              payment_method: final.paymentMethod || final.transaction.payment_method,
              contribution_type: final.contributionType || final.transaction.contribution_type
            }).catch(e => console.error('[EventPublish] Error:', e));
          }
        }
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