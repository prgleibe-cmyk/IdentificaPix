import { get, set, del, keys } from 'idb-keyval';
import { MonthClosingRecord, DigitalSignature } from '../types/domain';

const CLOSING_PREFIX = 'idpix_month_closing_';

// Cache em memória de períodos fechados: chave = `${churchId}_${year}_${month}` -> boolean
const memoryClosedCache = new Map<string, boolean>();

// Cache em memória com todos os registros de fechamentos carregados
let allClosingsCache: MonthClosingRecord[] = [];

/**
 * Retorna o cabeçalho de autorização se disponível
 */
function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('iggestor_vps_access_token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
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
 * Monta a chave única do fechamento: idpix_month_closing_{churchId}_{bankId}_{year}_{month}
 */
function buildKey(churchId: string, year: number, month: number, bankId?: string | null): string {
    const bankPart = bankId && bankId !== 'all' ? `_${bankId}` : '';
    return `${CLOSING_PREFIX}${churchId || 'geral'}${bankPart}_${year}_${month}`;
}

/**
 * Salva ou atualiza um registro de fechamento mensal com suas assinaturas
 * (Persiste tanto no IndexedDB local quanto no Backend PostgreSQL/SQLite na nuvem)
 */
export async function saveMonthClosingRecord(record: MonthClosingRecord): Promise<void> {
    if (!record || !record.churchId || !record.year || !record.month) return;
    try {
        let finalRecord: MonthClosingRecord = { ...record };

        // 1. Persistência imediata no Backend Central com leitura da resposta
        try {
            const res = await fetch('/api/v1/church-closings', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(record)
            });
            if (res.ok) {
                const backendData = await res.json();
                if (backendData && backendData.id) {
                    finalRecord = {
                        ...finalRecord,
                        id: backendData.id || finalRecord.id,
                        churchId: backendData.church_id || finalRecord.churchId,
                        churchName: backendData.church_name || finalRecord.churchName,
                        bankId: backendData.bank_id || finalRecord.bankId,
                        month: Number(backendData.month ?? finalRecord.month),
                        year: Number(backendData.year ?? finalRecord.year),
                        closedAt: backendData.closed_at || finalRecord.closedAt,
                        totalIncome: Number(backendData.total_income ?? finalRecord.totalIncome),
                        totalExpenses: Number(backendData.total_expenses ?? finalRecord.totalExpenses),
                        finalBalance: Number(backendData.final_balance ?? finalRecord.finalBalance),
                        transferredBalance: (backendData.transferred_balance !== undefined && backendData.transferred_balance !== null)
                            ? Number(backendData.transferred_balance)
                            : finalRecord.transferredBalance,
                        targetChurchId: backendData.target_church_id || finalRecord.targetChurchId,
                        targetChurchName: backendData.target_church_name || finalRecord.targetChurchName,
                        integrityHash: backendData.integrity_hash || finalRecord.integrityHash,
                        status: backendData.status || finalRecord.status,
                        signatures: typeof backendData.signatures === 'string' ? JSON.parse(backendData.signatures) : (backendData.signatures || finalRecord.signatures),
                        notes: backendData.notes || finalRecord.notes
                    };
                }
            } else {
                console.warn('[MonthClosingService] Resposta não-200 ao sincronizar com backend:', res.status);
            }
        } catch (apiErr) {
            console.warn('[MonthClosingService] Falha na sincronização imediata com backend (mantido offline):', apiErr);
        }

        // 2. Persistência definitiva no IndexedDB local
        const key = buildKey(finalRecord.churchId, finalRecord.year, finalRecord.month, finalRecord.bankId);
        await set(key, finalRecord);

        // 3. Atualização do cache em memória com dados completos
        const bankPart = finalRecord.bankId && finalRecord.bankId !== 'all' ? `_${finalRecord.bankId}` : '';
        const cacheKey = `${finalRecord.churchId}${bankPart}_${finalRecord.year}_${finalRecord.month}`;
        memoryClosedCache.set(cacheKey, finalRecord.status !== 'reopened');

        const existingIdx = allClosingsCache.findIndex(c => c.id === finalRecord.id || (c.churchId === finalRecord.churchId && c.year === finalRecord.year && c.month === finalRecord.month && (c.bankId || null) === (finalRecord.bankId || null)));
        if (existingIdx >= 0) {
            allClosingsCache[existingIdx] = { ...finalRecord };
        } else {
            allClosingsCache.push({ ...finalRecord });
        }

        // 4. Notificação com o registro COMPLETO para atualizar o estado do Livro Caixa sem perda do transporte
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('month_closing_updated', { 
                detail: finalRecord 
            }));
        }
    } catch (err) {
        console.error('[MonthClosingService] Erro ao salvar fechamento:', err);
    }
}

/**
 * Obtém o registro de fechamento do mês para uma igreja e conta
 */
export async function getMonthClosingRecord(
    churchId: string, 
    year: number, 
    month: number,
    bankId?: string | null
): Promise<MonthClosingRecord | null> {
    try {
        const key = buildKey(churchId, year, month, bankId);
        let record = await get<MonthClosingRecord>(key);

        if (churchId && churchId !== 'geral') {
            // Consulta o backend central para obter o status autoritativo em tempo real
            try {
                const queryParam = bankId && bankId !== 'all' ? `?bank_id=${encodeURIComponent(bankId)}` : '';
                const res = await fetch(`/api/v1/church-closings/${encodeURIComponent(churchId)}/${year}/${month}${queryParam}`, {
                    headers: getAuthHeaders()
                });
                if (res.ok) {
                    const backendData = await res.json();
                    if (backendData && backendData.id) {
                        record = {
                            id: backendData.id,
                            churchId: backendData.church_id,
                            churchName: backendData.church_name || '',
                            bankId: backendData.bank_id || null,
                            month: Number(backendData.month),
                            year: Number(backendData.year),
                            closedAt: backendData.closed_at,
                            totalIncome: Number(backendData.total_income || 0),
                            totalExpenses: Number(backendData.total_expenses || 0),
                            previousBalance: 0,
                            finalBalance: Number(backendData.final_balance || 0),
                            transferredBalance: (backendData.transferred_balance !== undefined && backendData.transferred_balance !== null) ? Number(backendData.transferred_balance) : undefined,
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
                } else if (res.status === 404) {
                    record = null;
                    await del(key);
                }
            } catch (_) {}
        }

        const bankPart = record?.bankId && record.bankId !== 'all' ? `_${record.bankId}` : '';
        const cacheKey = `${churchId}${bankPart}_${year}_${month}`;
        const isClosed = Boolean(record && record.status !== 'reopened');
        memoryClosedCache.set(cacheKey, isClosed);
        if (!isClosed) {
            memoryClosedCache.set(`${churchId}_${year}_${month}`, false);
        }

        return record || null;
    } catch (err) {
        console.error('[MonthClosingService] Erro ao carregar fechamento:', err);
        return null;
    }
}

/**
 * Remove ou desfaz um fechamento mensal caso precise ser reaberto
 */
export async function deleteMonthClosingRecord(
    churchId: string, 
    year: number, 
    month: number,
    bankId?: string | null
): Promise<void> {
    await reopenMonthClosingRecord(churchId, year, month, bankId);
}

/**
 * Desfaz o fechamento final e reabre o período para novos lançamentos
 * (Garante a desativação da trava imediatamente em memória, IndexedDB e no Backend PostgreSQL)
 */
export async function reopenMonthClosingRecord(
    churchId: string, 
    year: number, 
    month: number,
    bankId?: string | null
): Promise<boolean> {
    try {
        const bankPart = bankId && bankId !== 'all' ? `_${bankId}` : '';
        const cacheKey = `${churchId}${bankPart}_${year}_${month}`;
        // 1. Liberação IMEDIATA da memória (chaves consolidada e específicas)
        memoryClosedCache.set(cacheKey, false);
        memoryClosedCache.set(`${churchId}_${year}_${month}`, false);
        for (const k of Array.from(memoryClosedCache.keys())) {
            if (k.startsWith(`${churchId}_`) && k.endsWith(`_${year}_${month}`)) {
                memoryClosedCache.set(k, false);
            }
        }

        // 2. Atualização no IndexedDB para evitar ressurreição por cache local
        const key = buildKey(churchId, year, month, bankId);
        const existing = await get<MonthClosingRecord>(key);
        if (existing) {
            await set(key, { ...existing, status: 'reopened' });
        } else {
            await del(key);
        }
        if (!bankId || bankId === 'all') {
            await del(buildKey(churchId, year, month, null));
        }

        // 3. Atualização no Backend Central
        try {
            const res = await fetch('/api/v1/church-closings/reopen', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ churchId, year, month, bankId: bankId || null })
            });
            if (!res.ok) {
                console.warn('[MonthClosingService] Resposta do backend ao reabrir:', res.status);
            }
        } catch (apiErr) {
            console.warn('[MonthClosingService] Erro ao comunicar reabertura ao backend:', apiErr);
        }

        // Atualiza cache em memória de fechamentos
        const closingId = (bankId && bankId !== 'all')
            ? `closing_${churchId}_${bankId}_${year}_${month}`
            : `closing_${churchId}_${year}_${month}`;
        const item = allClosingsCache.find(c => c.id === closingId || (c.churchId === churchId && c.year === year && c.month === month && (c.bankId || null) === (bankId || null)));
        if (item) {
            item.status = 'reopened';
        }

        // 4. Notificação em tempo real via BroadcastChannel para outras abas/usuários no mesmo navegador
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const bc = new BroadcastChannel('identificapix_realtime_sync');
                bc.postMessage({ type: 'MONTH_CLOSING_UPDATED', churchId, year, month, status: 'reopened' });
                bc.close();
            } catch (_) {}
        }

        // 5. Notificação via evento de janela
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('month_closing_updated', { 
                detail: { churchId, bankId: bankId || null, year, month, status: 'reopened' } 
            }));
        }

        return true;
    } catch (err) {
        console.error('[MonthClosingService] Erro ao reabrir fechamento:', err);
        return false;
    }
}

/**
 * Retorna todos os registros de fechamentos homologados ou rascunhos da organização
 */
export async function getAllChurchClosings(churchId?: string): Promise<MonthClosingRecord[]> {
    try {
        let url = '/api/v1/church-closings';
        if (churchId && churchId !== 'geral') {
            url += `?church_id=${encodeURIComponent(churchId)}`;
        }
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) {
                allClosingsCache = list.map((item: any) => ({
                    id: item.id,
                    churchId: item.church_id,
                    churchName: item.church_name || '',
                    bankId: item.bank_id || null,
                    month: Number(item.month),
                    year: Number(item.year),
                    closedAt: item.closed_at,
                    totalIncome: Number(item.total_income || 0),
                    totalExpenses: Number(item.total_expenses || 0),
                    previousBalance: 0,
                    finalBalance: Number(item.final_balance || 0),
                    transferredBalance: (item.transferred_balance !== undefined && item.transferred_balance !== null) ? Number(item.transferred_balance) : undefined,
                    targetChurchId: item.target_church_id || null,
                    targetChurchName: item.target_church_name || undefined,
                    integrityHash: item.integrity_hash || '',
                    status: item.status || 'closed',
                    signatures: typeof item.signatures === 'string' ? JSON.parse(item.signatures) : (item.signatures || []),
                    notes: item.notes || undefined
                }));
                return allClosingsCache;
            }
        }
    } catch (err) {
        console.warn('[MonthClosingService] Falha ao carregar lista completa de fechamentos:', err);
    }
    return allClosingsCache;
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
            // Se sincronizando todas as congregações, reinicia o cache em memória para que períodos reabertos não fiquem travados
            if (!churchId || churchId === 'geral') {
                memoryClosedCache.clear();
            } else {
                for (const k of Array.from(memoryClosedCache.keys())) {
                    if (k.startsWith(`${churchId}_`)) {
                        memoryClosedCache.delete(k);
                    }
                }
            }

            for (const item of list) {
                const cId = item.church_id;
                const yr = Number(item.year);
                const mo = Number(item.month);
                const isClosed = item.status !== 'reopened' && item.status !== 'open';
                memoryClosedCache.set(`${cId}_${yr}_${mo}`, isClosed);
                if (item.bank_id && item.bank_id !== 'all') {
                    memoryClosedCache.set(`${cId}_${item.bank_id}_${yr}_${mo}`, isClosed);
                }

                const key = buildKey(cId, yr, mo, item.bank_id);
                const existing = await get<MonthClosingRecord>(key);
                if (!existing) {
                    await set(key, {
                        id: item.id,
                        churchId: item.church_id,
                        churchName: item.church_name || '',
                        bankId: item.bank_id || null,
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
                } else if (existing.status !== item.status) {
                    // Atualiza status se mudou no servidor (ex: reaberto)
                    await set(key, { ...existing, status: item.status });
                }
            }

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('month_closing_updated', { detail: { synced: true } }));
            }
        }
    } catch (err) {
        console.warn('[MonthClosingService] Falha ao sincronizar fechamentos:', err);
    }
}

/**
 * 🛡️ Verifica de forma síncrona se um período para determinada igreja (e opcionalmente conta) está fechado
 */
export function isChurchPeriodClosedSync(churchId: string | null | undefined, dateStr: string | null | undefined, bankId?: string | null | undefined): boolean {
    if (!churchId || !dateStr || churchId === 'unidentified' || churchId === 'geral') return false;
    const cleanDate = dateStr.split(/[T ]/)[0];
    const parts = cleanDate.split('-');
    if (parts.length < 2) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return false;

    if (bankId && bankId !== 'all') {
        const specificKey = `${churchId}_${bankId}_${year}_${month}`;
        if (memoryClosedCache.get(specificKey) === true) return true;
    }

    const consolidatedKey = `${churchId}_${year}_${month}`;
    return memoryClosedCache.get(consolidatedKey) === true;
}

/**
 * 🛡️ Verifica se qualquer congregação possui o período fechado para a data informada
 */
export function isAnyChurchPeriodClosedSync(dateStr: string | null | undefined): boolean {
    if (!dateStr) return false;
    const cleanDate = dateStr.split(/[T ]/)[0];
    const parts = cleanDate.split('-');
    if (parts.length < 2) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return false;

    const targetSuffix = `_${year}_${month}`;
    for (const [key, isClosed] of memoryClosedCache.entries()) {
        if (isClosed === true && key.endsWith(targetSuffix)) {
            return true;
        }
    }
    return false;
}

/**
 * 🛡️ Retorna o conjunto de períodos (YYYY-MM) autoritativamente fechados
 */
export function getClosedPeriodsSetFromCache(churchId?: string): Set<string> {
    const set = new Set<string>();
    for (const [key, isClosed] of memoryClosedCache.entries()) {
        if (isClosed !== true) continue;
        const parts = key.split('_');
        if (parts.length >= 3) {
            const cId = parts[0];
            const yr = parts[1];
            const mo = parts[2].padStart(2, '0');
            if (!churchId || churchId === 'geral' || cId === churchId) {
                set.add(`${yr}-${mo}`);
            }
        }
    }
    return set;
}

/**
 * 🛡️ Verifica de forma assíncrona se um período para determinada igreja (e opcionalmente conta) está fechado
 */
export async function isChurchPeriodClosedAsync(churchId: string | null | undefined, dateStr: string | null | undefined, bankId?: string | null | undefined): Promise<boolean> {
    if (!churchId || !dateStr || churchId === 'unidentified' || churchId === 'geral') return false;
    const cleanDate = dateStr.split(/[T ]/)[0];
    const parts = cleanDate.split('-');
    if (parts.length < 2) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return false;

    // 1. Checa memória
    if (bankId && bankId !== 'all') {
        const specificKey = `${churchId}_${bankId}_${year}_${month}`;
        if (memoryClosedCache.has(specificKey)) {
            if (memoryClosedCache.get(specificKey) === true) return true;
        }
    }
    const consolidatedKey = `${churchId}_${year}_${month}`;
    if (memoryClosedCache.has(consolidatedKey)) {
        if (memoryClosedCache.get(consolidatedKey) === true) return true;
    }

    // 2. Checa fechamento individual
    if (bankId && bankId !== 'all') {
        const record = await getMonthClosingRecord(churchId, year, month, bankId);
        if (record && record.status !== 'reopened') {
            memoryClosedCache.set(`${churchId}_${bankId}_${year}_${month}`, true);
            return true;
        }
    }

    // 3. Checa fechamento consolidado
    const record = await getMonthClosingRecord(churchId, year, month, null);
    if (record && record.status !== 'reopened') {
        memoryClosedCache.set(consolidatedKey, true);
        return true;
    }

    return false;
}

// Inicialização automática de escuta de eventos para manter o cache atualizado
if (typeof window !== 'undefined') {
    window.addEventListener('month_closing_updated', (e: any) => {
        const detail = e.detail;
        if (detail && detail.churchId && detail.year && detail.month) {
            const isClosed = detail.status !== 'reopened' && detail.status !== 'open';
            const bankPart = detail.bankId && detail.bankId !== 'all' ? `_${detail.bankId}` : '';
            memoryClosedCache.set(`${detail.churchId}${bankPart}_${detail.year}_${detail.month}`, isClosed);
            if (!isClosed) {
                memoryClosedCache.set(`${detail.churchId}_${detail.year}_${detail.month}`, false);
                for (const k of Array.from(memoryClosedCache.keys())) {
                    if (k.startsWith(`${detail.churchId}_`) && k.endsWith(`_${detail.year}_${detail.month}`)) {
                        memoryClosedCache.set(k, false);
                    }
                }
            }
        }
    });

    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const bc = new BroadcastChannel('identificapix_realtime_sync');
            bc.onmessage = (event) => {
                if (event.data?.type === 'MONTH_CLOSING_UPDATED') {
                    const { churchId, year, month, status } = event.data;
                    if (churchId && year && month) {
                        const isClosed = status !== 'reopened' && status !== 'open';
                        memoryClosedCache.set(`${churchId}_${year}_${month}`, isClosed);
                        if (!isClosed) {
                            for (const k of Array.from(memoryClosedCache.keys())) {
                                if (k.startsWith(`${churchId}_`) && k.endsWith(`_${year}_${month}`)) {
                                    memoryClosedCache.set(k, false);
                                }
                            }
                        }
                    }
                    syncAllChurchClosings().catch(() => {});
                }
            };
        } catch (_) {}
    }

    // Inicia sincronização em segundo plano imediatamente
    syncAllChurchClosings().catch(() => {});
}

