
import { consolidationService } from './ConsolidationService';
import { Transaction } from '../types';
import { Logger } from './monitoringService';

export const LaunchService = {
    /**
     * Gera Row Hash baseado estritamente no conteúdo da linha.
     * Regra: date + description + amount (normalizados).
     */
    computeRowHash: (t: any, userId: string) => {
        const date = String(t.date || t.transaction_date || '').trim();
        const desc = String(t.description || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
        const rawAmount = Number(t.amount || 0);
        const amountVal = rawAmount.toFixed(2);
        
        const raw = `${userId}|${date}|${desc}|${amountVal}`;
        
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
        
        // Identificação do banco: UUID real ou NULL para virtuais
        const isUuid = /^[0-9a-fA-F-]{36}$/.test(bankId);
        const currentBankId = isUuid ? bankId : null;

        try {
            const existingData = await consolidationService.getExistingTransactionsForDedup(userId);
            const existingHashes = new Set(existingData.map(t => t.row_hash).filter(Boolean));
            
            const seenInBatch = new Set<string>();

            const toPersist = transactions
                .map(item => {
                    const rowHash = this.computeRowHash(item, userId);
                    
                    if (existingHashes.has(rowHash) || seenInBatch.has(rowHash)) {
                        return null; 
                    }
                    
                    seenInBatch.add(rowHash);

                    return {
                        transaction_date: item.date,
                        amount: item.amount,
                        description: item.description, 
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

            if (novosCount > 0) {
                await consolidationService.addTransactions(toPersist as any);
            }
            
            return { added: novosCount, skipped: totalReceived - novosCount, total: totalReceived };

        } catch (e: any) {
            Logger.error(`[Launch:PERSISTENCE_ERROR]`, e);
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
