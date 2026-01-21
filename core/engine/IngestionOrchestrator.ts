
import { Transaction, FileModel } from '../../types';
import { Fingerprinter } from '../processors/Fingerprinter';
import { StrategyEngine } from '../strategies';

/**
 * 🎛️ INGESTION ORCHESTRATOR (V10 - BLINDAGEM DE VOLUME TOTAL)
 */
export const IngestionOrchestrator = {
    /**
     * Fonte da Verdade: Normaliza espaços duplos em delimitadores virtuais.
     * Crucial para que arquivos PDF/TXT tenham a mesma grade no treino e na execução.
     */
    normalizeRawContent(content: string): string {
        if (!content) return "";
        
        const lines = content.split(/\r?\n/)
            .map(line => {
                const trimmed = line.trim();
                if (!trimmed) return "";
                
                // Se não tem delimitador mas tem espaços duplos, cria grade virtual
                if (!trimmed.includes(';') && !trimmed.includes('\t') && trimmed.includes('  ')) {
                    return trimmed.replace(/\s{2,}/g, ';');
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
        
        // 1. Normalização OBRIGATÓRIA SEM LIMITES
        const processedContent = isExcel ? content : this.normalizeRawContent(content);
        const lineCount = processedContent.split('\n').length;

        // 2. GERAÇÃO DE DNA sobre o conteúdo integral
        const fingerprint = Fingerprinter.generate(processedContent);
        
        console.log(`[Pipeline:INGESTION] Arquivo: ${file.name} | Linhas Normalizadas: ${lineCount}`);
        
        // 3. ROTEAMENTO PARA O ENGINE (Garante entrega do documento completo)
        const result = await StrategyEngine.process(
            file.name, 
            processedContent, 
            models, 
            globalKeywords
        );
        
        console.log(`[Pipeline:INGESTION] Processamento Concluído | Linhas Entregues ao Modelo: ${lineCount} | Transações Extraídas: ${result.transactions.length}`);

        return {
            source: 'upload',
            transactions: result.transactions,
            strategyUsed: result.strategyName,
            fingerprint: fingerprint || { columnCount: 0 }
        };
    },

    /**
     * Processa dados virtuais (como Gmail) gerando fingerprint e garantindo estrutura de transações.
     */
    async processVirtualData(
        sourceName: string,
        transactions: Transaction[],
        globalKeywords: string[]
    ): Promise<any> {
        // Gera um conteúdo sintético para o Fingerprinter reconhecer o DNA
        const virtualContent = transactions.slice(0, 10).map(t => 
            `${t.date};${t.description};${t.amount}`
        ).join('\n');

        const fingerprint = Fingerprinter.generate(virtualContent);

        return {
            source: 'virtual',
            transactions: transactions,
            strategyUsed: `Virtual:${sourceName}`,
            fingerprint: fingerprint || { columnCount: 3 }
        };
    }
};
