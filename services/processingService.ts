import { Transaction, FileModel } from '../types';
import { StrategyEngine, StrategyResult } from '../core/strategies';
import { Fingerprinter } from '../core/processors/Fingerprinter';

export * from './utils/parsingUtils';
export * from './logic/matchingLogic';
export * from './logic/filteringLogic';

export const generateFingerprint = Fingerprinter.generate;

export const findMatchingModel = (content: string, models: FileModel[]): { model: FileModel, score: number } | null => {
    if (!models || models.length === 0) return null;
    if (!content) return null;

    const fileFp = Fingerprinter.generate(content);
    if (!fileFp) return null;
    
    const bestMatch = models.find(m => m.is_active && m.fingerprint?.headerHash === fileFp.headerHash);
    return bestMatch ? { model: bestMatch, score: 100 } : null;
};

/**
 * PIPELINE DE LANÇAMENTO (V21 - DIRECT MODEL PASS-THROUGH)
 * --------------------------------------------------------
 * Fluxo Obrigatório: Arquivo -> Modelo Aprendido -> Lista Viva.
 * Proibido: Interpretadores paralelos, parsers locais ou OCR genérico.
 */
export const processFileContent = async (
    content: string, 
    fileName: string, 
    models: FileModel[] = [], 
    globalKeywords: string[] = [],
    base64?: string 
): Promise<StrategyResult & { appliedModel?: any }> => {
    
    // O conteúdo é passado exatamente como recebido do FileUploader
    const adaptedInput = {
        __rawText: content, // Geralmente '[BINARY_MODE_ACTIVE]' no fluxo de lançamento
        __base64: base64, 
        __source: 'file'
    };

    // O StrategyEngine agora é a única autoridade que decide o destino do dado
    const result = await StrategyEngine.process(
        fileName, 
        adaptedInput, 
        models, 
        globalKeywords
    );

    return {
        ...result,
        transactions: Array.isArray(result?.transactions) ? result.transactions : [],
        appliedModel: result.strategyName?.includes('Contrato')
            ? { name: result.strategyName }
            : undefined
    };
};

export const parseContributors = (content: string, _ignoreKeywords: string[] = [], _typeKeywords: string[] = []): any[] => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes(';') ? ';' : (lines[0].includes('\t') ? '\t' : ',');
    const rows = lines.map(l => l.split(delimiter));
    
    return rows.slice(1).map(row => ({
        name: String(row[0] || '').trim(),
        amount: parseFloat(String(row[1] || '0').replace(/[R$\s]/g, '').replace(',', '.')) || 0,
        date: String(row[2] || '').trim()
    })).filter(c => c.name && c.name !== 'Desconhecido');
};