import { get, set, del, keys } from 'idb-keyval';
import { ExpenseAttachment } from '../types/domain';

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
 * Salva os comprovantes e faturas de uma transação específica no IndexedDB e atualiza o cache
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
