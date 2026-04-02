
import { consolidationService } from './ConsolidationService';
import { Transaction } from '../types';
import { Logger } from './monitoringService';
import { DateResolver } from '../core/processors/DateResolver';
import { NameResolver } from '../core/processors/NameResolver';

const hashesInFlight = new Set<string>();

export const LaunchService = {
    /**
     * 🛡️ FUNIL DE NORMALIZAÇÃO PARA HASH (V5 - PADRONIZAÇÃO GLOBAL)
     * Gera uma representação normalizada e limpa para garantir deduplicação consistente.
     */
    normalizeTriplet: (t: any) => {
        let rawDate = String(t.date || t.transaction_date || '').trim();
        let isoDate = rawDate.split('T')[0];
        if (isoDate && !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
            const resolved = DateResolver.resolveToISO(isoDate, new Date().getFullYear());
            if (resolved) isoDate = resolved;
        }
        const finalDate = isoDate || '0000-00-00';

        const cleanName = NameResolver.normalize(t.description || t.rawDescription || 'SEM_DESCRICAO');
        const finalValue = Number(t.amount || 0).toFixed(2);

        return { finalDate, cleanName, finalValue };
    },

    computeBaseHash: (t: any, userId: string, bankId: string | null) => {
        const { finalDate, cleanName, finalValue } = LaunchService.normalizeTriplet(t);
        
        /**
         * 🛡️ ALGORITMO DE HASH GLOBAL (V7)
         * Padronizado para todas as fontes (Arquivo, Gmail, SMS).
         * Campos: User, Data, Valor, Descrição, PixKey, BankId, Tipo.
         */
        const amount = finalValue;
        const description = cleanName;
        const type = Number(t.amount || 0) >= 0 ? 'income' : 'expense';
        
        // Normalização rigorosa de bank_id e pix_key
        const isUuid = /^[0-9a-fA-F-]{36}$/.test(bankId || '');
        const bank_id = isUuid ? bankId : String(bankId || 'NULL').toUpperCase().trim();
        const pix_key = String(t.pix_key || t.paymentMethod || 'OUTROS').toUpperCase().trim();
        
        // String Única (Sem rawContent para permitir deduplicação entre fontes diferentes)
        const rawKey = `U:${userId}|D:${finalDate}|V:${amount}|N:${description}|P:${pix_key}|B:${bank_id}|T:${type}`;
        
        let hash = 5381;
        for (let i = 0; i < rawKey.length; i++) {
            hash = ((hash << 5) + hash) + rawKey.charCodeAt(i);
        }
        return `glb_${Math.abs(hash).toString(36)}`;
    },

    /**
     * 🚀 LANÇAMENTO NA LISTA VIVA (PRESERVAÇÃO LITERAL COM BLOQUEIO DE DUPLICADOS)
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
            // Busca todos os hashes existentes no banco para este usuário
            const existingData = await consolidationService.getExistingTransactionsForDedup(userId);
            const existingHashes = new Set(existingData.map(t => t.row_hash).filter(Boolean));
            
            const toPersist = transactions
                .map((item) => {
                    const finalRowHash = this.computeBaseHash(item, userId, bankId);
                    
                    // Bloqueia se já existe no banco ou se está sendo processado agora (inFlight)
                    if (existingHashes.has(finalRowHash) || hashesInFlight.has(finalRowHash)) {
                        return null; 
                    }

                    hashesInFlight.add(finalRowHash);
                    const { finalDate } = this.normalizeTriplet(item);

                    return {
                        transaction_date: finalDate,
                        amount: item.amount,
                        description: item.description, // Descrição visual (pode ser a limpa)
                        type: (item.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
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
                await consolidationService.addTransactions(toPersist as any);
            }
            
            // Limpa o cache de voo após o processamento
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
