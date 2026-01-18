export type IAStatus = 'idle' | 'running' | 'paused' | 'error';
export type ExecutionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueItem {
    id: string;
    bankId: string;
    transactionData: any;
    status: ExecutionStatus;
    attempts: number;
    priority: number;
}

export interface MemoryItem {
    id: string;
    bankId: string;
    pattern: string;
    result: any;
    confidence: number;
    lastUsed: string;
}

export interface EngineResult {
    action: string;
    payload: any;
    confidence: number;
}

export interface IAState {
    status: IAStatus;
    currentBank: string | null;
    queue: QueueItem[];
    memory: MemoryItem[];
}

export type LearnedStep = {
  bankId: string;
  action: "click" | "input";
  selector: string;
  order: number;
};