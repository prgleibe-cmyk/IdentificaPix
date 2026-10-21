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
 * 🛡️ Sincroniza anexos vindos da nuvem (PostgreSQL / SQLite) para a memória e cache local
 */
export function syncAttachmentsToCache(txId: string, attachments?: ExpenseAttachment[]): void {
    if (!txId) return;
    if (!memoryAttachmentsCache) {
        memoryAttachmentsCache = new Map();
    }
    const key = `${STORAGE_PREFIX}${txId}`;
    if (attachments && attachments.length > 0) {
        memoryAttachmentsCache.set(txId, attachments);
        set(key, attachments).catch(() => {});
    } else if (memoryAttachmentsCache.has(txId)) {
        memoryAttachmentsCache.delete(txId);
        del(key).catch(() => {});
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
                memoryAttachmentsCache.set(txId, attachments);
            }
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('expense_attachments_updated', { detail: { txId } }));
        }

        // 🛡️ Sincronização e Persistência em Nuvem (VPS PostgreSQL / SQLite) em Tempo Real
        const isRealDbTx = /^[0-9a-fA-F-]{36}$/.test(txId);
        if (isRealDbTx) {
            try {
                const token = await getAuthToken();
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                await fetch(`/api/v1/consolidated_transactions/${txId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        attachments: (attachments && attachments.length > 0) ? attachments : []
                    })
                });
            } catch (cloudErr) {
                console.warn(`[ExpenseAttachmentService] Aviso ao persistir anexos na nuvem para tx ${txId}:`, cloudErr);
            }
        }
    } catch (err) {
        console.error(`[ExpenseAttachmentService] Erro ao salvar anexos para tx ${txId}:`, err);
    }
}

/**
 * Recupera os comprovantes e faturas de uma transação específica
 */
export async function getAttachmentsForTransaction(
    txId: string
): Promise<ExpenseAttachment[]> {
    if (!txId) return [];
    if (memoryAttachmentsCache && memoryAttachmentsCache.has(txId)) {
        return memoryAttachmentsCache.get(txId) || [];
    }
    try {
        const key = `${STORAGE_PREFIX}${txId}`;
        const data = await get<ExpenseAttachment[]>(key);
        const list = Array.isArray(data) ? data : [];
        if (memoryAttachmentsCache && list.length > 0) {
            memoryAttachmentsCache.set(txId, list);
        }
        return list;
    } catch (err) {
        console.error(`[ExpenseAttachmentService] Erro ao carregar anexos para tx ${txId}:`, err);
        return [];
    }
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
        const isRealDbTx = /^[0-9a-fA-F-]{36}$/.test(txId);
        if (isRealDbTx) {
            try {
                const token = await getAuthToken();
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
 * Carrega em memória um mapa de todas as transações que possuem anexos cadastrados.
 * Se já carregado em memória, retorna imediatamente sem re-consultar o IndexedDB.
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
                        map.set(txId, list);
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
