
import { supabase } from './supabaseClient';
import { Database } from '../types/supabase';

// Tipos extraídos diretamente do Schema para garantir consistência
type ConsolidatedTransactionInsert = Database['public']['Tables']['consolidated_transactions']['Insert'];

// Helper para gerar fingerprint determinístico para deduplicação
const generateFingerprint = (t: { 
    transaction_date: string; 
    amount: number; 
    description: string; 
    type: string; 
    pix_key?: string | null; 
    user_id: string;
    bank_id?: string | null;
}): string => {
    const date = t.transaction_date;
    // Garante 2 casas decimais para consistência (100 vs 100.00)
    const amount = Number(t.amount).toFixed(2);
    // Normalização de texto conforme regras: lowercase e trim
    const desc = (t.description || '').toLowerCase().trim();
    const type = t.type;
    const pixKey = t.pix_key || ''; // Trata null como string vazia
    const userId = t.user_id;
    const bankId = t.bank_id || '';

    // Separador | para evitar colisão simples
    return `${userId}|${date}|${amount}|${desc}|${type}|${pixKey}|${bankId}`;
};

// Validador de UUID
const isValidUUID = (uuid: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
};

/**
 * SERVIÇO DE CONSOLIDAÇÃO FINANCEIRA
 * 
 * Responsável por centralizar transações vindas de múltiplas fontes (Arquivos, Gmail).
 * Atualmente atua como uma camada de preparação para armazenamento persistente.
 */
export const consolidationService = {
    /**
     * Adiciona uma única transação à base consolidada.
     */
    addTransaction: async (transaction: ConsolidatedTransactionInsert) => {
        const newFingerprint = generateFingerprint(transaction as any);

        const { data: existingCandidates, error: fetchError } = await supabase
            .from('consolidated_transactions')
            .select('transaction_date, amount, description, type, pix_key, user_id, bank_id')
            .eq('user_id', transaction.user_id)
            .eq('transaction_date', transaction.transaction_date);

        if (fetchError) throw fetchError;

        const isDuplicate = existingCandidates?.some(existing => 
            generateFingerprint(existing as any) === newFingerprint
        );

        if (isDuplicate) return null;

        const { data, error } = await supabase
            .from('consolidated_transactions')
            .insert({ ...transaction, status: 'pending' })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Adiciona múltiplas transações em lote (Batch Insert).
     */
    addTransactions: async (transactions: ConsolidatedTransactionInsert[]) => {
        if (transactions.length === 0) return [];

        const userId = transactions[0].user_id;
        const dates = transactions.map(t => t.transaction_date).sort();
        const minDate = dates[0];
        const maxDate = dates[dates.length - 1];

        const { data: existingCandidates, error: fetchError } = await supabase
            .from('consolidated_transactions')
            .select('transaction_date, amount, description, type, pix_key, user_id, bank_id')
            .eq('user_id', userId)
            .gte('transaction_date', minDate)
            .lte('transaction_date', maxDate)
            .limit(5000);

        if (fetchError) throw fetchError;

        const existingFingerprints = new Set(
            existingCandidates?.map(t => generateFingerprint(t as any)) || []
        );

        const batchFingerprints = new Set<string>();
        const toInsert = transactions.filter(t => {
            const fp = generateFingerprint(t as any);
            if (existingFingerprints.has(fp) || batchFingerprints.has(fp)) return false;
            batchFingerprints.add(fp);
            return true;
        });

        if (toInsert.length === 0) return [];

        const toInsertWithStatus = toInsert.map(t => ({ ...t, status: 'pending' }));

        const { data, error } = await supabase
            .from('consolidated_transactions')
            .insert(toInsertWithStatus as any)
            .select();

        if (error) throw error;
        return data;
    },

    /**
     * Remove transações pendentes do banco (BLINDADO V6 - Lógica Híbrida).
     * Resolve o problema de arquivos que "voltam" ao recarregar a página.
     */
    deletePendingTransactions: async (userId: string, bankId?: string) => {
        try {
            console.log(`[Consolidation] Iniciando exclusão. BankID: ${bankId || 'TODOS (RESET)'}`);

            // CASO 1: RESET TOTAL (Botão "Nova Conciliação" ou "Excluir Tudo")
            // Usa deleção direta simples para garantir limpeza absoluta.
            if (!bankId) {
                const { error, count } = await supabase
                    .from('consolidated_transactions')
                    .delete()
                    .eq('user_id', userId)
                    .eq('status', 'pending');

                if (error) throw error;
                console.log(`[Consolidation] Reset total concluído. Registros limpos: ${count}`);
                return;
            }

            // CASO 2: REMOVER ARQUIVO ESPECÍFICO
            // Verifica se é UUID válido. Se não for (ex: 'temp-123'), apenas retorna sucesso (já que não está no DB).
            if (!isValidUUID(bankId)) {
                console.warn(`[Consolidation] ID Virtual (${bankId}). Ignorando DB.`);
                return;
            }

            // Tenta via RPC primeiro (mais seguro se existir)
            const { error: rpcError } = await supabase.rpc('delete_pending_transactions', { 
                target_bank_id: bankId 
            });

            if (!rpcError) {
                console.log("[Consolidation] Sucesso via RPC.");
                return;
            }

            // FALLBACK ROBUSTO: Se RPC falhar, tenta deleção direta inteligente
            console.warn("[Consolidation] RPC falhou, usando método direto com filtro OR.", rpcError);
            
            // Deleta transações que correspondem ao banco OU que estão órfãs (null)
            // Isso captura arquivos antigos que podem ter perdido a referência do banco
            const { error: deleteError } = await supabase
                .from('consolidated_transactions')
                .delete()
                .eq('user_id', userId)
                .eq('status', 'pending')
                .or(`bank_id.eq.${bankId},bank_id.is.null`);

            if (deleteError) throw deleteError;
            console.log("[Consolidation] Sucesso via Deleção Direta Híbrida.");

        } catch (error) {
            console.error("[Consolidation] Erro fatal na exclusão:", error);
            throw error; // Propaga erro para a UI mostrar Toast
        }
    },

    /**
     * Recupera todas as transações pendentes de um usuário.
     */
    getPendingTransactions: async (userId: string) => {
        const { data, error } = await supabase
            .from('consolidated_transactions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .order('transaction_date', { ascending: false });

        if (error) {
            console.error("Erro ao buscar transações pendentes:", error);
            throw error;
        }
        return data;
    },

    markAsIdentified: async (transactionId: string) => {
        const { error } = await supabase
            .from('consolidated_transactions')
            .update({ status: 'identified' })
            .eq('id', transactionId);
        
        if (error) throw error;
    },

    markAsPending: async (transactionId: string) => {
        const { error } = await supabase
            .from('consolidated_transactions')
            .update({ status: 'pending' })
            .eq('id', transactionId);
        
        if (error) throw error;
    },

    markAsResolved: async (transactionId: string) => {
        const { error } = await supabase
            .from('consolidated_transactions')
            .update({ status: 'resolved' })
            .eq('id', transactionId);
        
        if (error) throw error;
    }
};
