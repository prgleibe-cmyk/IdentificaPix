
import { consolidationService } from './ConsolidationService';
import { Transaction } from '../types';
import { Logger } from './monitoringService';
import { DateResolver } from '../core/processors/DateResolver';
import { NameResolver } from '../core/processors/NameResolver';

const hashesInFlight = new Set<string>();

const STOP_WORDS = new Set([
    'PIX', 'RECEBIDO', 'RECEB', 'ENVIADO', 'PAGAMENTO', 'PAGTO', 'TRANSF', 'TRANSFERENCIA',
    'SICOOB', 'SICREDI', 'BRADESCO', 'ITAU', 'SANTANDER', 'CAIXA', 'BB', 'BANCO', 'DEBITO',
    'CREDITO', 'TARIFA', 'EFETI', 'OUTRA', 'EMIT', 'LANÇAMENTO', 'LANCAMENTO', 'SALDO',
    'ESTORNO', 'AUTORIZADO', 'REMETENTE', 'DESTINATARIO', 'FAVORECIDO', 'VALOR', 'CONTA',
    'COMPROVANTE', 'OPERACAO', 'AGENCIA', 'BOLETO', 'RDC', 'INTER', 'NUBANK'
]);

function getDaysDifference(dateStr1: string, dateStr2: string): number {
    if (!dateStr1 || !dateStr2) return 999;
    const d1 = new Date(dateStr1.substring(0, 10));
    const d2 = new Date(dateStr2.substring(0, 10));
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 999;
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function extractSignificantTokens(text: string): Set<string> {
    if (!text) return new Set();
    const clean = NameResolver.clean(text).toUpperCase();
    const words = clean.split(/[^A-Z0-9]+/);
    const tokens = new Set<string>();
    for (const w of words) {
        if (w.length >= 3 && !STOP_WORDS.has(w)) {
            tokens.add(w);
        }
    }
    return tokens;
}

function areDescriptionsMatching(desc1: string, desc2: string): boolean {
    const tokens1 = extractSignificantTokens(desc1);
    const tokens2 = extractSignificantTokens(desc2);
    
    if (tokens1.size === 0 || tokens2.size === 0) {
        return true;
    }
    
    for (const t of tokens1) {
        if (tokens2.has(t)) return true;
    }
    return false;
}

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
     * 🚀 LANÇAMENTO NA LISTA VIVA COM RECONCILIAÇÃO CRUZADA (SMS + OFX + JANELA TEMPORAL)
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
            // Busca todos os registros existentes no banco para este usuário
            const existingData = await consolidationService.getExistingTransactionsForDedup(userId);
            const existingHashes = new Set(existingData.map(t => t.row_hash).filter(Boolean));
            const matchedExistingIds = new Set<string>();

            const currentFileOccurrenceCounters = new Map<string, number>();
            const toPersist: any[] = [];
            let enrichedCount = 0;

            for (let idx = 0; idx < transactions.length; idx++) {
                const item = transactions[idx];
                const { finalDate, finalValue } = this.normalizeTriplet(item);
                const originalRawContent = item.rawDescription || item.description || '';
                const stableRaw = (originalRawContent || '').replace(/\r\n/g, '\n').trim();

                // Hash GLOBAL (deduplicação exata de arquivo)
                const baseKey = `U${userId}|B${bankId}|D${finalDate}|V${finalValue}|R${stableRaw}`;
                
                const occurrenceIndex = currentFileOccurrenceCounters.get(baseKey) || 0;
                currentFileOccurrenceCounters.set(baseKey, occurrenceIndex + 1);

                const globalHashKey = occurrenceIndex === 0
                    ? baseKey
                    : `${baseKey}|O${occurrenceIndex}`;

                const globalHash = this.computeBaseHash(globalHashKey);
                const localHashKey = `${globalHashKey}|I${idx}`;
                const localHash = this.computeBaseHash(localHashKey);

                // 1. CHECAGEM POR HASH EXATO (Se já existe idêntico no banco ou em voo)
                if (existingHashes.has(globalHash) || hashesInFlight.has(localHash)) {
                    continue; 
                }

                // 2. RECONCILIAÇÃO CRUZADA INTELIGENTE (Ex: SMS / Notificação vs. Extrato OFX)
                // Compara com registros existentes (especialmente vindos de SMS/Notificação) no mesmo banco
                // aplicando a janela flexível de 0 a 3 dias (finais de semana / feriados) e mesmo valor.
                const numAmount = Number(item.amount || 0);

                const candidates = existingData.filter(ex => {
                    if (matchedExistingIds.has(ex.id)) return false;

                    // Checa compatibilidade de banco se UUID fornecido
                    if (currentBankId && ex.bank_id && ex.bank_id !== currentBankId) {
                        return false;
                    }

                    // Valor exato (precisão de centavos)
                    const exAmt = Number(ex.amount || 0);
                    if (Math.abs(exAmt - numAmount) >= 0.001) return false;

                    // Janela temporal de 0 a 3 dias (diferença de final de semana/feriado)
                    const exDate = ex.transaction_date || ex.date || '';
                    const daysDiff = getDaysDifference(finalDate, exDate);
                    if (daysDiff > 3) return false;

                    return true;
                });

                let crossMatchFound: any = null;

                if (candidates.length === 1) {
                    const cand = candidates[0];
                    if (areDescriptionsMatching(originalRawContent || item.description, cand.description || cand.rawDescription || '')) {
                        crossMatchFound = cand;
                    }
                } else if (candidates.length > 1) {
                    for (const cand of candidates) {
                        if (areDescriptionsMatching(originalRawContent || item.description, cand.description || cand.rawDescription || '')) {
                            crossMatchFound = cand;
                            break;
                        }
                    }
                }

                if (crossMatchFound) {
                    // ✅ CORRESPONDÊNCIA ENCONTRADA!
                    // Enriquece a transação existente (ex: marca como 'sms+ofx') sem gerar duplicata
                    matchedExistingIds.add(crossMatchFound.id);
                    enrichedCount++;

                    const currentSrc = crossMatchFound.source || 'sms';
                    const updatedSource = currentSrc.includes('ofx') ? currentSrc : `${currentSrc}+ofx`;

                    consolidationService.enrichTransaction(
                        crossMatchFound.id,
                        updatedSource,
                        item.rawDescription || item.description
                    ).catch(err => console.error('[CrossMatch:EnrichFail]', err));

                    continue; // Pula a inserção para não duplicar!
                }

                // 3. SE NÃO ENCONTROU DUPLICATA NEM CORRESPONDÊNCIA CRUZADA -> INSERE NOVA TRANSAÇÃO
                hashesInFlight.add(localHash);

                toPersist.push({
                    transaction_date: finalDate,
                    amount: item.amount,
                    description: item.description,
                    type: (item.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
                    pix_key: currentBankId ? (item.paymentMethod || 'OUTROS') : bankId, 
                    source: source,
                    user_id: userId,
                    bank_id: currentBankId,
                    row_hash: globalHash,
                    status: 'pending' as const,
                    _localHash: localHash
                });
            }

            const novosCount = toPersist.length;
            if (novosCount > 0) {
                const dataToInsert = toPersist.map(({ _localHash, ...rest }) => rest);
                await consolidationService.addTransactions(dataToInsert as any);
            }
            
            setTimeout(() => {
                toPersist.forEach(t => { if(t._localHash) hashesInFlight.delete(t._localHash); });
            }, 5000);

            const totalSkipped = totalReceived - novosCount;
            console.log(`[LaunchService:RECONCILE] Processado: Total=${totalReceived}, Adicionados=${novosCount}, Duplicados/Enriquecidos=${totalSkipped} (SMS+OFX Auditados=${enrichedCount})`);

            return { added: novosCount, skipped: totalSkipped, total: totalReceived };

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
