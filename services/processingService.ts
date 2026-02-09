
import { Transaction, FileModel } from '../types';
import { StrategyEngine, StrategyResult } from '../core/strategies';
import { Fingerprinter } from '../core/processors/Fingerprinter';
import { IngestionOrchestrator } from '../core/engine/IngestionOrchestrator';

export * from './utils/parsingUtils';
export * from './logic/matchingLogic';
export * from './logic/filteringLogic';

export const generateFingerprint = Fingerprinter.generate;

/**
 * 🛠️ ADAPTER ESTRUTURAL (V4 - ABSOLUTE TRUTH)
 */
function normalizeIngestionInput(input: any) {
    if (Array.isArray(input)) return input;
    if (typeof input === 'string') {
        return {
            __rawText: input,
            __source: 'file'
        };
    }
    return input;
}

export const findMatchingModel = (content: string, models: FileModel[]): { model: FileModel, score: number } | null => {
    if (!models || models.length === 0) return null;
    const fileFp = Fingerprinter.generate(content);
    if (!fileFp) return null;
    
    // RIGOR ABSOLUTO: O match deve ser baseado no HeaderHash (DNA estrutural).
    const bestMatch = models.find(m => m.is_active && m.fingerprint.headerHash === fileFp.headerHash);
    
    if (content === '[DOCUMENTO_PDF_VISUAL]') {
        console.log(`[PDF:PHASE:5:MATCHER] DNA:${fileFp.headerHash} -> MATCH:${bestMatch?.name || 'NONE'}`);
    }

    return bestMatch ? { model: bestMatch, score: 100 } : null;
};

/**
 * PROCESSADOR DE PIPELINE (V17 - ABSOLUTE TRUTH ENFORCED)
 */
export const processFileContent = async (
    content: string, 
    fileName: string, 
    models: FileModel[] = [], 
    globalKeywords: string[] = [],
    base64?: string 
): Promise<StrategyResult & { appliedModel?: any }> => {
    
    // IngestionOrchestrator V19 agora preserva o conteúdo 100% bruto
    const rawContent = IngestionOrchestrator.normalizeRawContent(content);
    
    const matchResult = findMatchingModel(rawContent, models);
    const targetModel = matchResult?.model;

    // Criamos o input adaptado preservando o Base64 se ele existir
    const adaptedInput = {
        __rawText: rawContent,
        __base64: base64, 
        __source: 'file'
    };

    // O StrategyEngine agora decide se processa ou se pede modelo.
    const result = await StrategyEngine.process(
        fileName, 
        adaptedInput, 
        models, 
        globalKeywords, 
        targetModel
    );

    if (result.status === 'MODEL_REQUIRED') {
        return result;
    }

    const transactions = Array.isArray(result?.transactions) ? result.transactions : [];

    return {
        ...result,
        transactions,
        appliedModel: targetModel ? { id: targetModel.id, name: targetModel.name, confidenceScore: 100 } : undefined
    };
};

export const parseContributors = (content: string, ignoreKeywords: string[] = [], typeKeywords: string[] = []): any[] => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const delimiter = Fingerprinter.detectDelimiter(lines[0]);
    const rows = lines.map(l => l.split(delimiter));
    
    const contributors = rows.slice(1).map(row => ({
        name: row[0] || 'Desconhecido',
        amount: parseFloat(String(row[1] || '0').replace(/[R$\s]/g, '').replace(',', '.')) || 0,
        date: row[2] || ''
    })).filter(c => c.name !== 'Desconhecido');

    return contributors;
};
