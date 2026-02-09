import { IngestionOrchestrator } from './IngestionOrchestrator';

/**
 * ORCHESTRATOR BRIDGE (V2)
 * Mantido para compatibilidade, mas redireciona 100% das chamadas 
 * para o IngestionOrchestrator blindado.
 */
export class Orchestrator {
  static async processFile(file: File, models: any[] = [], keywords: string[] = []): Promise<any> {
    console.warn("[Orchestrator] Redirecionando chamada legada para IngestionOrchestrator v20.");
    
    // Converte o File em texto bruto para o pipeline moderno
    const content = await file.text();
    
    return IngestionOrchestrator.processFile(file, content, models, keywords);
  }
}