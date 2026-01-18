import { IAState, IAStatus, QueueItem, MemoryItem } from './types';

let state: IAState & { isExecuting: boolean } = {
    status: 'idle',
    currentBank: null,
    queue: [],
    memory: [],
    isExecuting: false
};

export const executionState = {
  running: false,
  current: null as QueueItem | null,
};

export function lockExecution(item: QueueItem) {
  if (executionState.running) return false;
  executionState.running = true;
  executionState.current = item;
  return true;
}

export function unlockExecution() {
  executionState.running = false;
  executionState.current = null;
}

export const getIAState = () => ({ ...state });

export const setIAStatus = (status: IAStatus) => {
    state.status = status;
};

export const setIsExecuting = (executing: boolean) => {
    state.isExecuting = executing;
};

export const setCurrentBank = (bankId: string | null) => {
    state.currentBank = bankId;
};

export const setQueue = (items: QueueItem[]) => {
    state.queue = items;
};

export const setMemory = (items: MemoryItem[]) => {
    state.memory = items;
};