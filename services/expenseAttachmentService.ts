import { get, set, del, keys } from 'idb-keyval';
import { ExpenseAttachment } from '../types/domain';

const STORAGE_PREFIX = 'idpix_expense_att_';

/**
 * Salva os comprovantes e faturas de uma transação específica no IndexedDB
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
        } else {
            await set(key, attachments);
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
    try {
        const key = `${STORAGE_PREFIX}${txId}`;
        const data = await get<ExpenseAttachment[]>(key);
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error(`[ExpenseAttachmentService] Erro ao carregar anexos para tx ${txId}:`, err);
        return [];
    }
}

/**
 * Remove anexos associados a uma transação
 */
export async function deleteAttachmentsForTransaction(
    txId: string
): Promise<void> {
    if (!txId) return;
    try {
        const key = `${STORAGE_PREFIX}${txId}`;
        await del(key);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('expense_attachments_updated', { detail: { txId } }));
        }
    } catch (err) {
        console.error(`[ExpenseAttachmentService] Erro ao deletar anexos para tx ${txId}:`, err);
    }
}

/**
 * Carrega em memória um mapa de todas as transações que possuem anexos cadastrados
 */
export async function preloadAllAttachmentsMap(): Promise<Map<string, ExpenseAttachment[]>> {
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
    } catch (err) {
        console.error('[ExpenseAttachmentService] Erro ao pré-carregar mapa de anexos:', err);
    }
    return map;
}
