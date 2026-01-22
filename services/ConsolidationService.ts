
import { supabase } from './supabaseClient';
import { Database } from '../types/supabase';

type ConsolidatedTransactionInsert = Database['public']['Tables']['consolidated_transactions']['Insert'];

export const consolidationService = {
    addTransactions: async (transactions: ConsolidatedTransactionInsert[]) => {
        if (transactions.length === 0) return [];
        
        try {
            const { data, error } = await supabase
                .from('consolidated_transactions')
                .insert(transactions.map(t => ({
                    transaction_date: t.transaction_date,
                    amount: t.amount,
                    description: t.description,
                    type: t.type,
                    pix_key: t.pix_key,
                    source: t.source,
                    user_id: t.user_id,
                    bank_id: t.bank_id,
                    status: 'pending' as const
                })))
                .select();

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error("[Consolidation:BATCH_INSERT_FAIL]", e);
            return [];
        }
    },

    getExistingTransactionsForDedup: async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('consolidated_transactions')
                .select('transaction_date, amount, description, type, bank_id')
                .eq('user_id', userId)
                .eq('status', 'pending'); // Só comparamos com o que ainda não foi conciliado

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error("[Consolidation:FETCH_EXISTING_FAIL]", e);
            return [];
        }
    },

    deletePendingTransactions: async (userId: string, bankId?: string) => {
        try {
            let query = supabase
                .from('consolidated_transactions')
                .delete()
                .eq('user_id', userId)
                .eq('status', 'pending');
            
            // Se for bank-id específico, limpa só ele. Se não, limpa tudo do usuário.
            if (bankId && bankId !== 'all') {
                query = query.eq('bank_id', bankId === 'gmail-sync' ? null : bankId);
            }

            const { error } = await query;
            if (error) throw error;
            
            console.log(`[Consolidation] Limpeza remota concluída para: ${bankId || 'todos'}`);
            return true;
        } catch (error) {
            console.error("[Consolidation] Erro crítico na exclusão:", error);
            throw error;
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
            console.error("[Consolidation] Erro ao deletar transação única:", error);
            throw error;
        }
    },

    getPendingTransactions: async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('consolidated_transactions')
                .select('id, transaction_date, amount, description, type, bank_id')
                .eq('user_id', userId)
                .eq('status', 'pending')
                .order('transaction_date', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error("[Consolidation:FETCH_FAIL]", e);
            return [];
        }
    }
};
