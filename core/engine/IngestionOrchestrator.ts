
import { Transaction, FileModel } from '../../types';
import { Fingerprinter } from '../processors/Fingerprinter';
import { StrategyEngine } from '../strategies';

/**
 * 🎛️ INGESTION ORCHESTRATOR (V19 - ABSOLUTE TRUTH ENFORCEMENT)
 * -------------------------------------------------------
 * Garante a integridade total do arquivo original.
 * O conteúdo é preservado sem NENHUMA alteração prévia ao matching.
 * Proibido trim, toUpperCase ou qualquer limpeza antes do motor de estratégias.
 */
export const IngestionOrchestrator = {
    /**
     * Retorna o conteúdo original preservado. 
     * Implementa a regra de 'Zero Reprocessamento' pré-modelo.
     */
    normalizeRawContent(content: string): string {
        if (!content) return "";
        
        // RIGOR V19: Proibido alterar o input bruto. 
        // O conteúdo deve chegar ao StrategyEngine exatamente como foi lido do arquivo.
        if (content === '[DOCUMENTO_PDF_VISUAL]') {
            console.log(`[PDF:PHASE:3:NORMALIZATION] ${content} -> ${content} (Preservação Literal)`);
        }
        return content;
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
        // Usa o conteúdo TOTALMENTE BRUTO para o fingerprinting
        const fingerprint = Fingerprinter.generate(content);

        if (content === '[DOCUMENTO_PDF_VISUAL]') {
            console.log(`[PDF:PHASE:4:TOPOLOGY] INPUT -> ${JSON.stringify(fingerprint)}`);
        }
        
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
