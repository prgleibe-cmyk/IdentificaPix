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

    getExistingTransactionsForDedup: async (userId: string) => {

        if (!userId) throw new Error("UserID é obrigatório.");
        
        let allHashes: { row_hash: string | null }[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        try {

            while (hasMore) {

                const { data, error } = await supabase
                    .from('consolidated_transactions')
                    .select('row_hash')
                    .eq('user_id', userId)
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

    deletePendingTransactions: async (userId: string, bankId?: string) => {

        try {

            if (!userId) return false;

            let query = supabase
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
     */
    getPendingTransactions: async (userId: string) => {

        if (!userId) return [];

        let allTransactions: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        try {

            while (hasMore) {

                const { data, error } = await supabase
                    .from('consolidated_transactions')
                    .select('id, transaction_date, amount, description, type, bank_id, row_hash, pix_key, is_confirmed')
                    .eq('user_id', userId)
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
     */
    checkConfirmedTransactions: async (userId: string, ids: string[]) => {
        if (!userId || !ids || ids.length === 0) return [];
        
        try {
            const { data, error } = await supabase
                .from('consolidated_transactions')
                .select('id')
                .eq('user_id', userId)
                .eq('is_confirmed', true)
                .in('id', ids);

            if (error) throw error;
            return data ? (data as any[]).map(d => d.id) : [];
        } catch (e) {
            console.error("[Consolidation:CHECK_CONFIRMED_FAIL]", e);
            return [];
        }
    }
};