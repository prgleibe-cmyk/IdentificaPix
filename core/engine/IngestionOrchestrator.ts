import { Transaction, FileModel } from '../../types';
import { Fingerprinter } from '../processors/Fingerprinter';
import { StrategyEngine } from '../strategies';

/**
 * 🎛️ INGESTION ORCHESTRATOR (V20 - SOVEREIGN SHIELD)
 * -------------------------------------------------------
 * Ponto central de decisão de processamento. 
 * Se houver um modelo, o sistema ignora parsers legados e 
 * utiliza apenas o Contrato Aprendido.
 */
export const IngestionOrchestrator = {
    /**
     * Preserva o conteúdo bruto. 
     * Regra de Ouro: Proibido alterar o input antes da aplicação do modelo.
     */
    normalizeRawContent(content: string): string {
        return content || "";
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
     * O FUNIL SOBERANO: 
     * Identifica se o arquivo é "conhecido" (tem modelo).
     * Se sim, envia direto para o ContractExecutor através do StrategyEngine.
     */
    async processFile(
        file: File, 
        content: string, 
        models: FileModel[], 
        globalKeywords: string[]
    ): Promise<any> {
        // 1. Gera DNA do conteúdo totalmente bruto
        const fingerprint = Fingerprinter.generate(content);
        
        // 2. Aciona o motor de estratégias que agora prioriza o bypass de modelos
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