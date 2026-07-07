import { supabase } from './supabaseClient';
import { Database } from '../types/supabase';
import { DateResolver } from '../core/processors/DateResolver';

const ownerIdCache = new Map<string, string>();

const getEffectiveUserId = async (currentUserId: string | undefined): Promise<string | undefined> => {
    if (!currentUserId) return undefined;
    if (ownerIdCache.has(currentUserId)) {
        return ownerIdCache.get(currentUserId);
    }
    const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('owner_id')
        .eq('id', currentUserId)
        .maybeSingle();
    const ownerId = profile?.owner_id || currentUserId;
    ownerIdCache.set(currentUserId, ownerId);
    return ownerId;
};

type ConsolidatedTransactionInsert = Database['public']['Tables']['consolidated_transactions']['Insert'];

export const consolidationService = {

    /**
     * Helper genérico para busca paginada (Centralização de Lógica) utilizando a API da VPS
     */
    _fetchPaginated: async (urlBuilder: (offset: number, limit: number) => string, step: number = 1000, maxRecords?: number) => {
        let allData: any[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore && (!maxRecords || allData.length < maxRecords)) {
            const url = urlBuilder(offset, step);
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Erro ao buscar dados paginados da VPS: ${res.statusText}`);
            }
            const data = await res.json();
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                offset += step;
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        }
        return allData;
    },

    addTransactions: async (transactions: ConsolidatedTransactionInsert[]) => {
        if (transactions.length === 0) return [];
        
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user.id;
            
            // Busca o owner_id para garantir que usamos o ID do proprietário da conta
            const effectiveUserId = await getEffectiveUserId(currentUserId);

            const sanitizedPayload = transactions
                .map(t => {

                    const amount = Number(t.amount);
                    let finalDate = t.transaction_date;

                    if (finalDate && !/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {

                        const resolved = DateResolver.resolveToISO(
                            finalDate,
                            new Date().getFullYear()
                        );

                        if (resolved) finalDate = resolved;
                    }

                    if (!finalDate || !/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
                        finalDate = new Date().toISOString().split('T')[0];
                    }

                    const payload = {
                        transaction_date: finalDate,
                        amount: isNaN(amount) ? 0 : amount,
                        description: t.description,
                        type: t.type || (amount >= 0 ? 'income' : 'expense'),
                        pix_key: t.pix_key || null,
                        source: t.source || 'file',
                        user_id: effectiveUserId || t.user_id,
                        bank_id: t.bank_id || null,
                        status: t.status || 'pending',
                        row_hash: t.row_hash,
                        is_confirmed: typeof t.is_confirmed === 'boolean' ? t.is_confirmed : false
                    };

                    // Validação preventiva contra consolidated_transactions_type_check
                    const errors: string[] = [];
                    const isUuid = (id: any) => !id || id === null || /^[0-9a-fA-F-]{36}$/.test(id);

                    if (!['income', 'expense'].includes(payload.type as any)) {
                        errors.push(`Type inválido: ${payload.type}`);
                    }
                    if (!['pending', 'identified', 'resolved'].includes(payload.status as any)) {
                        errors.push(`Status inválido: ${payload.status}`);
                    }
                    if (payload.status === 'resolved' && !payload.is_confirmed) {
                        errors.push('Inconsistência: status=resolved exige is_confirmed=true');
                    }
                    if (!isUuid(payload.bank_id)) {
                        errors.push(`bank_id não é um UUID válido: ${payload.bank_id}`);
                    }

                    if (errors.length > 0) {
                        console.error('[TYPE_CHECK:BLOCKED_PAYLOAD] [addTransactions]', { errors, payload });
                        return null; // Filtramos o item inválido
                    }

                    return payload;
                })
                .filter((item): item is NonNullable<typeof item> => item !== null && !!item.user_id);

            if (sanitizedPayload.length === 0) return [];

            // Log de escrita solicitado para depuração
            console.log('[ID:WRITE]', {
              userId: currentUserId,
              effectiveUserId,
              payloadUserId: sanitizedPayload[0].user_id
            });

            // Log do primeiro item para amostragem
            console.log(`[WRITE:FIX] Inserindo transações com effectiveUserId: ${sanitizedPayload[0].user_id}`);

            const response = await fetch('/api/v1/consolidated_transactions/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactions: sanitizedPayload })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ao inserir transações em lote na VPS: ${errorText}`);
            }

            const results = await response.json();
            return results;

        } catch (e: any) {
            console.error("[Consolidation:CRITICAL_FAIL]", e);
            throw e;
        }
    },

    updateTransactionStatus: async (id: string, status: 'pending' | 'identified' | 'resolved', churchId?: string | null, bankId?: string, contributorId?: string | null, isConfirmed?: boolean, type?: string, pix_key?: string, contribution_type?: string, payment_method?: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user.id;

            // Busca o owner_id para garantir que usamos o ID do proprietário da conta na escrita
            const effectiveUserId = await getEffectiveUserId(currentUserId);

            const updateData: any = { 
                status,
                user_id: effectiveUserId, // FORÇAMOS O ID CORRETO NA ESCRITA
                updated_at: new Date().toISOString()
            };
            
            if (churchId !== undefined) updateData.church_id = churchId;
            if (bankId !== undefined) updateData.bank_id = bankId;
            if (contributorId !== undefined) updateData.contributor_id = contributorId;
            if (isConfirmed !== undefined) updateData.is_confirmed = isConfirmed;
            if (type !== undefined) updateData.type = type;
            if (pix_key !== undefined) updateData.pix_key = pix_key;
            if (contribution_type !== undefined) updateData.contribution_type = contribution_type;
            if (payment_method !== undefined) updateData.payment_method = payment_method;

            console.log('[ID:WRITE]', {
              userId: currentUserId,
              effectiveUserId,
              payloadUserId: updateData.user_id
            });

            console.log('[WRITE:START]', {
              userId: effectiveUserId,
              transactionId: id,
              payload: updateData
            });

            const safeUpdateData: any = {
                ...updateData,
                ...(updateData.contributor_id !== undefined && {
                    contributor_id:
                        updateData.contributor_id &&
                        !String(updateData.contributor_id).startsWith('temp-')
                            ? updateData.contributor_id
                            : null
                })
            };

            // Validação preventiva contra consolidated_transactions_type_check
            const errors: string[] = [];
            const isUuid = (id: any) => !id || id === null || /^[0-9a-fA-F-]{36}$/.test(id);

            // 🪵 [DIAGNOSTIC LOGS: BEFORE TYPE_CHECK]
            console.log("[DIAGNOSTIC] EXPLICIT PARAMETERS PASSED TO updateTransactionStatus:");
            console.log("- transactionId:", id);
            console.log("- status:", status);
            console.log("- churchId:", churchId);
            console.log("- bankId:", bankId);
            console.log("- contributorId:", contributorId);
            console.log("- type (financeiro):", type);
            console.log("- pixKey:", pix_key);
            console.log("- contribution_type (religioso):", contribution_type);
            console.log("- payment_method (forma):", payment_method);

            if (safeUpdateData.type !== undefined && !['income', 'expense'].includes(safeUpdateData.type)) {
                errors.push(`Type inválido (deve ser income ou expense): ${safeUpdateData.type}`);
            }
            if (safeUpdateData.status !== undefined && !['pending', 'identified', 'resolved'].includes(safeUpdateData.status)) {
                errors.push(`Status inválido: ${safeUpdateData.status}`);
            }
            // Checa consistência no payload de update
            if (safeUpdateData.status === 'resolved' && safeUpdateData.is_confirmed === false) {
                errors.push('Inconsistência: tentativa de definir status=resolved com is_confirmed=false');
            }
            if (safeUpdateData.is_confirmed === false && safeUpdateData.status === 'resolved') {
                errors.push('Inconsistência: tentativa de desconfirmar mantendo status=resolved');
            }

            // Validação de UUIDs
            if (safeUpdateData.church_id !== undefined && !isUuid(safeUpdateData.church_id)) {
                errors.push(`church_id inválido: ${safeUpdateData.church_id}`);
            }
            if (safeUpdateData.contributor_id !== undefined && !isUuid(safeUpdateData.contributor_id)) {
                errors.push(`contributor_id inválido: ${safeUpdateData.contributor_id}`);
            }
            if (safeUpdateData.bank_id !== undefined && !isUuid(safeUpdateData.bank_id)) {
                errors.push(`bank_id inválido: ${safeUpdateData.bank_id}`);
            }

            // 🪵 [DIAGNOSTIC LOGS: TYPE_CHECK RESULT]
            console.log("[DIAGNOSTIC] safeUpdateData final:", safeUpdateData);
            console.log("[DIAGNOSTIC] TYPE_CHECK Errors Detected:", errors);
            if (errors.length > 0) {
                errors.forEach((err, idx) => {
                    console.error(`[DIAGNOSTIC] ERROR #${idx + 1}: ${err}`);
                    if (err.includes('Type inválido')) {
                        console.error(`- Campo falho: type (contributionType ou tipo de lançamento)`);
                        console.error(`- Motivo: O valor "${safeUpdateData.type}" não é "income" ou "expense"`);
                    } else if (err.includes('status')) {
                        console.error(`- Campo falho: status`);
                        console.error(`- Motivo: O valor "${safeUpdateData.status}" é inválido`);
                    } else if (err.includes('Inconsistência')) {
                        console.error(`- Campo falho: status / is_confirmed`);
                        console.error(`- Motivo: Relação inconsistente entre status e is_confirmed`);
                    } else if (err.includes('church_id')) {
                        console.error(`- Campo falho: church_id`);
                        console.error(`- Motivo: O valor "${safeUpdateData.church_id}" não é um UUID válido`);
                    } else if (err.includes('contributor_id')) {
                        console.error(`- Campo falho: contributor_id`);
                        console.error(`- Motivo: O valor "${safeUpdateData.contributor_id}" não é um UUID válido`);
                    } else if (err.includes('bank_id')) {
                        console.error(`- Campo falho: bank_id`);
                        console.error(`- Motivo: O valor "${safeUpdateData.bank_id}" não é um UUID válido`);
                    }
                });
            } else {
                console.log("[DIAGNOSTIC] TYPE_CHECK passed successfully with 0 errors!");
            }

            if (errors.length > 0) {
                console.error('[TYPE_CHECK:BLOCKED_PAYLOAD] [updateTransactionStatus]', { errors, safeUpdateData });
                return false; // Bloqueia o PATCH
            }

            console.log('[FIX:PERSIST_FIELDS]', {
                type: safeUpdateData.type,
                contribution_type: safeUpdateData.contribution_type,
                payment_method: safeUpdateData.payment_method
            });

            console.log('💾 SALVANDO MATCH (TransactionStatus)', safeUpdateData);

            // Remove contribution_type and payment_method strictly for the database update payload
            const { contribution_type: _unused1, payment_method: _unused2, ...dbUpdatePayload } = safeUpdateData;

            const response = await fetch(`/api/v1/consolidated_transactions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbUpdatePayload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ao atualizar transação na VPS: ${errorText}`);
            }

            return true;

        } catch (error) {
            console.error("[Consolidation] Erro ao atualizar status:", error);
            return false;
        }
    },

    /**
     * CONFIRMAÇÃO FINAL
     */
    updateConfirmationStatus: async (ids: string[], is_confirmed: boolean, churchId?: string | null, bankId?: string, contributorId?: string | null) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user.id;

            // Busca o owner_id para garantir que usamos o ID do proprietário da conta na escrita
            const effectiveUserId = await getEffectiveUserId(currentUserId);

            if (!ids || ids.length === 0) return true;

            const updateData: any = {
                is_confirmed,
                user_id: effectiveUserId, // FORÇAMOS O ID CORRETO NA ESCRITA
                updated_at: new Date().toISOString()
            };

            // AO confirmar: status='resolved'
            if (is_confirmed) {
                updateData.status = 'resolved';
            } else if (contributorId || churchId) {
                // AO desfazer: restaurar status=identified se houver vínculo
                updateData.status = 'identified';
            }

            if (churchId !== undefined) updateData.church_id = churchId;
            if (bankId !== undefined) updateData.bank_id = bankId;
            
            // Limpeza de contributorId para evitar erros de FK com IDs temporários (Padrão de Segurança)
            if (contributorId !== undefined) {
                updateData.contributor_id = (contributorId && !String(contributorId).startsWith('temp-')) 
                    ? contributorId 
                    : null;
            }

            console.log('[ID:WRITE]', {
              userId: currentUserId,
              effectiveUserId,
              payloadUserId: updateData.user_id
            });

            console.log('[WRITE:START]', {
              userId: effectiveUserId,
              transactionId: ids,
              payload: updateData
            });

            console.log('💾 SALVANDO MATCH (ConfirmationStatus)', updateData);

            // Validação preventiva contra consolidated_transactions_type_check
            const errors: string[] = [];
            const isUuid = (id: any) => !id || id === null || /^[0-9a-fA-F-]{36}$/.test(id);

            if (updateData.status !== undefined && !['pending', 'identified', 'resolved'].includes(updateData.status)) {
                errors.push(`Status inválido: ${updateData.status}`);
            }
            if (updateData.status === 'resolved' && updateData.is_confirmed === false) {
                errors.push('Inconsistência: status=resolved exige is_confirmed=true');
            }
            if (updateData.is_confirmed === false && updateData.status === 'resolved') {
                errors.push('Inconsistência: is_confirmed=false não permite status=resolved');
            }

            // Validação de UUIDs
            if (updateData.church_id !== undefined && !isUuid(updateData.church_id)) {
                errors.push(`church_id inválido: ${updateData.church_id}`);
            }
            if (updateData.contributor_id !== undefined && !isUuid(updateData.contributor_id)) {
                errors.push(`contributor_id inválido: ${updateData.contributor_id}`);
            }

            if (errors.length > 0) {
                console.error('[TYPE_CHECK:BLOCKED_PAYLOAD] [updateConfirmationStatus]', { errors, updateData });
                return false; // Bloqueia o PATCH
            }

            // Executa as atualizações em paralelo via VPS PUT
            const updatePromises = ids.map(async (id) => {
                const response = await fetch(`/api/v1/consolidated_transactions/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Erro ao atualizar confirmação para ID ${id}: ${errorText}`);
                }
            });

            await Promise.all(updatePromises);
            return true;

        } catch (error) {
            console.error("[Consolidation] Erro ao atualizar confirmação:", error);
            return false;
        }
    },

    getExistingTransactionsForDedup: async (userId: string) => {
        if (!userId) throw new Error("UserID é obrigatório.");
        
        try {
            return await consolidationService._fetchPaginated((offset, limit) => 
                `/api/v1/consolidated_transactions?user_id=${userId}&limit=${limit}&offset=${offset}`
            );
        } catch (e: any) {
            console.error("[Consolidation:DEDUP_FETCH_FAIL]", e);
            throw e;
        }
    },

    deletePendingTransactions: async (userId: string, bankId?: string) => {
        try {
            if (!userId) return false;

            console.log(`[WRITE:VPS] Excluindo transações pendentes para user_id: ${userId}`);
            
            // 1. Busca todas as transações pendentes do usuário
            const pendingTxs = await consolidationService.getPendingTransactions(userId);
            if (pendingTxs.length === 0) return true;

            // 2. Filtra de acordo com bankId se aplicável
            let toDelete = pendingTxs;
            if (bankId && bankId !== 'all') {
                const isVirtual =
                    bankId === 'gmail-sync' ||
                    bankId === 'virtual' ||
                    bankId === 'gmail-virtual-bank';

                const isUuid = /^[0-9a-fA-F-]{36}$/.test(bankId);

                if (isVirtual || !isUuid) {
                    toDelete = pendingTxs.filter(tx => !tx.bank_id);
                } else {
                    toDelete = pendingTxs.filter(tx => tx.bank_id === bankId);
                }
            }

            if (toDelete.length === 0) return true;

            // 3. Executa a exclusão em lote
            const idsToDelete = toDelete.map(tx => tx.id);
            return await consolidationService.deleteTransactionsByIds(idsToDelete);

        } catch (error) {
            console.error("[Consolidation] Erro ao excluir transações pendentes:", error);
            throw error;
        }
    },

    /**
     * LISTA VIVA (pendentes)
     * Implementa um limite de segurança de 5000 registros para evitar travamento do navegador
     * em contas com volume massivo de transações pendentes.
     */
    getPendingTransactions: async (userId: string) => {
        if (!userId) return [];

        try {
            const maxRecords = 5000;
            const allTransactions = await consolidationService._fetchPaginated((offset, limit) => 
                `/api/v1/consolidated_transactions?user_id=${userId}&status=pending&limit=${limit}&offset=${offset}`,
                1000,
                maxRecords
            );

            // Filtro de segurança para is_confirmed = false (e garantir consistência de tipo)
            const filteredTransactions = allTransactions
                .filter(tx => tx.is_confirmed === false || tx.is_confirmed === 'false')
                .map(tx => ({
                    ...tx,
                    amount: Number(tx.amount), // Garante consistência de tipo float vs numeric-string
                    is_confirmed: false
                }));

            if (filteredTransactions.length >= maxRecords) {
                console.warn(`[Consolidation] Limite de segurança de ${maxRecords} registros atingido para a Lista Viva.`);
            }

            return filteredTransactions;

        } catch (e: any) {
            console.error("[Consolidation:FETCH_FAIL]", e);
            throw e;
        }
    },

    deleteTransactionById: async (id: string) => {
        try {
            console.log(`[WRITE:VPS] Excluindo transação por ID: ${id}`);
            
            const response = await fetch(`/api/v1/consolidated_transactions/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ao excluir transação: ${errorText}`);
            }

            return true;

        } catch (error) {
            console.error("[Consolidation] Erro ao excluir transação:", error);
            throw error;
        }
    },

    deleteTransactionsByIds: async (ids: string[]) => {
        try {
            console.log(`[WRITE:VPS] Excluindo múltiplas transações por IDs:`, ids);

            const response = await fetch('/api/v1/consolidated_transactions/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ao excluir transações em lote: ${errorText}`);
            }

            return true;

        } catch (error) {
            console.error("[Consolidation] Erro ao excluir transações em lote:", error);
            throw error;
        }
    },

    /**
     * VERIFICAÇÃO DE INTEGRIDADE (Anti-Cache Stale)
     * Retorna apenas os IDs que já estão confirmados no banco.
     * Implementa chunking para evitar limites de tamanho de URL.
     */
    checkConfirmedTransactions: async (userId: string, ids: string[]) => {
        if (!userId || !ids || ids.length === 0) return [];
        
        try {
            const chunkSize = 50; // Tamanho seguro para evitar URLs gigantes
            const confirmedIds: string[] = [];
            
            for (let i = 0; i < ids.length; i += chunkSize) {
                const chunk = ids.slice(i, i + chunkSize);
                
                const response = await fetch(`/api/v1/consolidated_transactions?user_id=${userId}&ids=${chunk.join(',')}`);
                if (!response.ok) {
                    console.error("[Consolidation:CHECK_CONFIRMED_CHUNK_FAIL]", {
                        status: response.statusText,
                        chunkSize: chunk.length,
                        userId
                    });
                    continue;
                }
                
                const data = await response.json();
                if (data) {
                    const foundConfirmedIds = (data as any[])
                        .filter(d => d.is_confirmed === true || d.is_confirmed === 'true' || d.is_confirmed === 1)
                        .map(d => d.id);
                    confirmedIds.push(...foundConfirmedIds);
                }
            }
            
            return confirmedIds;
        } catch (e) {
            console.error("[Consolidation:CHECK_CONFIRMED_FAIL]", e);
            return [];
        }
    },

    /**
     * FAXINA GLOBAL DE DUPLICATAS (V1)
     * Remove registros que possuem o mesmo row_hash, mantendo apenas um.
     * Garante que as listas "vivas" e históricas fiquem limpas.
     */
    runGlobalDeduplication: async (userId: string) => {
        if (!userId) return 0;
        
        try {
            let allRecords: any[] = [];

            // 1. Busca exaustiva de todos os registros para comparação
            allRecords = await consolidationService._fetchPaginated((offset, limit) => 
                `/api/v1/consolidated_transactions?user_id=${userId}&limit=${limit}&offset=${offset}`
            );

            // 2. Identifica duplicatas baseadas no row_hash OU no conteúdo exato
            const seenHashes = new Set<string>();
            const seenContent = new Set<string>();
            const duplicateIds: string[] = [];

            allRecords.forEach(rec => {
                // Chave de conteúdo para pegar duplicatas que podem ter hashes diferentes (por versões antigas do app)
                const contentKey = `${rec.transaction_date ? rec.transaction_date.split('T')[0] : ''}|${String(rec.description || '').trim().toUpperCase()}|${Number(rec.amount || 0).toFixed(2)}|${rec.type}|${rec.bank_id || 'null'}|${rec.pix_key || 'null'}`;
                
                let isDuplicate = false;
                
                if (rec.row_hash && seenHashes.has(rec.row_hash)) {
                    isDuplicate = true;
                } else if (seenContent.has(contentKey)) {
                    isDuplicate = true;
                }

                if (isDuplicate) {
                    duplicateIds.push(rec.id);
                } else {
                    if (rec.row_hash) seenHashes.add(rec.row_hash);
                    seenContent.add(contentKey);
                }
            });

            // 3. Remove as duplicatas em lotes
            if (duplicateIds.length > 0) {
                console.log(`[Deduplication] Removendo ${duplicateIds.length} duplicatas encontradas.`);
                const chunkSize = 100;
                for (let i = 0; i < duplicateIds.length; i += chunkSize) {
                    const chunk = duplicateIds.slice(i, i + chunkSize);
                    await consolidationService.deleteTransactionsByIds(chunk);
                }
                return duplicateIds.length;
            }
            return 0;
        } catch (e) {
            console.error("[Consolidation:DEDUPE_CLEANUP_FAIL]", e);
            return 0;
        }
    }
};
