import { supabase } from './supabaseClient';
import { Database } from '../types/supabase';
import { DateResolver } from '../core/processors/DateResolver';

type ConsolidatedTransactionInsert = Database['public']['Tables']['consolidated_transactions']['Insert'];

export const consolidationService = {

    /**
     * Helper genérico para busca paginada (Centralização de Lógica)
     */
    _fetchPaginated: async (queryFn: (from: number, to: number) => Promise<{data: any[] | null, error: any}>, step: number = 1000, maxRecords?: number) => {
        let allData: any[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore && (!maxRecords || allData.length < maxRecords)) {
            const { data, error } = await queryFn(from, from + step - 1);
            if (error) throw error;
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += step;
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
            let effectiveUserId = currentUserId;
            if (currentUserId) {
                const { data: profile } = await (supabase as any)
                    .from('profiles')
                    .select('owner_id')
                    .eq('id', currentUserId)
                    .maybeSingle();
                if (profile?.owner_id) effectiveUserId = profile.owner_id;
            }

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

                    return {
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

            const CHUNK_SIZE = 100;
            const results: any[] = [];

            for (let i = 0; i < sanitizedPayload.length; i += CHUNK_SIZE) {

                const chunk = sanitizedPayload.slice(i, i + CHUNK_SIZE);

                const { data, error } = await (supabase as any)
                    .from('consolidated_transactions')
                    .insert(chunk)
                    .select('*');

                if (error) {

                    console.error("[Consolidation:INSERT_ERROR]", error);

                    if (
                        error.message.includes("is_confirmed") ||
                        error.code === 'PGRST204' ||
                        error.message.includes("column \"is_confirmed\"")
                    ) {

                        console.warn("[Consolidation] Fallback sem is_confirmed");

                        const recoveryChunk = chunk.map(({ is_confirmed, ...rest }: any) => rest);

                        const { data: recData, error: recError } = await (supabase as any)
                            .from('consolidated_transactions')
                            .insert(recoveryChunk)
                            .select('*');

                        if (recError) throw new Error(recError.message);
                        if (recData) results.push(...recData);

                    } else {
                        throw new Error(error.message);
                    }

                } else if (data) {

                    results.push(...data);

                }
            }

            return results;

        } catch (e: any) {

            console.error("[Consolidation:CRITICAL_FAIL]", e);
            throw e;

        }
    },

    updateTransactionStatus: async (id: string, status: 'pending' | 'identified' | 'resolved', churchId?: string | null, bankId?: string, contributorId?: string | null, isConfirmed?: boolean, type?: string, pix_key?: string, isManual: boolean = false) => {
        try {
            // 🛡️ GUARDA CIRÚRGICA DE ANTI-REGRESSÃO (Persistence Layer)
            // Impede que processos automáticos revertam estados confirmados ou resolvidos
            if (!isManual && (status === 'pending' || isConfirmed === false)) {
                const { data: current } = await (supabase as any)
                    .from('consolidated_transactions')
                    .select('status, is_confirmed')
                    .eq('id', id)
                    .maybeSingle();

                if (current && (current.status === 'resolved' || current.is_confirmed === true)) {
                    console.warn('⚠️ [Consolidation:BLOCKED_REGRESSION] Abortando escrita automática regressiva (TransactionStatus).', {
                        id,
                        status,
                        isConfirmed,
                        currentStatus: current.status,
                        currentConfirmed: current.is_confirmed
                    });
                    return true; // Aborta a escrita e simula sucesso
                }
            }

            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user.id;

            // Busca o owner_id para garantir que usamos o ID do proprietário da conta na escrita
            let effectiveUserId = currentUserId;
            if (currentUserId) {
                const { data: profile } = await (supabase as any)
                    .from('profiles')
                    .select('owner_id')
                    .eq('id', currentUserId)
                    .maybeSingle();
                if (profile?.owner_id) effectiveUserId = profile.owner_id;
            }

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

           const safeUpdateData = {
    ...updateData,
    ...(updateData.contributor_id !== undefined && {
        contributor_id:
            updateData.contributor_id &&
            !String(updateData.contributor_id).startsWith('temp-')
                ? updateData.contributor_id
                : null
    })
};

console.log('💾 SALVANDO MATCH (TransactionStatus)', safeUpdateData);

const { data, error } = await (supabase as any)
    .from('consolidated_transactions')
    .update(safeUpdateData)
    .eq('id', id)
    .select();

            console.log('[WRITE:RESULT]', {
              data,
              error
            });

            if (error) throw error;

            return true;

        } catch (error) {

            console.error("[Consolidation] Erro ao atualizar status:", error);
            return false;

        }
    },

    /**
     * CONFIRMAÇÃO FINAL
     */
    updateConfirmationStatus: async (ids: string[], is_confirmed: boolean, churchId?: string | null, bankId?: string, contributorId?: string | null, isManual: boolean = false) => {

    try {
        if (!ids || ids.length === 0) return true;

        // 🛡️ GUARDA CIRÚRGICA DE ANTI-REGRESSÃO (Persistence Layer)
        // Bloqueia se: NÃO é manual E (novo payload tenta is_confirmed=false OU status=pending)
        // E o estado atual no banco já é confirmado ou resolvido.
        if (!isManual && is_confirmed === false) {
            const { data: currentItems } = await (supabase as any)
                .from('consolidated_transactions')
                .select('id, status, is_confirmed')
                .in('id', ids);

            const hasConfirmedOrResolved = currentItems?.some(item => item.is_confirmed === true || item.status === 'resolved');

            if (hasConfirmedOrResolved) {
                console.warn('⚠️ [Consolidation:BLOCKED_REGRESSION] Abortando escrita automática regressiva (ConfirmationStatus).', {
                    ids,
                    is_confirmed,
                    regressiveCount: currentItems?.filter(item => item.is_confirmed || item.status === 'resolved').length
                });
                return true; // Aborta a escrita e simula sucesso
            }
        }

        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user.id;

        // Busca o owner_id para garantir que usamos o ID do proprietário da conta na escrita
        let effectiveUserId = currentUserId;
        if (currentUserId) {
            const { data: profile } = await (supabase as any)
                .from('profiles')
                .select('owner_id')
                .eq('id', currentUserId)
                .maybeSingle();
            if (profile?.owner_id) effectiveUserId = profile.owner_id;
        }

        const updateData: any = {
            is_confirmed,
            status: is_confirmed ? 'resolved' : 'pending',
            user_id: effectiveUserId, // FORÇAMOS O ID CORRETO NA ESCRITA
            updated_at: new Date().toISOString()
        };

        if (churchId !== undefined) updateData.church_id = churchId;
        if (bankId !== undefined) updateData.bank_id = bankId;
        if (contributorId !== undefined) updateData.contributor_id = contributorId;

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
        const { data, error } = await (supabase as any)
            .from('consolidated_transactions')
            .update(updateData)
            .in('id', ids)
            .select();

        console.log('[WRITE:RESULT]', {
          data,
          error
        });

        if (error) throw error;

        return true;

    } catch (error) {

        console.error("[Consolidation] Erro ao atualizar confirmação:", error);
        return false;

    }
},

    getExistingTransactionsForDedup: async (userId: string) => {

        if (!userId) throw new Error("UserID é obrigatório.");
        
        try {
            return await consolidationService._fetchPaginated((from, to) => 
                (supabase as any).from('consolidated_transactions').select('row_hash').eq('user_id', userId).range(from, to)
            );
        } catch (e: any) {
            console.error("[Consolidation:DEDUP_FETCH_FAIL]", e);
            throw e;
        }
    },

    deletePendingTransactions: async (userId: string, bankId?: string) => {

        try {

            if (!userId) return false;

            console.log(`[WRITE:ALREADY_CORRECT] Excluindo transações pendentes para user_id: ${userId}`);
            let query = (supabase as any)
                .from('consolidated_transactions')
                .delete()
                .eq('user_id', userId)
                .eq('status', 'pending')
                .eq('is_confirmed', false);

            if (bankId && bankId !== 'all') {

                const isVirtual =
                    bankId === 'gmail-sync' ||
                    bankId === 'virtual' ||
                    bankId === 'gmail-virtual-bank';

                const isUuid = /^[0-9a-fA-F-]{36}$/.test(bankId);

                if (isVirtual || !isUuid)
                    query = query.is('bank_id', null);
                else
                    query = query.eq('bank_id', bankId);
            }

            const { error } = await query;

            if (error) throw error;

            return true;

        } catch (error) {

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
            const allTransactions = await consolidationService._fetchPaginated((from, to) => 
                (supabase as any).from('consolidated_transactions')
                    .select('id, transaction_date, amount, description, type, bank_id, row_hash, pix_key, is_confirmed')
                    .eq('user_id', userId)
                    .eq('status', 'pending')
                    .eq('is_confirmed', false)
                    .order('transaction_date', { ascending: false })
                    .range(from, to),
                1000,
                maxRecords
            );

            if (allTransactions.length >= maxRecords) {
                console.warn(`[Consolidation] Limite de segurança de ${maxRecords} registros atingido para a Lista Viva.`);
            }

            return allTransactions;

        } catch (e: any) {
            console.error("[Consolidation:FETCH_FAIL]", e);
            throw e;
        }
    },

    deleteTransactionById: async (id: string) => {

        try {

            console.log(`[WRITE:ALREADY_CORRECT] Excluindo transação por ID: ${id}`);
            const { error } = await (supabase as any)
                .from('consolidated_transactions')
                .delete()
                .eq('id', id);

            if (error) throw error;

            return true;

        } catch (error) {

            throw error;

        }
    },

    /**
     * VERIFICAÇÃO DE INTEGRIDADE (Anti-Cache Stale)
     * Retorna apenas os IDs que já estão confirmados no banco.
     * Implementa chunking para evitar limites de tamanho de URL no Supabase/PostgREST.
     */
    checkConfirmedTransactions: async (userId: string, ids: string[]) => {
        if (!userId || !ids || ids.length === 0) return [];
        
        try {
            const chunkSize = 50; // Tamanho seguro para evitar URLs gigantes
            const confirmedIds: string[] = [];
            
            for (let i = 0; i < ids.length; i += chunkSize) {
                const chunk = ids.slice(i, i + chunkSize);
                
                const { data, error } = await (supabase as any)
                    .from('consolidated_transactions')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('is_confirmed', true)
                    .in('id', chunk);

                if (error) {
                    console.error("[Consolidation:CHECK_CONFIRMED_CHUNK_FAIL]", {
                        error,
                        chunkSize: chunk.length,
                        userId
                    });
                    continue;
                }
                
                if (data) {
                    const foundIds = (data as any[]).map(d => d.id);
                    confirmedIds.push(...foundIds);
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
            allRecords = await consolidationService._fetchPaginated((from, to) => 
                (supabase as any).from('consolidated_transactions')
                    .select('id, row_hash, transaction_date, amount, description, type, bank_id, pix_key')
                    .eq('user_id', userId)
                    .range(from, to)
            );

            // 2. Identifica duplicatas baseadas no row_hash OU no conteúdo exato
            const seenHashes = new Set<string>();
            const seenContent = new Set<string>();
            const duplicateIds: string[] = [];

            allRecords.forEach(rec => {
                // Chave de conteúdo para pegar duplicatas que podem ter hashes diferentes (por versões antigas do app)
                const contentKey = `${rec.transaction_date}|${String(rec.description || '').trim().toUpperCase()}|${Number(rec.amount || 0).toFixed(2)}|${rec.type}|${rec.bank_id || 'null'}|${rec.pix_key || 'null'}`;
                
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
                    await (supabase as any)
                        .from('consolidated_transactions')
                        .delete()
                        .in('id', chunk);
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