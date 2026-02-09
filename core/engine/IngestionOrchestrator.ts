import { Transaction, FileModel } from '../../types';
import { Fingerprinter } from '../processors/Fingerprinter';
import { StrategyEngine } from '../strategies';

/**
 * 🎛️ INGESTION ORCHESTRATOR (V21 - ABSOLUTE RAW PIPELINE)
 * -------------------------------------------------------
 * Ponto soberano de entrada.
 * Quando há modelo aprendido, o conteúdo é tratado como
 * entidade sagrada: sem adapters, sem parsers, sem normalização.
 */
export const IngestionOrchestrator = {
    /**
     * Regra de Ouro:
     * Nunca alterar o conteúdo antes do contrato.
     */
    normalizeRawContent(content: string): string {
        return content ?? "";
    },

    async processVirtualData(
        sourceName: string,
        transactions: Transaction[],
        _globalKeywords: string[]
    ): Promise<any> {
        return {
            source: 'virtual',
            transactions: transactions || [],
            status: 'SUCCESS',
            fileName: sourceName,
            strategyUsed: 'Virtual Injection'
        };
    },

    /**
     * FUNIL SOBERANO
     * O arquivo entra bruto e sai apenas pelo contrato aprendido.
     */
    async processFile(
        file: File,
        content: string,
        models: FileModel[],
        globalKeywords: string[]
    ): Promise<any> {
        // DNA sempre do conteúdo original
        const fingerprint = Fingerprinter.generate(content);

        // Payload absolutamente cru
        const adaptedInput = {
            __rawText: content,
            __base64: (file as any)?.base64,
            __source: 'file',
            __sovereign: true,       // <- BLINDAGEM
            __bypassAdapters: true, // <- BLINDAGEM
            __bypassParsers: true   // <- BLINDAGEM
        };

        const result = await StrategyEngine.process(
            file.name,
            adaptedInput,
            models,
            globalKeywords
        );

        return {
            source: 'upload',
            transactions: Array.isArray(result?.transactions) ? result.transactions : [],
            status: result.status,
            fileName: result.fileName || file.name,
            fingerprint: result.fingerprint || fingerprint || { columnCount: 0 },
            preview: result.preview || content.substring(0, 500),
            strategyUsed: result.strategyName
        };
    }
};
