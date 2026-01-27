
/**
 * ORCHESTRATOR LEGADO (DESATIVADO)
 * Mantido apenas como casca para retrocompatibilidade de tipos se necessário.
 * O sistema atual utiliza IngestionOrchestrator.ts
 */
export class Orchestrator {
  static async processFile(file: File, models: any[] = [], keywords: string[] = []): Promise<any> {
    console.warn("Orchestrator legado chamado. Use IngestionOrchestrator.");
    return { transactions: [], status: 'DEPRECATED' };
  }
}
