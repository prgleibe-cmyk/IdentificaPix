import { get, set, del, keys } from 'idb-keyval';
import { MonthClosingRecord, DigitalSignature } from '../types/domain';

const CLOSING_PREFIX = 'idpix_month_closing_';

/**
 * Gera um Hash criptográfico SHA-256 inviolável dos dados contábeis do fechamento
 */
export async function generateClosingIntegrityHash(data: {
    churchId: string;
    month: number;
    year: number;
    totalIncome: number;
    totalExpenses: number;
    previousBalance: number;
    finalBalance: number;
    timestamp: string;
}): Promise<string> {
    const rawString = `${data.churchId}|${data.year}-${String(data.month).padStart(2, '0')}|ENTRADAS:${data.totalIncome.toFixed(2)}|SAIDAS:${data.totalExpenses.toFixed(2)}|SALDO_ANT:${data.previousBalance.toFixed(2)}|SALDO_FINAL:${data.finalBalance.toFixed(2)}|TS:${data.timestamp}`;
    
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(rawString);
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.error('[MonthClosingService] Erro ao gerar SHA-256 nativo:', e);
        }
    }
    
    // Fallback simples caso crypto.subtle não esteja disponível
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
        const char = rawString.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return 'FALLBACK-' + Math.abs(hash).toString(16).toUpperCase().padStart(16, '0');
}

/**
 * Monta a chave única do fechamento: idpix_month_closing_{churchId}_{year}_{month}
 */
function buildKey(churchId: string, year: number, month: number): string {
    return `${CLOSING_PREFIX}${churchId || 'geral'}_${year}_${month}`;
}

/**
 * Salva ou atualiza um registro de fechamento mensal com suas assinaturas
 */
export async function saveMonthClosingRecord(record: MonthClosingRecord): Promise<void> {
    if (!record || !record.churchId || !record.year || !record.month) return;
    try {
        const key = buildKey(record.churchId, record.year, record.month);
        await set(key, record);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('month_closing_updated', { 
                detail: { churchId: record.churchId, year: record.year, month: record.month } 
            }));
        }
    } catch (err) {
        console.error('[MonthClosingService] Erro ao salvar fechamento:', err);
    }
}

/**
 * Obtém o registro de fechamento do mês para uma igreja
 */
export async function getMonthClosingRecord(
    churchId: string, 
    year: number, 
    month: number
): Promise<MonthClosingRecord | null> {
    try {
        const key = buildKey(churchId, year, month);
        const record = await get<MonthClosingRecord>(key);
        return record || null;
    } catch (err) {
        console.error('[MonthClosingService] Erro ao carregar fechamento:', err);
        return null;
    }
}

/**
 * Remove um fechamento mensal caso precise ser reaberto
 */
export async function deleteMonthClosingRecord(
    churchId: string, 
    year: number, 
    month: number
): Promise<void> {
    try {
        const key = buildKey(churchId, year, month);
        await del(key);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('month_closing_updated', { 
                detail: { churchId, year, month } 
            }));
        }
    } catch (err) {
        console.error('[MonthClosingService] Erro ao deletar fechamento:', err);
    }
}
