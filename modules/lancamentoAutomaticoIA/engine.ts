
import { QueueItem } from './types';
import { getIAState, setIAStatus, setIsExecuting, lockExecution, unlockExecution } from './state';
import { markProcessing, markDone, peek } from './queue';
import { iaTrainingService } from "./service";
import { executeStepInPage, sendToExtension } from "./executor";

let isAutoRunning = false;
let listeners: Array<(item: QueueItem) => void> = [];

export function onIAFinish(cb: (item: QueueItem) => void) {
    listeners.push(cb);
}

function emitFinish(item: QueueItem) {
    listeners.forEach(l => l(item));
}

/**
 * Processador principal da fila em modo automático real.
 */
async function processQueueLoop() {
    while (isAutoRunning) {
        const item = peek();
        if (!item) {
            isAutoRunning = false;
            break;
        }

        await processItemReal(item);
        // Intervalo entre itens para estabilidade do navegador
        await new Promise(r => setTimeout(r, 1500));
    }
}

/**
 * Execução Real do Item: Busca memória verificada -> Executa passos -> Marca concluído.
 */
async function processItemReal(item: QueueItem) {
    if (!item || !lockExecution(item)) return;

    try {
        const bankName = item.transactionData.bankName;
        
        // 1. Busca memória de treinamento VERIFICADA para este banco
        const steps = await iaTrainingService.loadTrainingMemory(bankName);

        if (!steps || steps.length === 0) {
            // iaTrainingService já dispara o alerta visual para o usuário
            console.warn(`[IA Engine] Execução cancelada: Sem passos aprendidos para ${bankName}.`);
            isAutoRunning = false;
            item.status = "failed";
            unlockExecution();
            return;
        }

        // 2. Inicia processamento visual
        setIsExecuting(true);
        markProcessing(item.id);
        item.status = "processing";
        if (item.transactionData) {
            item.transactionData.executionStatus = 'executando';
        }

        // 3. Executa cada passo aprendido sequencialmente
        console.log(`[IA Engine] Iniciando sequência de ${steps.length} passos para item ${item.id}`);
        for (const step of steps) {
            if (!isAutoRunning) break;
            await executeStepInPage(step, item);
        }

        // 4. Finalização
        if (isAutoRunning) {
            item.status = "completed";
            if (item.transactionData) {
                item.transactionData.executionStatus = 'confirmado';
            }
            
            markDone(item.id);
            
            // Notifica ponte de automação
            sendToExtension({
                type: "ITEM_DONE",
                payload: { id: item.id, bankName }
            });

            emitFinish(item);
        }

    } catch (e) {
        console.error("[IA Engine] Erro crítico na execução real:", e);
        item.status = "failed";
        if (item.transactionData) item.transactionData.executionStatus = 'aguardando';
    } finally {
        setIsExecuting(false);
        unlockExecution();
    }
}

export function startIADecisionLoop() {
    if (isAutoRunning) return;
    isAutoRunning = true;
    setIAStatus('running');
    processQueueLoop();
}

export function stopIADecisionLoop() {
    isAutoRunning = false;
    setIAStatus('idle');
    setIsExecuting(false);
    unlockExecution();
}
