
import { consolidationService } from './ConsolidationService';
import { Transaction } from '../types';
import { Logger } from './monitoringService';
import { DateResolver } from '../core/processors/DateResolver';
import { NameResolver } from '../core/processors/NameResolver';

// Cache global para evitar race conditions em uploads simultâneos ou cliques duplos
const hashesInFlight = new Set<string>();

export const LaunchService = {
    /**
     * 🛡️ FUNIL CENTRAL DE NORMALIZAÇÃO
     * Define o padrão ouro para o triplet (Data, Nome, Valor).
     */
    normalizeTriplet: (t: any) => {
        // 1. Data (YYYY-MM-DD)
        let rawDate = String(t.date || t.transaction_date || '').trim();
        let isoDate = rawDate;
        if (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            const resolved = DateResolver.resolveToISO(rawDate, new Date().getFullYear());
            if (resolved) isoDate = resolved;
        }
        const finalDate = isoDate || rawDate || '0000-00-00';

        // 2. Nome (Fiel ao processamento do sistema, sem ruído)
        // O NameResolver.normalize garante remoção de acentos e caixa alta
        const cleanName = NameResolver.normalize(t.description || t.rawDescription || 'SEM_DESCRICAO');

        // 3. Valor (String fixa com 2 casas decimais)
        const finalValue = Number(t.amount || 0).toFixed(2);

        return { finalDate, cleanName, finalValue };
    },

    /**
     * Gera a CHAVE ÚNICA DE BLINDAGEM: DATA|NOME|VALOR
     */
    computeBaseHash: (t: any, userId: string) => {
        const { finalDate, cleanName, finalValue } = LaunchService.normalizeTriplet(t);
        const rawKey = `U${userId}|D${finalDate}|N${cleanName}|V${finalValue}`;
        
        let hash = 5381;
        for (let i = 0; i < rawKey.length; i++) {
            hash = ((hash << 5) + hash) + rawKey.charCodeAt(i);
        }
        return `viva_${Math.abs(hash).toString(36)}`;
    },

    /**
     * 🚀 O ÚNICO PONTO DE ENTRADA PARA PERSISTÊNCIA NA LISTA VIVA
     * Verifica duplicatas contra o histórico total do usuário no banco.
     */
    async launchToBank(
        userId: string, 
        bankId: string, 
        transactions: Transaction[],
        source: 'file' | 'gmail' = 'file'
    ): Promise<{ added: number, skipped: number, total: number }> {
        if (!userId || !transactions || transactions.length === 0) {
            return { added: 0, skipped: 0, total: transactions?.length || 0 };
        }

        const totalReceived = transactions.length;
        const isUuid = /^[0-9a-fA-F-]{36}$/.test(bankId);
        const currentBankId = isUuid ? bankId : null;

        try {
            // 1. Busca hashes existentes (Dedupe contra histórico total: Pendentes + Reconciliados)
            const existingData = await consolidationService.getExistingTransactionsForDedup(userId);
            const existingHashes = new Set(existingData.map(t => t.row_hash).filter(Boolean));
            
            const toPersist = transactions
                .map((item, idx) => {
                    const finalRowHash = this.computeBaseHash(item, userId);
                    
                    // 🛡️ FILTRO DE BLINDAGEM (O FUNIL)
                    if (existingHashes.has(finalRowHash) || hashesInFlight.has(finalRowHash)) {
                        return null; 
                    }

                    hashesInFlight.add(finalRowHash);

                    const { finalDate } = this.normalizeTriplet(item);

                    const dbEntry = {
                        transaction_date: finalDate,
                        amount: item.amount,
                        description: item.description, 
                        type: (item.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
                        pix_key: currentBankId ? (item.paymentMethod || 'OUTROS') : bankId, 
                        source: source,
                        user_id: userId,
                        bank_id: currentBankId,
                        row_hash: finalRowHash,
                        status: 'pending' as const
                    };

                    if (item.id.includes('viva-block-') && idx === 0) {
                        console.log(`[PDF:PHASE:8:LIVE_LIST_INSERT] TRANSACTION -> ${JSON.stringify(item)} | DB_ENTRY -> ${JSON.stringify(dbEntry)}`);
                    }

                    return dbEntry;
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

            const novosCount = toPersist.length;

            if (novosCount > 0) {
                await consolidationService.addTransactions(toPersist as any);
            }
            
            // Limpeza curta do cache in-flight para permitir re-upload se deletado
            setTimeout(() => {
                toPersist.forEach(t => { if(t.row_hash) hashesInFlight.delete(t.row_hash); });
            }, 5000);

            return { added: novosCount, skipped: totalReceived - novosCount, total: totalReceived };

        } catch (e: any) {
            Logger.error(`[LaunchService:DEDUPE_FAIL]`, e);
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
