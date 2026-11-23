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

async function parseClosingApiError(res: Response, fallbackMsg: string): Promise<Error> {
    let text = '';
    try {
        text = await res.text();
    } catch (_) {}
    let msg = '';
    let code: string | undefined;
    if (text) {
        try {
            const parsed = JSON.parse(text);
            msg = parsed?.message || parsed?.error || '';
            code = parsed?.error;
        } catch (_) {
            msg = text;
        }
    }
    const err: any = new Error(msg || fallbackMsg);
    err.status = res.status;
    if (code) err.code = code;
    return err;
}

function isClosingStatusActive(status?: string | null): boolean {
    return status !== 'reopened' && status !== 'open';
}

function mapBackendClosingRow(row: any, fallback?: Partial<MonthClosingRecord>): MonthClosingRecord {
    const parsedSignatures = typeof row.signatures === 'string'
        ? (() => { try { return JSON.parse(row.signatures); } catch { return []; } })()
        : (row.signatures || fallback?.signatures || []);

    const periodType: 'monthly' | 'custom' =
        row.period_type === 'custom' || row.periodType === 'custom' || fallback?.periodType === 'custom'
            ? 'custom'
            : 'monthly';

    return {
        id: row.id || fallback?.id || '',
        churchId: row.church_id || row.churchId || fallback?.churchId || '',
        churchName: row.church_name || row.churchName || fallback?.churchName || '',
        bankId: (row.bank_id ?? row.bankId ?? fallback?.bankId) || null,
        month: Number(row.month ?? fallback?.month ?? 0),
        year: Number(row.year ?? fallback?.year ?? 0),
        periodType,
        startDate: row.start_date || row.startDate || fallback?.startDate || null,
        endDate: row.end_date || row.endDate || fallback?.endDate || null,
        closedAt: row.closed_at || row.closedAt || fallback?.closedAt || new Date().toISOString(),
        totalIncome: Number(row.total_income ?? row.totalIncome ?? fallback?.totalIncome ?? 0),
        totalExpenses: Number(row.total_expenses ?? row.totalExpenses ?? fallback?.totalExpenses ?? 0),
        previousBalance: fallback?.previousBalance ?? 0,
        finalBalance: Number(row.final_balance ?? row.finalBalance ?? fallback?.finalBalance ?? 0),
        transferredBalance: (row.transferred_balance !== undefined && row.transferred_balance !== null)
            ? Number(row.transferred_balance)
            : fallback?.transferredBalance,
        targetChurchId: row.target_church_id || row.targetChurchId || fallback?.targetChurchId || null,
        targetChurchName: row.target_church_name || row.targetChurchName || fallback?.targetChurchName || undefined,
        integrityHash: row.integrity_hash || row.integrityHash || fallback?.integrityHash || '',
        status: (row.status || fallback?.status || 'closed') as MonthClosingRecord['status'],
        signatures: parsedSignatures,
        notes: row.notes || fallback?.notes || undefined
    };
}

function rebuildMonthlyCacheFromAllClosings(churchId?: string): void {
    if (!churchId || churchId === 'geral') {
        memoryClosedCache.clear();
    } else {
        for (const k of Array.from(memoryClosedCache.keys())) {
            if (k.startsWith(`${churchId}_`)) {
                memoryClosedCache.delete(k);
            }
        }
    }

    for (const item of allClosingsCache) {
        if (churchId && churchId !== 'geral' && item.churchId !== churchId) continue;
        if (item.periodType === 'custom') continue; // Períodos parciais são validados por faixa em allClosingsCache
        if (!isClosingStatusActive(item.status)) continue;

        if (item.bankId && item.bankId !== 'all') {
            memoryClosedCache.set(`${item.churchId}_${item.bankId}_${item.year}_${item.month}`, true);
        } else {
            memoryClosedCache.set(`${item.churchId}_${item.year}_${item.month}`, true);
        }
    }
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
 * Salva ou atualiza um registro de fechamento contábil com suas assinaturas.
 * Backend-first: somente atualiza cache local/IndexedDB após confirmação real do servidor.
 */
export async function saveMonthClosingRecord(record: MonthClosingRecord): Promise<MonthClosingRecord> {
    if (!record || !record.churchId || !record.year || !record.month) {
        throw new Error('Dados obrigatórios do fechamento (igreja, mês e ano) não informados.');
    }

    // P4-A: Normaliza status sem assinatura para 'closed' (bloqueante)
    const normalizedStatus: MonthClosingRecord['status'] =
        (!record.status || record.status === 'draft')
            ? ((record.signatures && record.signatures.length > 0) ? 'signed' : 'closed')
            : record.status;

    const payload: MonthClosingRecord = {
        ...record,
        status: normalizedStatus,
        periodType: record.periodType || (record.startDate && record.endDate ? 'custom' : 'monthly')
    };

    // 1. Persistência obrigatória no Backend Central (sem fallback silencioso)
    const res = await fetch('/api/v1/church-closings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        throw await parseClosingApiError(
            res,
            `Erro HTTP ${res.status} ao registrar o fechamento no servidor.`
        );
    }

    const backendData = await res.json();
    const finalRecord: MonthClosingRecord = (backendData && backendData.id)
        ? mapBackendClosingRow(backendData, payload)
        : payload;

    // 2. Persistência no IndexedDB local apenas após confirmação do backend
    try {
        const key = finalRecord.periodType === 'custom' && finalRecord.id
            ? `${CLOSING_PREFIX}custom_${finalRecord.id}`
            : buildKey(finalRecord.churchId, finalRecord.year, finalRecord.month, finalRecord.bankId);
        await set(key, finalRecord);
    } catch (idbErr) {
        console.warn('[MonthClosingService] Aviso ao gravar espelho local no IndexedDB:', idbErr);
    }

    // 3. Atualização do cache em memória com dados autoritativos
    const existingIdx = allClosingsCache.findIndex(c =>
        c.id === finalRecord.id ||
        (
            c.periodType !== 'custom' &&
            finalRecord.periodType !== 'custom' &&
            c.churchId === finalRecord.churchId &&
            c.year === finalRecord.year &&
            c.month === finalRecord.month &&
            (c.bankId || null) === (finalRecord.bankId || null)
        )
    );
    if (existingIdx >= 0) {
        allClosingsCache[existingIdx] = { ...finalRecord };
    } else {
        allClosingsCache.push({ ...finalRecord });
    }

    if (finalRecord.periodType !== 'custom') {
        const bankPart = finalRecord.bankId && finalRecord.bankId !== 'all' ? `_${finalRecord.bankId}` : '';
        const cacheKey = `${finalRecord.churchId}${bankPart}_${finalRecord.year}_${finalRecord.month}`;
        memoryClosedCache.set(cacheKey, isClosingStatusActive(finalRecord.status));
    }

    // 4. Notificação com o registro COMPLETO para atualizar o estado do Livro Caixa sem perda do transporte
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('month_closing_updated', {
            detail: finalRecord
        }));
    }

    return finalRecord;
}

/**
 * Obtém o registro de fechamento do mês ou intervalo personalizado para uma igreja e conta
 */
export async function getMonthClosingRecord(
    churchId: string, 
    year: number, 
    month: number,
    bankId?: string | null,
    options?: { closingId?: string | null; startDate?: string | null; endDate?: string | null }
): Promise<MonthClosingRecord | null> {
    try {
        const cleanStart = options?.startDate ? options.startDate.split(/[T ]/)[0] : null;
        const cleanEnd = options?.endDate ? options.endDate.split(/[T ]/)[0] : null;
        const isCustomLookup = Boolean(options?.closingId || (cleanStart && cleanEnd));
        const bankSeg = bankId && bankId !== 'all' ? bankId : 'all';
        const key = isCustomLookup
            ? `${CLOSING_PREFIX}custom_${options?.closingId || `${churchId}_${bankSeg}_${cleanStart}_${cleanEnd}`}`
            : buildKey(churchId, year, month, bankId);

        let record = await get<MonthClosingRecord>(key);

        if (churchId && churchId !== 'geral') {
            // Consulta o backend central para obter o status autoritativo em tempo real
            try {
                const qs = new URLSearchParams();
                if (bankId && bankId !== 'all') qs.set('bank_id', bankId);
                if (options?.closingId) qs.set('closing_id', options.closingId);
                if (cleanStart && cleanEnd) {
                    qs.set('start_date', cleanStart);
                    qs.set('end_date', cleanEnd);
                }
                const queryString = qs.toString() ? `?${qs.toString()}` : '';
                const res = await fetch(`/api/v1/church-closings/${encodeURIComponent(churchId)}/${year}/${month}${queryString}`, {
                    headers: getAuthHeaders()
                });
                if (res.ok) {
                    const backendData = await res.json();
                    if (backendData && backendData.id) {
                        record = mapBackendClosingRow(backendData);
                        await set(key, record);
                        const idx = allClosingsCache.findIndex(c => c.id === record!.id);
                        if (idx >= 0) {
                            allClosingsCache[idx] = { ...record };
                        } else {
                            allClosingsCache.push({ ...record });
                        }
                    }
                } else if (res.status === 404) {
                    record = null;
                    await del(key);
                }
            } catch (_) {}
        }

        // Nunca polui memoryClosedCache (granularidade mensal) com fechamento personalizado parcial
        if (!isCustomLookup) {
            if (!record) {
                const bankPart = bankId && bankId !== 'all' ? `_${bankId}` : '';
                memoryClosedCache.set(`${churchId}${bankPart}_${year}_${month}`, false);
                if (!bankId || bankId === 'all') {
                    memoryClosedCache.set(`${churchId}_${year}_${month}`, false);
                }
            } else if (record.periodType !== 'custom') {
                const bankPart = record.bankId && record.bankId !== 'all' ? `_${record.bankId}` : '';
                const cacheKey = `${churchId}${bankPart}_${year}_${month}`;
                const isClosed = isClosingStatusActive(record.status);
                memoryClosedCache.set(cacheKey, isClosed);
                if (!isClosed && (!record.bankId || record.bankId === 'all')) {
                    memoryClosedCache.set(`${churchId}_${year}_${month}`, false);
                }
            }
        } else if (record && record.periodType !== 'custom') {
            const bankPart = record.bankId && record.bankId !== 'all' ? `_${record.bankId}` : '';
            memoryClosedCache.set(`${churchId}${bankPart}_${record.year}_${record.month}`, isClosingStatusActive(record.status));
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

export interface ReopenClosingResult {
    success: true;
    churchId: string;
    bankId: string | null;
    year: number;
    month: number;
    startDate?: string | null;
    endDate?: string | null;
    reopenedClosingIds?: string[];
    reopenedTransactionsCount?: number;
}

/**
 * Desfaz o fechamento final e reabre o período para novos lançamentos.
 * Backend-first: somente libera memória/IndexedDB e dispara eventos após confirmação real do servidor.
 */
export async function reopenMonthClosingRecord(
    churchId: string, 
    year: number, 
    month: number,
    bankId?: string | null,
    options?: { closingId?: string | null; startDate?: string | null; endDate?: string | null }
): Promise<ReopenClosingResult> {
    const normalizedBankId = bankId && bankId !== 'all' ? bankId : null;

    // 1. Reabertura obrigatória no Backend Central (sem mutação otimista em caso de erro)
    const res = await fetch('/api/v1/church-closings/reopen', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
            churchId,
            year,
            month,
            bankId: normalizedBankId,
            ...(options?.closingId ? { closingId: options.closingId } : {}),
            ...(options?.startDate ? { startDate: options.startDate } : {}),
            ...(options?.endDate ? { endDate: options.endDate } : {})
        })
    });

    if (!res.ok) {
        throw await parseClosingApiError(
            res,
            `Erro HTTP ${res.status} ao reabrir o período contábil no servidor.`
        );
    }

    let backendPayload: any = {};
    try {
        backendPayload = await res.json();
    } catch (_) {}

    // 2. Atualiza cache em memória com precisão usando os IDs efetivamente reabertos pelo backend (AUD-05 + P5-A)
    const reopenedClosingIds: string[] = Array.isArray(backendPayload?.reopenedClosingIds)
        ? backendPayload.reopenedClosingIds.map((id: any) => String(id)).filter(Boolean)
        : [];
    const reopenedIdSet = new Set<string>(reopenedClosingIds);
    const hasCustomRangeOpt = Boolean(options?.startDate && options?.endDate);
    const targetClosingId = options?.closingId || (normalizedBankId
        ? `closing_${churchId}_${normalizedBankId}_${year}_${month}`
        : `closing_${churchId}_${year}_${month}`);

    allClosingsCache = allClosingsCache.map(c => {
        if (reopenedIdSet.size > 0) {
            return reopenedIdSet.has(c.id) ? { ...c, status: 'reopened' as const } : c;
        }
        const matchesExplicitId = Boolean(options?.closingId && c.id === options.closingId);
        const matchesCustomRange = Boolean(
            !options?.closingId &&
            hasCustomRangeOpt &&
            c.churchId === churchId &&
            c.startDate === options?.startDate &&
            c.endDate === options?.endDate &&
            (normalizedBankId ? (c.bankId || null) === normalizedBankId : (!c.bankId || c.bankId === 'all'))
        );
        const matchesMonthlyScope =
            !options?.closingId &&
            !hasCustomRangeOpt &&
            c.churchId === churchId &&
            c.year === year &&
            c.month === month &&
            (normalizedBankId ? (c.bankId || null) === normalizedBankId : (!c.bankId || c.bankId === 'all'));

        if (matchesExplicitId || c.id === targetClosingId || matchesCustomRange || matchesMonthlyScope) {
            return { ...c, status: 'reopened' as const };
        }
        return c;
    });

    rebuildMonthlyCacheFromAllClosings(churchId);

    if (!options?.closingId && !hasCustomRangeOpt) {
        const bankPart = normalizedBankId ? `_${normalizedBankId}` : '';
        memoryClosedCache.set(`${churchId}${bankPart}_${year}_${month}`, false);
    }

    // 3. Atualização no IndexedDB apenas após sucesso no servidor
    try {
        if (!options?.closingId && !hasCustomRangeOpt) {
            const key = buildKey(churchId, year, month, normalizedBankId);
            const existing = await get<MonthClosingRecord>(key);
            if (existing) {
                await set(key, { ...existing, status: 'reopened' });
            } else {
                await del(key);
            }
        }
        const customIdsToRemove = new Set<string>(reopenedClosingIds);
        if (options?.closingId) customIdsToRemove.add(options.closingId);
        for (const cid of customIdsToRemove) {
            await del(`${CLOSING_PREFIX}custom_${cid}`);
        }
        if (hasCustomRangeOpt) {
            const bankSeg = normalizedBankId || 'all';
            await del(`${CLOSING_PREFIX}custom_${churchId}_${bankSeg}_${options?.startDate}_${options?.endDate}`);
        }
    } catch (idbErr) {
        console.warn('[MonthClosingService] Aviso ao atualizar IndexedDB após reabertura:', idbErr);
    }

    const detail = {
        churchId,
        bankId: normalizedBankId,
        year,
        month,
        startDate: backendPayload?.startDate || options?.startDate || null,
        endDate: backendPayload?.endDate || options?.endDate || null,
        reopenedClosingIds,
        reopenedTransactionsCount: Number(backendPayload?.reopenedTransactionsCount || 0),
        status: 'reopened' as const
    };

    // 4. Notificação em tempo real via BroadcastChannel para outras abas no mesmo navegador
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const bc = new BroadcastChannel('identificapix_realtime_sync');
            bc.postMessage({ type: 'MONTH_CLOSING_UPDATED', ...detail });
            bc.close();
        } catch (_) {}
    }

    // 5. Notificação via evento de janela
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('month_closing_updated', {
            detail
        }));
    }

    return {
        success: true,
        churchId,
        bankId: normalizedBankId,
        year,
        month,
        startDate: detail.startDate,
        endDate: detail.endDate,
        reopenedClosingIds,
        reopenedTransactionsCount: detail.reopenedTransactionsCount
    };
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
                allClosingsCache = list.map((item: any) => mapBackendClosingRow(item));
                rebuildMonthlyCacheFromAllClosings(churchId);
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
            const mappedList = list.map((item: any) => mapBackendClosingRow(item));

            if (!churchId || churchId === 'geral') {
                allClosingsCache = mappedList;
            } else {
                const otherChurches = allClosingsCache.filter(c => c.churchId !== churchId);
                allClosingsCache = [...otherChurches, ...mappedList];
            }

            rebuildMonthlyCacheFromAllClosings(churchId);

            for (const mapped of mappedList) {
                const key = mapped.periodType === 'custom' && mapped.id
                    ? `${CLOSING_PREFIX}custom_${mapped.id}`
                    : buildKey(mapped.churchId, mapped.year, mapped.month, mapped.bankId);
                const existing = await get<MonthClosingRecord>(key);
                if (!existing || existing.status !== mapped.status || existing.startDate !== mapped.startDate || existing.endDate !== mapped.endDate) {
                    await set(key, mapped);
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
 * Verifica em allClosingsCache se existe fechamento ativo (mensal ou personalizado) cobrindo a data
 */
function hasActiveClosingInAllCache(
    churchId: string,
    cleanDate: string,
    year: number,
    month: number,
    bankId?: string | null
): boolean {
    const targetBank = bankId && bankId !== 'all' ? bankId : null;
    for (const c of allClosingsCache) {
        if (!isClosingStatusActive(c.status)) continue;
        if (c.churchId !== churchId) continue;

        const closingBank = c.bankId && c.bankId !== 'all' ? c.bankId : null;
        if (closingBank && (!targetBank || closingBank !== targetBank)) {
            continue;
        }

        if (c.periodType === 'custom' && c.startDate && c.endDate) {
            if (cleanDate >= c.startDate && cleanDate <= c.endDate) {
                return true;
            }
        } else if (c.year === year && c.month === month) {
            return true;
        }
    }
    return false;
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
    if (memoryClosedCache.get(consolidatedKey) === true) return true;

    return hasActiveClosingInAllCache(churchId, cleanDate, year, month, bankId);
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

    for (const c of allClosingsCache) {
        if (!isClosingStatusActive(c.status)) continue;
        if (c.periodType === 'custom' && c.startDate && c.endDate) {
            if (cleanDate >= c.startDate && cleanDate <= c.endDate) return true;
        } else if (c.year === year && c.month === month) {
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

    // 1. Checa memória (mensal e personalizado)
    if (isChurchPeriodClosedSync(churchId, cleanDate, bankId)) {
        return true;
    }

    // 2. Checa fechamento individual (incluindo intervalos personalizados e multi-mês)
    if (bankId && bankId !== 'all') {
        const record = await getMonthClosingRecord(churchId, year, month, bankId, { startDate: cleanDate, endDate: cleanDate });
        if (record && isClosingStatusActive(record.status)) {
            if (record.periodType !== 'custom') {
                memoryClosedCache.set(`${churchId}_${bankId}_${year}_${month}`, true);
                return true;
            }
            if (record.startDate && record.endDate && cleanDate >= record.startDate && cleanDate <= record.endDate) {
                return true;
            }
        }
    }

    // 3. Checa fechamento consolidado (incluindo intervalos personalizados e multi-mês)
    const consolidatedKey = `${churchId}_${year}_${month}`;
    const record = await getMonthClosingRecord(churchId, year, month, null, { startDate: cleanDate, endDate: cleanDate });
    if (record && isClosingStatusActive(record.status)) {
        if (record.periodType !== 'custom') {
            memoryClosedCache.set(consolidatedKey, true);
            return true;
        }
        if (record.startDate && record.endDate && cleanDate >= record.startDate && cleanDate <= record.endDate) {
            return true;
        }
    }

    return false;
}

// Inicialização automática de escuta de eventos para manter o cache atualizado
if (typeof window !== 'undefined') {
    window.addEventListener('month_closing_updated', (e: any) => {
        const detail = e.detail;
        if (detail && detail.churchId && detail.year && detail.month) {
            if (detail.periodType === 'custom') return;
            const isClosed = isClosingStatusActive(detail.status);
            const bankPart = detail.bankId && detail.bankId !== 'all' ? `_${detail.bankId}` : '';
            memoryClosedCache.set(`${detail.churchId}${bankPart}_${detail.year}_${detail.month}`, isClosed);
            if (!isClosed) {
                rebuildMonthlyCacheFromAllClosings(detail.churchId);
                memoryClosedCache.set(`${detail.churchId}${bankPart}_${detail.year}_${detail.month}`, false);
            }
        }
    });

    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const bc = new BroadcastChannel('identificapix_realtime_sync');
            bc.onmessage = (event) => {
                if (event.data?.type === 'MONTH_CLOSING_UPDATED') {
                    const { churchId, bankId, year, month, status, periodType } = event.data;
                    if (churchId && year && month && periodType !== 'custom') {
                        const isClosed = isClosingStatusActive(status);
                        const bankPart = bankId && bankId !== 'all' ? `_${bankId}` : '';
                        memoryClosedCache.set(`${churchId}${bankPart}_${year}_${month}`, isClosed);
                    }
                    syncAllChurchClosings().catch(() => {});
                }
            };
        } catch (_) {}
    }

    // Inicia sincronização em segundo plano imediatamente
    syncAllChurchClosings().catch(() => {});
}

