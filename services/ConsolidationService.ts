
import { supabase } from './supabaseClient';
import { Database } from '../types/supabase';
import { DateResolver } from '../core/processors/DateResolver';

type ConsolidatedTransactionInsert = Database['public']['Tables']['consolidated_transactions']['Insert'];

export const consolidationService = {
    /**
     * Adiciona transações em lote com CHUNKING para evitar estouro de buffer e timeout.
     */
    addTransactions: async (transactions: ConsolidatedTransactionInsert[]) => {
        if (transactions.length === 0) return [];
        
        try {
            const sanitizedPayload = transactions
                .map(t => {
                    const amount = Number(t.amount);
                    let finalDate = t.transaction_date;

                    if (finalDate && !/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
                        const resolved = DateResolver.resolveToISO(finalDate, new Date().getFullYear());
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
                    // Se o erro for especificamente a coluna is_confirmed ausente, tentamos sem ela como fallback de emergência
                    if (error.message.includes("is_confirmed") || error.code === 'PGRST204' || error.message.includes("column \"is_confirmed\"")) {
                         console.warn("[Consolidation] Coluna 'is_confirmed' ausente no banco. Executando fallback sem confirmação.");
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
     * Atualiza marcação de confirmação final
     */
    updateConfirmationStatus: async (ids: string[], is_confirmed: boolean) => {
        try {
            if (!ids || ids.length === 0) return true;

            const { error } = await supabase
                .from('consolidated_transactions')
                .update({ is_confirmed })
                .in('id', ids);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("[Consolidation] Erro ao atualizar confirmação:", error);
            return false;
        }
    },

    /**
     * Recupera hashes existentes para deduplicação com PAGINAÇÃO AUTOMÁTICA.
     */
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
                .eq('status', 'pending');

            if (bankId && bankId !== 'all') {
                const isVirtual = bankId === 'gmail-sync' || bankId === 'virtual' || bankId === 'gmail-virtual-bank';
                const isProbablyUuid = /^[0-9a-fA-F-]{36}$/.test(bankId);
                if (isVirtual || !isProbablyUuid) query = query.is('bank_id', null);
                else query = query.eq('bank_id', bankId);
            }
            const { error } = await query;
            if (error) throw error;
            return true;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Recupera transações pendentes (Lista Viva) com PAGINAÇÃO AUTOMÁTICA.
     */
    getPendingTransactions: async (userId: string) => {
        if (!userId) return [];
        
        let allTransactions: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        try {
            while (hasMore) {
                // Tentativa inicial com todos os campos
                const { data, error } = await supabase
                    .from('consolidated_transactions')
                    .select('id, transaction_date, amount, description, type, bank_id, row_hash, pix_key, is_confirmed')
                    .eq('user_id', userId)
                    .eq('status', 'pending')
                    .order('transaction_date', { ascending: false })
                    .range(from, from + step - 1);

                if (error) {
                    // Fallback se a coluna is_confirmed não existir (Erro 400 ou código PostgREST específico)
                    if (error.message.includes("is_confirmed") || error.code === 'PGRST204' || String(error.status) === '400') {
                         console.warn("[Consolidation] Coluna 'is_confirmed' ausente no banco ao buscar. Executando fallback.");
                         const { data: fallbackData, error: fallbackError } = await supabase
                            .from('consolidated_transactions')
                            .select('id, transaction_date, amount, description, type, bank_id, row_hash, pix_key')
                            .eq('user_id', userId)
                            .eq('status', 'pending')
                            .order('transaction_date', { ascending: false })
                            .range(from, from + step - 1);
                         
                         if (fallbackError) throw fallbackError;
                         if (fallbackData && fallbackData.length > 0) {
                             allTransactions = [...allTransactions, ...fallbackData];
                             from += step;
                             if (fallbackData.length < step) hasMore = false;
                         } else {
                             hasMore = false;
                         }
                    } else {
                        throw error;
                    }
                } else if (data && data.length > 0) {
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
    }
};
