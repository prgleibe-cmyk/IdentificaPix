
import { supabase } from './supabaseClient';
import { Database } from '../types/supabase';

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
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
                        finalDate = new Date().toISOString().split('T')[0];
                    }

                    return {
                        transaction_date: finalDate,
                        amount: isNaN(amount) ? 0 : amount,
                        description: String(t.description || 'Sem descrição').trim().substring(0, 500),
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

            // ESTRATÉGIA DE BATCHING (Lotes de 200 para máxima estabilidade)
            const CHUNK_SIZE = 200;
            const results = [];

            for (let i = 0; i < sanitizedPayload.length; i += CHUNK_SIZE) {
                const chunk = sanitizedPayload.slice(i, i + CHUNK_SIZE);
                console.log(`[Consolidation] Persistindo lote ${Math.floor(i/CHUNK_SIZE) + 1} (${chunk.length} itens)`);
                
                const { data, error } = await supabase
                    .from('consolidated_transactions')
                    .insert(chunk)
                    .select('*'); // Blindagem: Select único e explícito para evitar columns=

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

    getExistingTransactionsForDedup: async (userId: string, bankId?: string) => {
        try {
            if (!userId) throw new Error("UserID é obrigatório.");

            // Blindagem: Select único no início da query builder
            let query = supabase
                .from('consolidated_transactions')
                .select('row_hash')
                .eq('user_id', userId)
                .eq('status', 'pending');

            if (bankId) {
                const isVirtual = bankId === 'gmail-sync' || bankId === 'virtual' || bankId === 'gmail-virtual-bank';
                const isProbablyUuid = /^[0-9a-fA-F-]{36}$/.test(bankId);
                if (isVirtual || !isProbablyUuid) {
                    query = query.is('bank_id', null);
                } else {
                    query = query.eq('bank_id', bankId);
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (e: any) {
            throw e;
        }
    },

    deletePendingTransactions: async (userId: string, bankId?: string) => {
        try {
            if (!userId) return false;

            // Operação de delete com filtros encadeados
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

    getPendingTransactions: async (userId: string) => {
        try {
            if (!userId) return [];
            
            // Blindagem: Select explícito com lista de campos, seguido de filtros
            const { data, error } = await supabase
                .from('consolidated_transactions')
                .select('id, transaction_date, amount, description, type, bank_id, row_hash')
                .eq('user_id', userId)
                .eq('status', 'pending')
                .order('transaction_date', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (e: any) {
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
