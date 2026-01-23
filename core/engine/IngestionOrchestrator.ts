
import { Transaction, FileModel } from '../../types';
import { Fingerprinter } from '../processors/Fingerprinter';
import { StrategyEngine } from '../strategies';

/**
 * 🎛️ INGESTION ORCHESTRATOR (V11 - NORMALIZAÇÃO HÍBRIDA)
 */
export const IngestionOrchestrator = {
    /**
     * Normalização linha a linha: Essencial para extratos PDF onde o texto 
     * extraído não possui delimitadores nativos, apenas espaços.
     */
    normalizeRawContent(content: string): string {
        if (!content) return "";
        
        const lines = content.split(/\r?\n/)
            .map(line => {
                const trimmed = line.trim();
                if (!trimmed) return "";
                
                // Se a linha tem múltiplos espaços e NÃO tem ponto-e-vírgula/tab,
                // transformamos em CSV virtual. Isso resolve o problema de leitura do Sicoob.
                if (trimmed.includes('  ') && !trimmed.includes(';') && !trimmed.includes('\t')) {
                    return trimmed.replace(/\s{2,}/g, ';');
                }
                
                // Se a linha já tem delimitador mas ainda tem espaços duplos residuais, 
                // limpamos para evitar colunas vazias fantasmas.
                if (trimmed.includes(';')) {
                    return trimmed.split(';').map(cell => cell.trim()).join(';');
                }

                return trimmed;
            })
            .filter(l => l.length > 0);

        return lines.join('\n');
    },

    async processFile(
        file: File, 
        content: string, 
        models: FileModel[], 
        globalKeywords: string[]
    ): Promise<any> {
        const fileNameLower = file.name.toLowerCase();
        const isExcel = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls');
        
        // Normalização agressiva para garantir que o conteúdo seja tabular
        const processedContent = isExcel ? content : this.normalizeRawContent(content);
        const lineCount = processedContent.split('\n').length;

        const fingerprint = Fingerprinter.generate(processedContent);
        
        console.log(`[Pipeline:INGESTION] Processando: ${file.name} | Linhas: ${lineCount}`);
        
        const result = await StrategyEngine.process(
            file.name, 
            { __rawText: processedContent, __source: 'file' }, 
            models, 
            globalKeywords
        );
        
        console.log(`[Pipeline:INGESTION] Extração concluída: ${result.transactions.length} itens encontrados.`);

        return {
            source: 'upload',
            transactions: result.transactions,
            status: result.status,
            fileName: result.fileName,
            fingerprint: result.fingerprint || fingerprint || { columnCount: 0 },
            preview: result.preview,
            strategyUsed: result.strategyName
        };
    },

    async processVirtualData(
        sourceName: string,
        transactions: Transaction[],
        globalKeywords: string[]
    ): Promise<any> {
        const virtualContent = transactions.slice(0, 10).map(t => 
            `${t.date};${t.description};${t.amount}`
        ).join('\n');

        const fingerprint = Fingerprinter.generate(virtualContent);

        const result = await StrategyEngine.process(
            sourceName,
            { __rawText: virtualContent, __source: 'virtual' },
            [],
            globalKeywords
        );

        return {
            source: 'virtual',
            transactions: transactions,
            strategyUsed: `Virtual:${sourceName}`,
            fingerprint: fingerprint || { columnCount: 3 }
        };
    }
};
