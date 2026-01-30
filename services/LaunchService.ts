import { consolidationService } from './ConsolidationService';
import { Transaction } from '../types';
import { Logger } from './monitoringService';
import { DateResolver } from '../core/processors/DateResolver';
import { NameResolver } from '../core/processors/NameResolver';

export const LaunchService = {
    /**
     * Gera o DNA base da transação focado no conteúdo.
     * V8: Normalização absoluta de data e descrição para máxima entropia.
     */
    computeBaseHash: (t: any, userId: string, bankId: string) => {
        let rawDate = String(t.date || t.transaction_date || '').trim();
        let isoDate = rawDate;
        if (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            const resolved = DateResolver.resolveToISO(rawDate, new Date().getFullYear());
            if (resolved) isoDate = resolved;
        }
        const finalDate = isoDate || rawDate || 'SEM_DATA';

        // Usa a descrição bruta para preservar distinções específicas do banco
        const descSource = (t.rawDescription || t.description || 'SEM_DESC').trim().toUpperCase();
        const amountVal = Number(t.amount || 0).toFixed(2);
        const methodVal = String(t.paymentMethod || t.pix_key || 'OUTROS').trim().toUpperCase();

        const raw = `U${userId}|B${bankId}|D${finalDate}|V${amountVal}|M${methodVal}|T${descSource}`;
        
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            const char = raw.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; 
        }
        return `b${Math.abs(hash).toString(36)}`;
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
        const isUuid = /^[0-9a-fA-F-]{36}$/.test(bankId);
        const currentBankId = isUuid ? bankId : null;
        const hashBankId = bankId;

        try {
            // 1. Busca hashes existentes para deduplicação real
            const existingData = await consolidationService.getExistingTransactionsForDedup(userId);
            const existingHashes = new Set(existingData.map(t => t.row_hash).filter(Boolean));
            
            // 2. CONTAGEM DE OCURENCIAS NO BANCO (CRUCIAL):
            // Analisamos o banco de dados para saber qual o próximo índice disponível para cada hash base.
            // Isso evita que novos registros sejam descartados por usarem índices (0, 1, 2) já ocupados.
            const dbOccurrenceMax = new Map<string, number>();
            // Fix: Cast 'h' to any to allow split() since existingHashes might contain unknown types from external data
            existingHashes.forEach((h: any) => {
                const parts = h.split('_');
                if (parts.length === 2) {
                    const base = parts[0];
                    const count = parseInt(parts[1]);
                    if (!isNaN(count)) {
                        const currentMax = dbOccurrenceMax.get(base) ?? -1;
                        if (count > currentMax) dbOccurrenceMax.set(base, count);
                    }
                }
            });
            
            // 3. Mapa de ocorrências para o LOTE ATUAL de processamento
            const batchOccurrenceMap = new Map<string, number>();

            const toPersist = transactions
                .map(item => {
                    let isoDate = item.date;
                    if (isoDate && !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
                        const resolved = DateResolver.resolveToISO(isoDate, new Date().getFullYear());
                        if (resolved) isoDate = resolved;
                    }

                    const baseHash = this.computeBaseHash({ ...item, date: isoDate }, userId, hashBankId);
                    
                    // Lógica de Indice Incremental:
                    // Próximo índice = (Máximo já no DB + 1) + (Ocorrências já vistas neste lote)
                    const baseDbIndex = (dbOccurrenceMax.get(baseHash) ?? -1) + 1;
                    const batchIndex = batchOccurrenceMap.get(baseHash) || 0;
                    
                    const finalIndex = baseDbIndex + batchIndex;
                    batchOccurrenceMap.set(baseHash, batchIndex + 1);

                    const finalRowHash = `${baseHash}_${finalIndex}`;
                    
                    // Deduplicação Final: Se o hash gerado ainda colidir (improvável agora), pula.
                    if (existingHashes.has(finalRowHash)) {
                        return null; 
                    }

                    return {
                        transaction_date: isoDate,
                        amount: item.amount,
                        description: item.description, 
                        type: (item.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
                        // Se for banco virtual, guarda o identificador no pix_key para hidratação posterior
                        pix_key: currentBankId ? (item.paymentMethod || 'OUTROS') : bankId, 
                        source: source,
                        user_id: userId,
                        bank_id: currentBankId,
                        row_hash: finalRowHash,
                        status: 'pending' as const
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

            const novosCount = toPersist.length;

            if (novosCount > 0) {
                // Injeta no banco de dados respeitando a integridade total
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