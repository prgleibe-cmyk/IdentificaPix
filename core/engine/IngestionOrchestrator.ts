
import { Transaction, FileModel } from '../../types';
import { Fingerprinter } from '../processors/Fingerprinter';
import { StrategyEngine } from '../strategies';

/**
 * 🎛️ INGESTION ORCHESTRATOR (V14 - NORMALIZAÇÃO ESTRUTURAL FIEL)
 * -------------------------------------------------------
 * Mantém a integridade das linhas mesmo em arquivos com delimitadores puros.
 */
export const IngestionOrchestrator = {
    /**
     * Normalização: Remove espaços em branco nas pontas e filtra apenas linhas 100% vazias.
     * Preserva linhas que possuem delimitadores (ex: ";;;") para não quebrar o mapeamento.
     */
    normalizeRawContent(content: string): string {
        if (!content) return "";
        
        return content
            .split(/\r?\n/)
            .map(line => line.trimEnd())
            // Filtra apenas se a linha estiver vazia após o trim (não remove ";;;")
            .filter(l => l.trim().length > 0)
            .join('\n');
    },

    async processFile(
        file: File, 
        content: string, 
        models: FileModel[], 
        globalKeywords: string[]
    ): Promise<any> {
        const fileNameLower = file.name.toLowerCase();
        
        // NORMALIZAÇÃO FIEL
        const processedContent = this.normalizeRawContent(content);
        const fingerprint = Fingerprinter.generate(processedContent);
        
        console.log(`[Pipeline:INGESTION] Processando: ${file.name} | Amostra Normalizada: ${processedContent.substring(0, 30)}`);
        
        const result = await StrategyEngine.process(
            file.name, 
            { __rawText: processedContent, __source: 'file' }, 
            models, 
            globalKeywords
        );
        
        return {
            source: 'upload',
            transactions: result.transactions || [],
            status: result.status,
            fileName: result.fileName || file.name,
            fingerprint: result.fingerprint || fingerprint || { columnCount: 0 },
            preview: result.preview || processedContent.substring(0, 500),
            strategyUsed: result.strategyName
        };
    },

    async processVirtualData(
        sourceName: string,
        transactions: Transaction[],
        globalKeywords: string[]
    ): Promise<any> {
        return {
            source: 'virtual',
            transactions: transactions,
            strategyUsed: `Virtual:${sourceName}`,
            fingerprint: { columnCount: 3 }
        };
    }
};
