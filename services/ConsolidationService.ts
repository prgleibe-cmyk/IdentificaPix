import { supabase } from './supabaseClient';
import { Database } from '../types/supabase';
import { DateResolver } from '../core/processors/DateResolver';

type ConsolidatedTransactionInsert = Database['public']['Tables']['consolidated_transactions']['Insert'];

export const consolidationService = {

    addTransactions: async (transactions: ConsolidatedTransactionInsert[]) => {
        if (transactions.length === 0) return [];
        
        try {

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
                        user_id: t.user_id,
                        owner_id: t.owner_id,
                        created_by: t.created_by || t.user_id,
                        bank_id: t.bank_id || null,
                        status: t.status || 'pending',
                        row_hash: t.row_hash,
                        is_confirmed: typeof t.is_confirmed === 'boolean' ? t.is_confirmed : false
                    };

                })
                .filter((item): item is NonNullable<typeof item> => item !== null && !!item.user_id);

            if (sanitizedPayload.length === 0) return [];

            const CHUNK_SIZE = 100;
            const results: any[] = [];

            for (let i = 0; i < sanitizedPayload.length; i += CHUNK_SIZE) {

                const chunk = sanitizedPayload.slice(i, i + CHUNK_SIZE);

                const { data, error } = await supabase
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

                        const { data: recData, error: recError } = await supabase
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

    updateTransactionStatus: async (id: string, status: 'pending' | 'identified' | 'resolved') => {

        try {

            const { error } = await supabase
                .from('consolidated_transactions')
                .update({ status })
                .eq('id', id);

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
    updateConfirmationStatus: async (ids: string[], is_confirmed: boolean) => {

    try {

        if (!ids || ids.length === 0) return true;

        const { data, error } = await supabase
            .from('consolidated_transactions')
            .update({
                is_confirmed,
                status: is_confirmed ? 'resolved' : 'pending'
            })
            .in('id', ids)
            .select();

        console.log("[ConfirmarFinal] Linhas atualizadas:", data);

        if (error) throw error;

        return true;

    } catch (error) {

        console.error("[Consolidation] Erro ao atualizar confirmação:", error);
        return false;

    }
},

    getExistingTransactionsForDedup: async (ownerId: string) => {

        if (!ownerId) throw new Error("OwnerID é obrigatório.");
        
        let allHashes: { row_hash: string | null }[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        try {

            while (hasMore) {

                const { data, error } = await supabase
                    .from('consolidated_transactions')
                    .select('row_hash')
                    .eq('owner_id', ownerId)
                    .range(from, from + step - 1);

                if (error) throw error;

                if (data && data.length > 0) {

                    allHashes = [...allHashes, ...data];
                    from += step;

                    if (data.length < step) hasMore = false;

                } else {
                    hasMore = false;
                }
            }

            return allHashes;

        } catch (e: any) {

            console.error("[Consolidation:DEDUP_FETCH_FAIL]", e);
            throw e;

        }
    },

    deletePendingTransactions: async (ownerId: string, bankId?: string) => {

        try {

            if (!ownerId) return false;

            let query = supabase
                .from('consolidated_transactions')
                .delete()
                .eq('owner_id', ownerId)
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
     */
    getPendingTransactions: async (ownerId: string) => {

        if (!ownerId) return [];

        let allTransactions: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        try {

            while (hasMore) {

                const { data, error } = await supabase
                    .from('consolidated_transactions')
                    .select('id, transaction_date, amount, description, type, bank_id, row_hash, pix_key, is_confirmed')
                    .eq('owner_id', ownerId)
                    .eq('status', 'pending')
                    .eq('is_confirmed', false)
                    .order('transaction_date', { ascending: false })
                    .range(from, from + step - 1);

                if (error) throw error;

                if (data && data.length > 0) {

                    allTransactions = [...allTransactions, ...data];
                    from += step;

                    if (data.length < step) hasMore = false;

                } else {

                    hasMore = false;

                }
            }

            return allTransactions;

        } catch (e: any) {

            console.error("[Consolidation:FETCH_FAIL]", e);
            throw e;

        }
    },

    deleteTransactionById: async (id: string) => {

        try {

            const { error } = await supabase
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
    checkConfirmedTransactions: async (ownerId: string, ids: string[]) => {
        if (!ownerId || !ids || ids.length === 0) return [];
        
        try {
            const chunkSize = 50; // Tamanho seguro para evitar URLs gigantes
            const confirmedIds: string[] = [];
            
            for (let i = 0; i < ids.length; i += chunkSize) {
                const chunk = ids.slice(i, i + chunkSize);
                
                const { data, error } = await supabase
                    .from('consolidated_transactions')
                    .select('id')
                    .eq('owner_id', ownerId)
                    .eq('is_confirmed', true)
                    .in('id', chunk);

                if (error) {
                    console.error("[Consolidation:CHECK_CONFIRMED_CHUNK_FAIL]", {
                        error,
                        chunkSize: chunk.length,
                        ownerId
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
    runGlobalDeduplication: async (ownerId: string) => {
        if (!ownerId) return 0;
        
        try {
            let allRecords: any[] = [];
            let from = 0;
            const step = 1000;
            let hasMore = true;

            // 1. Busca exaustiva de todos os registros para comparação
            while (hasMore) {
                const { data, error } = await supabase
                    .from('consolidated_transactions')
                    .select('id, row_hash, transaction_date, amount, description, type, bank_id, pix_key')
                    .eq('owner_id', ownerId)
                    .range(from, from + step - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allRecords = [...allRecords, ...data];
                    from += step;
                    if (data.length < step) hasMore = false;
                } else {
                    hasMore = false;
                }
            }

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
                    await supabase
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