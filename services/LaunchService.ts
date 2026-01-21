
import { consolidationService } from './ConsolidationService';
import { Transaction } from '../types';
import { Logger } from './monitoringService';

export const LaunchService = {
    /**
     * Gera Row Hash baseado no conteúdo integral da linha.
     * Agora normaliza agressivamente espaços e caracteres especiais para evitar duplicatas por formatação.
     */
    computeRowHash: (t: any) => {
        const normalize = (v: any) => String(v || '')
            .trim()
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9]/g, ''); // Mantém APENAS letras e números
            
        const date = normalize(t.date || t.transaction_date);
        const desc = normalize(t.description);
        // Valor normalizado para 2 casas decimais sem separadores
        const amount = Math.abs(Number(t.amount || 0) * 100).toFixed(0);
        
        const raw = `${date}|${desc}|${amount}`;
        
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
        if (!userId || transactions.length === 0) {
            return { added: 0, skipped: 0, total: transactions.length };
        }

        const totalReceived = transactions.length;

        // 1. Buscar o que já está no banco
        const existingData = await consolidationService.getExistingTransactionsForDedup(userId);
        
        // 2. Criar Set de hashes existentes
        const existingHashes = new Set(existingData.map(t => this.computeRowHash(t)));

        // 3. Filtrar apenas os novos baseado no hash normalizado
        const uniqueNewItems = transactions.filter(t => {
            const hash = this.computeRowHash(t);
            return !existingHashes.has(hash);
        });

        const novosCount = uniqueNewItems.length;
        const ignoradosCount = totalReceived - novosCount;

        if (novosCount === 0) {
            return { added: 0, skipped: ignoradosCount, total: totalReceived };
        }

        const toPersist = uniqueNewItems.map(item => ({
            transaction_date: item.date,
            amount: item.amount,
            description: item.description,
            type: (item.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
            source: source,
            user_id: userId,
            bank_id: bankId === 'gmail-sync' ? null : bankId
        }));

        const data = await consolidationService.addTransactions(toPersist as any);
        const finalAdded = data?.length || 0;

        return { 
            added: finalAdded, 
            skipped: totalReceived - finalAdded, 
            total: totalReceived 
        };
    },

    async clearBankLaunch(userId: string, bankId: string): Promise<void> {
        await consolidationService.deletePendingTransactions(userId, bankId);
    }
};
