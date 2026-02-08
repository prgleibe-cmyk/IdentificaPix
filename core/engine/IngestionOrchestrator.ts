import { Transaction, FileModel } from '../../types';
import { StrategyEngine } from '../strategies';

/**
 * 🎛️ INGESTION ORCHESTRATOR (V21 - SAFE PAYLOAD)
 * -------------------------------------------------------
 * Preserva o arquivo como entidade soberana e garante que o contrato receba
 * texto OU binário sem interferência.
 */
export const IngestionOrchestrator = {
    /**
     * Retorna o conteúdo original preservado sem nenhuma modificação.
     */
    normalizeRawContent(content: string): string {
        return content || "";
    },

    /**
     * Injeção direta de dados virtuais (ex: Gmail) sem re-processamento.
     */
    async processVirtualData(
        sourceName: string, 
        transactions: Transaction[]
    ): Promise<any> {
        return {
            source: 'virtual',
            transactions: transactions || [],
            status: 'SUCCESS',
            fileName: sourceName,
            strategyUsed: 'Direct Injection'
        };
    },

    /**
     * Ponto de entrada único para arquivos físicos.
     * Encaminha texto e binário intactos para o motor de estratégias.
     */
    async processFile(
        file: File, 
        content: string, 
        models: FileModel[], 
        globalKeywords: string[],
        base64?: string
    ): Promise<any> {
        const result = await StrategyEngine.process(
            file.name, 
            { 
                __rawText: content || '[BINARY_MODE_ACTIVE]', 
                __base64: base64, 
                __source: 'file' 
            }, 
            models, 
            globalKeywords
        );
        
        return {
            source: 'upload',
            transactions: result.transactions || [],
            status: result.status,
            fileName: result.fileName || file.name,
            strategyUsed: result.strategyName
        };
    }
};
