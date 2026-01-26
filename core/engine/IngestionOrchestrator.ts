
import { Transaction, FileModel } from '../../types';
import { Fingerprinter } from '../processors/Fingerprinter';
import { StrategyEngine } from '../strategies';

/**
 * 🎛️ INGESTION ORCHESTRATOR (V17 - PASS-THROUGH)
 * -------------------------------------------------------
 * Mantém a integridade total do arquivo original.
 */
export const IngestionOrchestrator = {
    /**
     * Retorna o conteúdo exatamente como recebido.
     */
    normalizeRawContent(content: string): string {
        return content || "";
    },

    async processVirtualData(
        sourceName: string, 
        transactions: Transaction[], 
        globalKeywords: string[]
    ): Promise<any> {
        return {
            source: 'virtual',
            transactions: transactions || [],
            status: 'SUCCESS',
            fileName: sourceName,
            strategyUsed: 'Virtual Injection'
        };
    },

    async processFile(
        file: File, 
        content: string, 
        models: FileModel[], 
        globalKeywords: string[]
    ): Promise<any> {
        // Usa o conteúdo BRUTO para garantir match de Hash
        const fingerprint = Fingerprinter.generate(content);
        
        console.log(`[Pipeline:INGESTION] Processando arquivo: ${file.name} | DNA: ${fingerprint?.headerHash}`);
        
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
            fingerprint: result.fingerprint || fingerprint || { columnCount: 0 },
            preview: result.preview || content.substring(0, 500),
            strategyUsed: result.strategyName
        };
    }
};
