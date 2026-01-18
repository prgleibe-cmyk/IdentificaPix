
import { QueueItem, ExecutionStatus } from './types';
import { getIAState, setQueue } from './state';

export const enqueue = (item: QueueItem) => {
    const { queue } = getIAState();
    setQueue([...queue, item]);
};

export const dequeue = (): QueueItem | undefined => {
    const { queue } = getIAState();
    if (queue.length === 0) return undefined;
    const next = queue[0];
    setQueue(queue.slice(1));
    return next;
};

export const peek = (): (QueueItem & { _tries?: number }) | undefined => {
    const { queue } = getIAState();
    if (queue.length === 0) return undefined;
    
    const item = queue[0] as QueueItem & { _tries?: number };
    
    item._tries = item._tries || 0;

    if (item._tries > 3) {
      item.status = "failed";
      // Remove o item que falhou definitivamente para não travar a fila
      setQueue(queue.slice(1));
      return undefined;
    }

    return item;
};

export const incrementTries = (id: string) => {
    const { queue } = getIAState();
    setQueue(queue.map(item => {
        if (item.id === id) {
            const it = item as any;
            return { ...it, _tries: (it._tries || 0) + 1 };
        }
        return item;
    }));
};

export const getCurrent = (): QueueItem | undefined => {
    const { queue } = getIAState();
    return queue.find(item => item.status === 'processing');
};

/**
 * Retorna o próximo item na fila que ainda não foi processado.
 */
export const getNextItem = (): QueueItem | undefined => {
    const { queue } = getIAState();
    return queue.find(i => i.status === 'pending');
};

/**
 * Loop de execução automática da fila.
 * Percorre todos os itens pendentes e executa a função fornecida para cada um.
 */
export async function processQueue(runItem: (item: QueueItem) => Promise<void>) {
    while (true) {
        const next = getNextItem();
        if (!next) break;
        
        // Verifica se a execução ainda deve continuar (baseado no estado global)
        const { status } = getIAState();
        if (status !== 'running') break;

        await runItem(next);
    }
}

export const hasItems = (): boolean => {
    const { queue } = getIAState();
    return queue.length > 0;
};

export const updateStatus = (id: string, status: ExecutionStatus) => {
    const { queue } = getIAState();
    setQueue(queue.map(item => item.id === id ? { ...item, status } : item));
};

export const markProcessing = (id: string) => {
    updateStatus(id, 'processing');
};

export const markDone = (id: string) => {
    updateStatus(id, 'completed');
};

export const clearQueue = () => {
    setQueue([]);
};
