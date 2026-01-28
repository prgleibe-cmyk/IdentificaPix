
import { consolidationService } from './ConsolidationService';
import { Transaction } from '../types';
import { Logger } from './monitoringService';

export const LaunchService = {
    /**
     * Gera Row Hash baseado no conteúdo integral da linha.
     * V15: ESTABILIDADE DE HASH. Garante que o hash seja gerado sobre o dado
     * extraído pela IA sem mutações, prevenindo duplicidades ou perdas.
     */
    computeRowHash: (t: any, userId: string) => {
        const date = String(t.date || t.transaction_date || '').trim();
        const desc = String(t.description || '').trim().toUpperCase();
        const bankId = String(t.bank_id || 'virtual').trim();
        const user = String(userId).trim();
        
        const rawAmount = Number(t.amount || 0);
        const amountVal = Math.abs(rawAmount * 100).toFixed(0);
        const sign = rawAmount < 0 ? 'D' : 'C'; 
        
        // Composição de entropia fiel ao dado extraído
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
        const currentBankId = (bankId === 'gmail-sync' || bankId === 'virtual' || bankId === 'gmail-virtual-bank') ? null : bankId;

        try {
            // 1. Busca hashes existentes para evitar duplicados reais
            const existingData = await consolidationService.getExistingTransactionsForDedup(userId, bankId);
            const existingHashes = new Set(existingData.map(t => t.row_hash).filter(Boolean));

            // 2. Mapeia para o formato do banco RESPEITANDO A BLINDAGEM DO MODELO
            const toPersist = transactions
                .map(item => {
                    const rowHash = this.computeRowHash({ ...item, bank_id: currentBankId }, userId);
                    if (existingHashes.has(rowHash)) return null;

                    return {
                        transaction_date: item.date,
                        amount: item.amount,
                        description: item.description, // FONTE ÚNICA: Usa a descrição extraída sem re-limpeza
                        type: (item.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
                        pix_key: item.paymentMethod || null, // TRANSPORTA O CAMPO "FORMA" PARA O BANCO
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

            // 3. Salva no banco sem transformações adicionais para manter paridade com a Lista Viva
            await consolidationService.addTransactions(toPersist as any);
            
            return { added: novosCount, skipped: totalReceived - novosCount, total: totalReceived };

        } catch (e: any) {
            Logger.error(`[Launch:ERROR] Falha na persistência cega (modelo blindado)`, e);
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
