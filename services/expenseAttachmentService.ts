import { get, set, del, keys } from 'idb-keyval';
import { ExpenseAttachment } from '../types/domain';
import { getAuthToken } from './auth/authAdapter';

const STORAGE_PREFIX = 'idpix_expense_att_';

// 🛡️ MEMÓRIA EM CACHE (SINGLETON): Elimina leituras síncronas/paralelas repetidas no IndexedDB
// e previne travamento da thread principal durante a navegação e montagem do Livro Caixa.
let memoryAttachmentsCache: Map<string, ExpenseAttachment[]> | null = null;
let preloadPromise: Promise<Map<string, ExpenseAttachment[]>> | null = null;

/**
 * Retorna o mapa de anexos em memória instantaneamente se já carregado (0ms latency)
 */
export function getCachedAttachmentsMap(): Map<string, ExpenseAttachment[]> | null {
    return memoryAttachmentsCache;
}

/**
 * 🛡️ Sincroniza metadados de anexos para o mapa de cache leve em memória (Anti-OOM)
 * dataUrl é estritamente omitido da memória RAM global e carregado apenas sob demanda.
 */
export function syncAttachmentsToCache(txId: string, attachments?: ExpenseAttachment[]): void {
    if (!txId) return;
    if (!memoryAttachmentsCache) {
        memoryAttachmentsCache = new Map();
    }
    if (attachments && attachments.length > 0) {
        const metaOnly = attachments.map(att => {
            if (att && att.dataUrl) {
                const { dataUrl, ...rest } = att;
                return { ...rest, txId, hasDataUrl: true };
            }
            return { ...att, txId, hasDataUrl: Boolean((att as any).hasDataUrl || att.dataUrl) };
        });
        memoryAttachmentsCache.set(txId, metaOnly);
    } else if (memoryAttachmentsCache.has(txId)) {
        memoryAttachmentsCache.delete(txId);
    }
}

/**
 * Salva os comprovantes e faturas de uma transação específica no IndexedDB e atualiza o cache,
 * persistindo diretamente na nuvem (VPS PostgreSQL / SQLite) em tempo real.
 */
export async function saveAttachmentsForTransaction(
    txId: string, 
    attachments: ExpenseAttachment[]
): Promise<void> {
    if (!txId) return;
    try {
        const key = `${STORAGE_PREFIX}${txId}`;
        if (!attachments || attachments.length === 0) {
            await del(key);
            if (memoryAttachmentsCache) {
                memoryAttachmentsCache.delete(txId);
            }
        } else {
            await set(key, attachments);
            if (memoryAttachmentsCache) {
                const metaOnly = (attachments || []).map(a => {
                    if (a && a.dataUrl) {
                        const { dataUrl, ...rest } = a;
                        return { ...rest, txId, hasDataUrl: true };
                    }
                    return { ...a, txId, hasDataUrl: Boolean((a as any).hasDataUrl || a.dataUrl) };
                });
                memoryAttachmentsCache.set(txId, metaOnly);
            }
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('expense_attachments_updated', { detail: { txId, attachments } }));
        }

        // 🛡️ Sincronização e Persistência em Nuvem (VPS PostgreSQL / SQLite) em Tempo Real
        const isRealDbTx = Boolean(txId && !txId.startsWith('temp-') && !txId.startsWith('ghost-'));
        if (isRealDbTx) {
            try {
                const token = await getAuthToken() || (typeof window !== 'undefined' ? (localStorage.getItem('iggestor_vps_access_token') || localStorage.getItem('auth_token') || localStorage.getItem('token') || sessionStorage.getItem('auth_token')) : null);
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const response = await fetch(`/api/v1/consolidated_transactions/${txId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        attachments: (attachments && attachments.length > 0) ? attachments : []
                    })
                });
                if (!response.ok) {
                    const errTxt = await response.text().catch(() => '');
                    console.warn(`[ExpenseAttachmentService] Aviso: status ${response.status} ao persistir anexos para tx ${txId}: ${errTxt}`);
                }
            } catch (cloudErr) {
                console.warn(`[ExpenseAttachmentService] Aviso ao persistir anexos na nuvem para tx ${txId}:`, cloudErr);
            }
        }
    } catch (err) {
        console.error(`[ExpenseAttachmentService] Erro ao salvar anexos para tx ${txId}:`, err);
    }
}

/**
 * Recupera os comprovantes e faturas de uma transação específica (com dataUrl sob demanda)
 */
export async function getAttachmentsForTransaction(
    txId: string
): Promise<ExpenseAttachment[]> {
    if (!txId) return [];

    // 1. Tenta recuperar do IndexedDB local
    try {
        const key = `${STORAGE_PREFIX}${txId}`;
        const data = await get<ExpenseAttachment[]>(key);
        if (Array.isArray(data) && data.length > 0 && data.some(a => !!a.dataUrl)) {
            return data;
        }
    } catch (_) {}

    // 2. Se não tem dataUrl local, busca sob demanda da VPS apenas para esta transação
    const isRealDbTx = Boolean(txId && !txId.startsWith('temp-') && !txId.startsWith('ghost-'));
    if (isRealDbTx) {
        try {
            const token = await getAuthToken() || (typeof window !== 'undefined' ? (localStorage.getItem('iggestor_vps_access_token') || localStorage.getItem('auth_token') || localStorage.getItem('token') || sessionStorage.getItem('auth_token')) : null);
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/v1/consolidated_transactions/${txId}/attachments`, { headers });
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list) && list.length > 0) {
                    set(`${STORAGE_PREFIX}${txId}`, list).catch(() => {});
                    return list;
                }
            }
        } catch (err) {
            console.warn(`[ExpenseAttachmentService] Erro ao carregar anexos sob demanda para tx ${txId}:`, err);
        }
    }

    if (memoryAttachmentsCache && memoryAttachmentsCache.has(txId)) {
        return memoryAttachmentsCache.get(txId) || [];
    }

    return [];
}

/**
 * Remove anexos associados a uma transação e atualiza o cache em memória
 */
export async function deleteAttachmentsForTransaction(
    txId: string
): Promise<void> {
    if (!txId) return;
    try {
        const key = `${STORAGE_PREFIX}${txId}`;
        await del(key);
        if (memoryAttachmentsCache) {
            memoryAttachmentsCache.delete(txId);
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('expense_attachments_updated', { detail: { txId } }));
        }

        // 🛡️ Sincronização e Persistência em Nuvem (VPS PostgreSQL / SQLite)
        const isRealDbTx = Boolean(txId && !txId.startsWith('temp-') && !txId.startsWith('ghost-'));
        if (isRealDbTx) {
            try {
                const token = await getAuthToken() || (typeof window !== 'undefined' ? (localStorage.getItem('iggestor_vps_access_token') || localStorage.getItem('auth_token') || localStorage.getItem('token') || sessionStorage.getItem('auth_token')) : null);
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                await fetch(`/api/v1/consolidated_transactions/${txId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        attachments: []
                    })
                });
            } catch (cloudErr) {
                console.warn(`[ExpenseAttachmentService] Aviso ao remover anexos na nuvem para tx ${txId}:`, cloudErr);
            }
        }
    } catch (err) {
        console.error(`[ExpenseAttachmentService] Erro ao deletar anexos para tx ${txId}:`, err);
    }
}

/**
 * Carrega em memória um mapa de metadados leves de todas as transações que possuem anexos cadastrados.
 * 🛡️ Anti-OOM: Os campos pesados dataUrl são omitidos da memória RAM e carregados apenas sob demanda.
 */
export async function preloadAllAttachmentsMap(forceRefresh = false): Promise<Map<string, ExpenseAttachment[]>> {
    if (!forceRefresh && memoryAttachmentsCache !== null) {
        return memoryAttachmentsCache;
    }
    if (preloadPromise) {
        return preloadPromise;
    }

    preloadPromise = (async () => {
        const map = new Map<string, ExpenseAttachment[]>();
        try {
            const allKeys = await keys();
            const attKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(STORAGE_PREFIX)) as string[];
            
            await Promise.all(
                attKeys.map(async (key) => {
                    const txId = key.replace(STORAGE_PREFIX, '');
                    const list = await get<ExpenseAttachment[]>(key);
                    if (Array.isArray(list) && list.length > 0) {
                        const metaOnly = list.map(a => {
                            if (a && a.dataUrl) {
                                const { dataUrl, ...rest } = a;
                                return { ...rest, txId, hasDataUrl: true };
                            }
                            return { ...a, txId, hasDataUrl: Boolean((a as any).hasDataUrl || a.dataUrl) };
                        });
                        map.set(txId, metaOnly);
                    }
                })
            );
            memoryAttachmentsCache = map;
        } catch (err) {
            console.error('[ExpenseAttachmentService] Erro ao pré-carregar mapa de anexos:', err);
        } finally {
            preloadPromise = null;
        }
        return memoryAttachmentsCache || map;
    })();

    return preloadPromise;
}
