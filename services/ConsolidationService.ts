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
                        row_hash: t.row_hash
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null && !!item.user_id);

            if (sanitizedPayload.length === 0) return [];

            const CHUNK_SIZE = 100; // Reduzido para maior estabilidade em lotes grandes
            const results = [];

            for (let i = 0; i < sanitizedPayload.length; i += CHUNK_SIZE) {
                const chunk = sanitizedPayload.slice(i, i + CHUNK_SIZE);
                
                const { data, error } = await supabase
                    .from('consolidated_transactions')
                    .insert(chunk)
                    .select('*'); 

                if (error) {
                    console.error("[Consolidation:INSERT_ERROR]", error);
                    throw new Error(error.message);
                }
                if (data) results.push(...data);
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
     * Recupera hashes existentes para deduplicação com PAGINAÇÃO AUTOMÁTICA.
     * Varre todo o histórico do banco sem limites fixos.
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
     * Remove o teto fixo e garante a recuperação integral dos dados do usuário.
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
                    .select('id, transaction_date, amount, description, type, bank_id, row_hash, pix_key')
                    .eq('user_id', userId)
                    .eq('status', 'pending')
                    .order('transaction_date', { ascending: false })
                    .range(from, from + step - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    allTransactions = [...allTransactions, ...data];
                    from += step;
                    // Se o bloco veio incompleto, atingimos o fim da tabela
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