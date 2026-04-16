
import { consolidationService } from './ConsolidationService';
import { Transaction } from '../types';
import { Logger } from './monitoringService';
import { DateResolver } from '../core/processors/DateResolver';
import { NameResolver } from '../core/processors/NameResolver';

const hashesInFlight = new Set<string>();

export const LaunchService = {
    /**
     * 🛡️ FUNIL DE NORMALIZAÇÃO PARA HASH (V4 - ESTABILIDADE ABSOLUTA)
     * Gera uma representação normalizada apenas para evitar duplicatas.
     */
    normalizeTriplet: (t: any) => {
        let rawDate = String(t.date || t.transaction_date || '').trim();
        let isoDate = rawDate;
        if (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            const resolved = DateResolver.resolveToISO(rawDate, new Date().getFullYear());
            if (resolved) isoDate = resolved;
        }
        const finalDate = isoDate || rawDate || new Date().toISOString().split('T')[0];

        /**
         * 🎯 REATIVAÇÃO: Priorizamos o texto BRUTO (Literal) para o Hash.
         * Isso garante que, se o usuário subir o mesmo arquivo, o Hash será idêntico,
         * independente de como a IA limpou a descrição visual.
         */
        const cleanName = NameResolver.normalize(t.rawDescription || t.description || 'SEM_DESCRICAO');
        const finalValue = Number(t.amount || 0).toFixed(2);

        return { finalDate, cleanName, finalValue };
    },

    computeBaseHash: (key: string) => {
        let hash = 5381;
        const s = key || '';
        for (let i = 0; i < s.length; i++) {
            hash = ((hash << 5) + hash) + s.charCodeAt(i);
        }
        return `viva_${Math.abs(hash).toString(36)}`;
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
                .map((item, idx) => {
                    const originalRawContent = item.rawDescription || item.description || '';
                    const stableRaw = (originalRawContent || '').replace(/\r\n/g, '\n').trim();

                    // Hash GLOBAL (deduplicação entre arquivos e histórico)
                    const globalHashKey = `U${userId}|B${bankId}|R${stableRaw}`;
                    const globalHash = this.computeBaseHash(globalHashKey);

                    // Hash LOCAL (controle apenas durante o processamento atual)
                    const localHashKey = `${globalHashKey}|I${idx}`;
                    const localHash = this.computeBaseHash(localHashKey);
                    
                    // Bloqueia se já existe no banco ou se está sendo processado agora (inFlight)
                    if (existingHashes.has(globalHash) || hashesInFlight.has(localHash)) {
                        return null; 
                    }

                    hashesInFlight.add(localHash);
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
                        row_hash: globalHash,
                        status: 'pending' as const,
                        _localHash: localHash // Ephemeral para cleanup
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

            const novosCount = toPersist.length;
            if (novosCount > 0) {
                // Remove o campo temporário antes de enviar para o banco
                const dataToInsert = toPersist.map(({ _localHash, ...rest }) => rest);
                await consolidationService.addTransactions(dataToInsert as any);
            }
            
            // Limpa o cache de voo após o processamento usando o hash local
            setTimeout(() => {
                toPersist.forEach(t => { if(t._localHash) hashesInFlight.delete(t._localHash); });
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
