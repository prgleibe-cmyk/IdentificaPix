import { Transaction, FileModel } from '../../types';
import { Fingerprinter } from '../processors/Fingerprinter';
import { StrategyEngine } from '../strategies';

/**
 * 🎛️ INGESTION ORCHESTRATOR (V18 - PDF PURITY FIXED)
 * -------------------------------------------------------
 * Garante a integridade total do arquivo original.
 * Especialmente crítico para PDFs: impede que o parser local
 * polua o texto antes da IA ou do Modelo aplicarem suas regras.
 */
export const IngestionOrchestrator = {
    /**
     * Retorna o conteúdo purificado. 
     * Se for um marcador de PDF, retorna sem NENHUMA alteração.
     */
    normalizeRawContent(content: string): string {
        if (!content) return "";
        
        // RIGOR V18: Se o conteúdo é o marcador visual de PDF, 
        // abortamos qualquer normalização de string para evitar poluição.
        if (content.includes('[DOCUMENTO_PDF_VISUAL]')) {
            return content;
        }

        // Para outros formatos, apenas garante string básica
        return content.trim();
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