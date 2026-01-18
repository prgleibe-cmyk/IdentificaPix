
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
        await new Promise(r => setTimeout(r, 1000));
    }
}

/**
 * Execução Real do Item: Busca memória -> Executa passos -> Marca concluído.
 */
async function processItemReal(item: QueueItem) {
    if (!item || !lockExecution(item)) return;

    try {
        const bankName = item.transactionData.bankName;
        
        // 1. Busca memória de treinamento para este banco via serviço persistente
        const steps = await iaTrainingService.loadTrainingMemory(bankName);

        if (!steps || steps.length === 0) {
            console.warn(`[IA Engine] Sem memória de treino para ${bankName}.`);
            alert(`Não há memória de treinamento para o banco "${bankName}". Por favor, utilize o Modo Assistido pelo menos uma vez para ensinar o caminho à IA.`);
            
            isAutoRunning = false; // Interrompe a fila automática por segurança
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
        console.log(`[IA Engine] Executando ${steps.length} passos para ${item.id} no banco ${bankName}`);
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
        console.error("[IA Engine] Erro na execução real:", e);
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
