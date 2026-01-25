import { Transaction, FileModel } from '../../types';
import { Fingerprinter } from '../processors/Fingerprinter';
import { StrategyEngine } from '../strategies';

/**
 * 🎛️ INGESTION ORCHESTRATOR (V12 - PRESERVAÇÃO INTEGRAL)
 * -------------------------------------------------------
 * Para garantir 100% de fidelidade em modelos multi-linha (Sicoob/Inter),
 * NÃO podemos inserir delimitadores artificiais (;) que quebrem a estrutura visual.
 */
export const IngestionOrchestrator = {
    /**
     * Normalização: Apenas limpa espaços vazios e garante quebras de linha padrão.
     * Mantém o layout visual para a IA.
     */
    normalizeRawContent(content: string): string {
        if (!content) return "";
        
        // Se já é CSV (tem ponto e vírgula), mantemos.
        if (content.includes(';')) return content;

        // Se é texto puro de PDF/TXT, mantemos o layout visual.
        // A IA é mais inteligente que um split('  ') para achar o nome em blocos.
        return content
            .split(/\r?\n/)
            .map(line => line.trimEnd())
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
        const isExcel = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls');
        
        // NORMALIZAÇÃO: Preserva o layout visual original
        const processedContent = isExcel ? content : this.normalizeRawContent(content);
        
        const fingerprint = Fingerprinter.generate(processedContent);
        
        console.log(`[Pipeline:INGESTION] Processando: ${file.name} | Modo: ${isExcel ? 'Excel' : 'Layout Visual'}`);
        
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