
import { consolidationService } from './ConsolidationService';
import { Transaction } from '../types';
import { Logger } from './monitoringService';

export const LaunchService = {
    /**
     * Gera Row Hash baseado no conteúdo INTEGRAL e BRUTO da extração.
     * V17: Normalização rigorosa de descrição para evitar duplicidade por espaços ou case.
     */
    computeRowHash: (t: any, userId: string) => {
        const date = String(t.date || t.transaction_date || '').trim();
        // Normalização agressiva para o HASH: remove espaços extras e uniformiza o case
        const desc = String(t.description || '').trim().toUpperCase().replace(/\s+/g, ' ');
        const bankId = String(t.bank_id || 'virtual').trim();
        const user = String(userId).trim();
        
        const rawAmount = Number(t.amount || 0);
        const amountVal = Math.abs(rawAmount * 100).toFixed(0);
        const sign = rawAmount < 0 ? 'D' : 'C'; 
        
        // O Hash foca na tríade: DATA | NOME | VALOR + Usuário + Banco
        const raw = `${date}|${desc}|${amountVal}${sign}|${user}|${bankId}`;
        
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            const char = raw.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; 
        }
        return `h${Math.abs(hash).toString(36)}`;
    },

    async launchToBank(
        userId: string, 
        bankId: string, 
        transactions: Transaction[],
        source: 'file' | 'gmail' = 'file'
    ): Promise<{ added: number, skipped: number, total: number }> {
        if (!userId || !transactions || transactions.length === 0) {
            return { added: 0, skipped: 0, total: transactions ? transactions.length : 0 };
        }

        const totalReceived = transactions.length;
        
        // Normalização do ID do banco para consistência com o banco de dados
        const isVirtual = bankId === 'gmail-sync' || bankId === 'virtual' || bankId === 'gmail-virtual-bank' || !/^[0-9a-fA-F-]{36}$/.test(bankId);
        const currentBankId = isVirtual ? null : bankId;

        try {
            // Busca hashes existentes (puxa de todos os status: pendente/identificado/resolvido)
            const existingData = await consolidationService.getExistingTransactionsForDedup(userId, bankId);
            const existingHashes = new Set(existingData.map(t => t.row_hash).filter(Boolean));
            
            // DEDUP INTRA-LOTE: Evita duplicados dentro do próprio arquivo que está sendo processado
            const seenInBatch = new Set<string>();

            const toPersist = transactions
                .map(item => {
                    const rowHash = this.computeRowHash({ ...item, bank_id: currentBankId }, userId);
                    
                    // Se o hash já existe no banco ou já foi visto neste lote, ignora
                    if (existingHashes.has(rowHash) || seenInBatch.has(rowHash)) return null;
                    
                    seenInBatch.add(rowHash);

                    return {
                        transaction_date: item.date,
                        amount: item.amount,
                        description: item.description, // PRESERVAÇÃO TOTAL NO BANCO
                        type: (item.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
                        pix_key: item.paymentMethod || 'OUTROS', 
                        source: source,
                        user_id: userId,
                        bank_id: currentBankId,
                        row_hash: rowHash,
                        status: 'pending' as const
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

            const novosCount = toPersist.length;

            if (novosCount === 0) {
                return { added: 0, skipped: totalReceived, total: totalReceived };
            }

            await consolidationService.addTransactions(toPersist as any);
            return { added: novosCount, skipped: totalReceived - novosCount, total: totalReceived };

        } catch (e: any) {
            Logger.error(`[Launch:ERROR] Falha na persistência cega`, e);
            throw e;
        }
    },

    async clearBankLaunch(userId: string, bankId: string): Promise<boolean> {
        try {
            return await consolidationService.deletePendingTransactions(userId, bankId);
        } catch (error) {
            throw error;
        }
    }
};
