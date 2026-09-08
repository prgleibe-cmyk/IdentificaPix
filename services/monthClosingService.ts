import { get, set, del, keys } from 'idb-keyval';
import { MonthClosingRecord, DigitalSignature } from '../types/domain';

const CLOSING_PREFIX = 'idpix_month_closing_';

// Cache em memória de períodos fechados: chave = `${churchId}_${year}_${month}` -> boolean
const memoryClosedCache = new Map<string, boolean>();

/**
 * Retorna o cabeçalho de autorização se disponível
 */
function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    return headers;
}

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
 * (Persiste tanto no IndexedDB local quanto no Backend PostgreSQL/SQLite na nuvem)
 */
export async function saveMonthClosingRecord(record: MonthClosingRecord): Promise<void> {
    if (!record || !record.churchId || !record.year || !record.month) return;
    try {
        const key = buildKey(record.churchId, record.year, record.month);
        await set(key, record);

        // Atualiza cache em memória
        const cacheKey = `${record.churchId}_${record.year}_${record.month}`;
        memoryClosedCache.set(cacheKey, record.status !== 'reopened');

        // Persistência no Backend Central
        try {
            const res = await fetch('/api/v1/church-closings', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(record)
            });
            if (!res.ok) {
                console.warn('[MonthClosingService] Resposta não-200 ao sincronizar com backend:', res.status);
            }
        } catch (apiErr) {
            console.warn('[MonthClosingService] Falha na sincronização imediata com backend (mantido offline):', apiErr);
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('month_closing_updated', { 
                detail: { churchId: record.churchId, year: record.year, month: record.month, status: record.status } 
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
        let record = await get<MonthClosingRecord>(key);

        if (!record && churchId && churchId !== 'geral') {
            // Tenta consultar no backend se não estiver no IndexedDB
            try {
                const res = await fetch(`/api/v1/church-closings/${encodeURIComponent(churchId)}/${year}/${month}`, {
                    headers: getAuthHeaders()
                });
                if (res.ok) {
                    const backendData = await res.json();
                    if (backendData && backendData.id) {
                        record = {
                            id: backendData.id,
                            churchId: backendData.church_id,
                            churchName: backendData.church_name || '',
                            month: Number(backendData.month),
                            year: Number(backendData.year),
                            closedAt: backendData.closed_at,
                            totalIncome: Number(backendData.total_income || 0),
                            totalExpenses: Number(backendData.total_expenses || 0),
                            previousBalance: 0,
                            finalBalance: Number(backendData.final_balance || 0),
                            transferredBalance: backendData.transferred_balance ? Number(backendData.transferred_balance) : undefined,
                            targetChurchId: backendData.target_church_id || null,
                            targetChurchName: backendData.target_church_name || undefined,
                            integrityHash: backendData.integrity_hash || '',
                            status: backendData.status || 'closed',
                            signatures: typeof backendData.signatures === 'string' ? JSON.parse(backendData.signatures) : (backendData.signatures || []),
                            notes: backendData.notes || undefined
                        };
                        // Armazena localmente
                        await set(key, record);
                    }
                }
            } catch (_) {}
        }

        if (record) {
            const cacheKey = `${churchId}_${year}_${month}`;
            memoryClosedCache.set(cacheKey, record.status !== 'reopened');
        }

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

        const cacheKey = `${churchId}_${year}_${month}`;
        memoryClosedCache.delete(cacheKey);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('month_closing_updated', { 
                detail: { churchId, year, month } 
            }));
        }
    } catch (err) {
        console.error('[MonthClosingService] Erro ao deletar fechamento:', err);
    }
}

/**
 * Sincroniza todos os fechamentos da igreja ou de todas as igrejas do banco com o cache local
 */
export async function syncAllChurchClosings(churchId?: string): Promise<void> {
    try {
        let url = '/api/v1/church-closings';
        if (churchId && churchId !== 'geral') {
            url += `?church_id=${encodeURIComponent(churchId)}`;
        }
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (!res.ok) return;

        const list = await res.json();
        if (Array.isArray(list)) {
            for (const item of list) {
                const cId = item.church_id;
                const yr = Number(item.year);
                const mo = Number(item.month);
                const isClosed = item.status !== 'reopened';
                memoryClosedCache.set(`${cId}_${yr}_${mo}`, isClosed);

                const key = buildKey(cId, yr, mo);
                const existing = await get<MonthClosingRecord>(key);
                if (!existing) {
                    await set(key, {
                        id: item.id,
                        churchId: item.church_id,
                        churchName: item.church_name || '',
                        month: mo,
                        year: yr,
                        closedAt: item.closed_at,
                        totalIncome: Number(item.total_income || 0),
                        totalExpenses: Number(item.total_expenses || 0),
                        previousBalance: 0,
                        finalBalance: Number(item.final_balance || 0),
                        transferredBalance: item.transferred_balance ? Number(item.transferred_balance) : undefined,
                        targetChurchId: item.target_church_id || null,
                        targetChurchName: item.target_church_name || undefined,
                        integrityHash: item.integrity_hash || '',
                        status: item.status || 'closed',
                        signatures: typeof item.signatures === 'string' ? JSON.parse(item.signatures) : (item.signatures || []),
                        notes: item.notes || undefined
                    });
                }
            }
        }
    } catch (err) {
        console.warn('[MonthClosingService] Falha ao sincronizar fechamentos:', err);
    }
}

/**
 * 🛡️ Verifica de forma síncrona se um período para determinada igreja está fechado
 */
export function isChurchPeriodClosedSync(churchId: string | null | undefined, dateStr: string | null | undefined): boolean {
    if (!churchId || !dateStr || churchId === 'unidentified' || churchId === 'geral') return false;
    const cleanDate = dateStr.split(/[T ]/)[0];
    const parts = cleanDate.split('-');
    if (parts.length < 2) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return false;

    const cacheKey = `${churchId}_${year}_${month}`;
    return memoryClosedCache.get(cacheKey) === true;
}

/**
 * 🛡️ Verifica de forma assíncrona se um período para determinada igreja está fechado
 */
export async function isChurchPeriodClosedAsync(churchId: string | null | undefined, dateStr: string | null | undefined): Promise<boolean> {
    if (!churchId || !dateStr || churchId === 'unidentified' || churchId === 'geral') return false;
    const cleanDate = dateStr.split(/[T ]/)[0];
    const parts = cleanDate.split('-');
    if (parts.length < 2) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return false;

    // 1. Checa memória
    const cacheKey = `${churchId}_${year}_${month}`;
    if (memoryClosedCache.has(cacheKey)) {
        return memoryClosedCache.get(cacheKey) === true;
    }

    // 2. Checa IndexedDB
    const record = await getMonthClosingRecord(churchId, year, month);
    if (record && record.status !== 'reopened') {
        memoryClosedCache.set(cacheKey, true);
        return true;
    }

    memoryClosedCache.set(cacheKey, false);
    return false;
}

// Inicialização automática de escuta de eventos para manter o cache atualizado
if (typeof window !== 'undefined') {
    window.addEventListener('month_closing_updated', (e: any) => {
        const detail = e.detail;
        if (detail && detail.churchId && detail.year && detail.month) {
            const isClosed = detail.status !== 'reopened';
            memoryClosedCache.set(`${detail.churchId}_${detail.year}_${detail.month}`, isClosed);
        }
    });

    // Inicia sincronização em segundo plano após carregamento inicial
    setTimeout(() => {
        syncAllChurchClosings().catch(() => {});
    }, 1500);
}

