
import { consolidationService } from './ConsolidationService';
import { Transaction } from '../types';
import { Logger } from './monitoringService';

export const LaunchService = {
    /**
     * Gera Row Hash baseado estritamente no conteúdo da linha.
     * Regra: date + description + amount (normalizados).
     * Ignora bankId e fileName para evitar duplicação cruzada.
     */
    computeRowHash: (t: any, userId: string) => {
        // 1. Normalização da Data (garante string limpa)
        const date = String(t.date || t.transaction_date || '').trim();
        
        // 2. Normalização da Descrição (trim, lowercase, remove espaços duplicados)
        const desc = String(t.description || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
        
        // 3. Normalização do Valor (precisão de 2 casas decimais para evitar divergência de arredondamento)
        const rawAmount = Number(t.amount || 0);
        const amountVal = rawAmount.toFixed(2);
        
        // Chave única de conteúdo: USER | DATA | DESC | VALOR
        const raw = `${userId}|${date}|${desc}|${amountVal}`;
        
        // Algoritmo de Hash determinístico
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
        
        // Identificação do banco (preservando lógica de virtual/uuid)
        const isVirtual = bankId === 'gmail-sync' || bankId === 'virtual' || bankId === 'gmail-virtual-bank' || !/^[0-9a-fA-F-]{36}$/.test(bankId);
        const currentBankId = isVirtual ? null : bankId;

        try {
            /**
             * AJUSTE DE BLINDAGEM:
             * Buscamos os hashes de TODA a conta do usuário (sem filtrar por bankId).
             * Isso impede que a mesma transação seja carregada em bancos diferentes ou arquivos renomeados.
             */
            const existingData = await consolidationService.getExistingTransactionsForDedup(userId);
            const existingHashes = new Set(existingData.map(t => t.row_hash).filter(Boolean));
            
            // Controle interno para o lote atual (evita duplicados dentro do próprio arquivo carregado)
            const seenInBatch = new Set<string>();

            const toPersist = transactions
                .map(item => {
                    const rowHash = this.computeRowHash(item, userId);
                    
                    // Verificação de existência (Histórico Global ou Lote Atual)
                    if (existingHashes.has(rowHash) || seenInBatch.has(rowHash)) {
                        return null; // Linha já existe, será filtrada
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

            if (novosCount === 0) {
                return { added: 0, skipped: totalReceived, total: totalReceived };
            }

            // Persistência das linhas inéditas
            await consolidationService.addTransactions(toPersist as any);
            return { added: novosCount, skipped: totalReceived - novosCount, total: totalReceived };

        } catch (e: any) {
            Logger.error(`[Launch:DEDUPLICATION_ERROR] Falha ao processar conteúdo da linha`, e);
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
