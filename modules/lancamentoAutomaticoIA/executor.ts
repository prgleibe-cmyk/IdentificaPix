
import { EngineResult, QueueItem } from './types';

/**
 * Executa um passo específico da memória (clique ou input) na página externa.
 */
export async function executeStepInPage(step: any, item: QueueItem) {
  // Traduz o passo para comando da extensão
  // Se for input, substitui o valor capturado no treino pelo valor real da transação
  const payload = {
    actionType: step.type,
    selector: step.selector,
    value: step.type === 'input' ? resolveValueForInput(step, item) : null,
    itemId: item.id
  };

  sendToExtension({
    type: "EXECUTE_DOM_ACTION",
    payload
  });

  // Aguarda um pequeno delay para o DOM processar a ação
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Resolve qual valor deve ser inserido no campo baseado no que foi aprendido.
 */
function resolveValueForInput(step: any, item: QueueItem): string {
    const text = (step.value || '').toLowerCase();
    const data = item.transactionData;

    // Heurística simples: se o valor aprendido era um número, provavelmente quer o valor da transação
    if (!isNaN(parseFloat(text)) && text.length > 0) {
        return String(data.valor);
    }
    
    // Se o valor aprendido era o nome de uma igreja, usa a igreja sugerida atual
    return data.igrejaSugerida || text;
}

/**
 * Função central de execução do lançamento (Fluxo de Memória).
 */
export async function runExecution(item: QueueItem, memory: any) {
  sendToExtension({
    type: "EXECUTE_STEP",
    payload: {
      action: item.transactionData.igrejaSugerida,
      data: item.transactionData,
      memoryUsed: memory ? { id: memory.id, confidence: memory.confidence } : null
    }
  });

  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    status: "executed",
    item,
    executedAt: new Date().toISOString()
  };
}

export function sendToExtension(command: any) {
  console.debug("[IA -> EXT]", command);
  window.postMessage(
    {
      source: "IdentificaPixIA",
      payload: command
    },
    "*"
  );
}
