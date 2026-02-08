import { Transaction, FileModel } from '../../types';
import { Fingerprinter } from '../processors/Fingerprinter';
import { StrategyEngine } from '../strategies';

/**
 * 🎛️ INGESTION ORCHESTRATOR (V20 - ZERO PROCESSING ENFORCED)
 * -------------------------------------------------------
 * Rigor Máximo: O arquivo é uma entidade sagrada. 
 * Nenhuma limpeza, trim ou alteração é permitida antes do motor de modelos.
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
     * Somente identifica o DNA e encaminha para o motor de estratégias.
     */
    async processFile(
        file: File, 
        content: string, 
        models: FileModel[], 
        globalKeywords: string[]
    ): Promise<any> {
        const result = await StrategyEngine.process(
            file.name, 
            { __rawText: content, __source: 'file' }, 
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