
import { Transaction, FileModel } from '../types';
import { StrategyEngine, StrategyResult } from '../core/strategies';
import { Fingerprinter } from '../core/processors/Fingerprinter';
import { IngestionOrchestrator } from '../core/engine/IngestionOrchestrator';

export * from './utils/parsingUtils';
export * from './logic/matchingLogic';
export * from './logic/filteringLogic';

export const generateFingerprint = Fingerprinter.generate;

/**
 * 🛠️ ADAPTER ESTRUTURAL (V2)
 */
function normalizeIngestionInput(input: any) {
    if (Array.isArray(input)) return input;
    if (typeof input === 'string') {
        return {
            __rawText: input,
            __source: 'file' // Força identificação como arquivo para ativar bloqueios do motor
        };
    }
    return input;
}

export const findMatchingModel = (content: string, models: FileModel[]): { model: FileModel, score: number } | null => {
    if (!models || models.length === 0) return null;
    const fileFp = Fingerprinter.generate(content);
    if (!fileFp) return null;
    
    // RIGOR ABSOLUTO: O match deve ser baseado no HeaderHash (DNA estrutural).
    // Não permitimos mais "score aproximado" para evitar que um banco use o modelo de outro.
    const bestMatch = models.find(m => m.is_active && m.fingerprint.headerHash === fileFp.headerHash);
    
    return bestMatch ? { model: bestMatch, score: 100 } : null;
};

/**
 * PROCESSADOR DE PIPELINE (V14 - SEGURANÇA E FIDELIDADE)
 */
export const processFileContent = async (
    content: string, 
    fileName: string, 
    models: FileModel[] = [], 
    globalKeywords: string[] = []
): Promise<StrategyResult & { appliedModel?: any }> => {
    
    const normalizedContent = IngestionOrchestrator.normalizeRawContent(content);
    const matchResult = findMatchingModel(normalizedContent, models);
    const targetModel = matchResult?.model;

    const adaptedInput = normalizeIngestionInput(normalizedContent);

    // O StrategyEngine agora decide se processa ou se pede modelo.
    const result = await StrategyEngine.process(
        fileName, 
        adaptedInput, 
        models, 
        targetModel ? [] : globalKeywords,
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
