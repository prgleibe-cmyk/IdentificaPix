
import { Transaction, FileModel } from '../types';
import { StrategyEngine } from '../core/strategies';
import { Fingerprinter } from '../core/processors/Fingerprinter';
import { IngestionOrchestrator } from '../core/engine/IngestionOrchestrator';

export * from './utils/parsingUtils';
export * from './logic/matchingLogic';
export * from './logic/filteringLogic';

export const generateFingerprint = Fingerprinter.generate;

export const findMatchingModel = (content: string, models: FileModel[]): { model: FileModel, score: number } | null => {
    if (!models || models.length === 0) return null;
    const fileFp = Fingerprinter.generate(content);
    if (!fileFp) return null;
    let bestMatch: FileModel | null = null;
    let bestScore = 0;
    
    for (const model of models) {
        if (!model.is_active) continue;
        const modelFp = model.fingerprint;
        let score = 0;
        
        if (modelFp.headerHash && fileFp.headerHash && modelFp.headerHash === fileFp.headerHash) score += 80;
        if (modelFp.structuralPattern && fileFp.structuralPattern && modelFp.structuralPattern === fileFp.structuralPattern) score += 15;
        if (modelFp.columnCount === fileFp.columnCount) score += 5;

        if (score > bestScore && score >= 80) { 
            bestScore = score; 
            bestMatch = model; 
        }
    }
    return bestMatch ? { model: bestMatch, score: bestScore } : null;
};

/**
 * PROCESSADOR DE CONTEÚDO (PIPELINE BLINDADO V5)
 * Se um modelo for identificado, as linhas do modelo são a FONTE ÚNICA da verdade.
 */
export const processFileContent = async (
    content: string, 
    fileName: string, 
    models: FileModel[] = [], 
    globalKeywords: string[] = []
): Promise<{ transactions: Transaction[], method: string, appliedModel?: any }> => {
    
    // 1. Normalização obrigatória
    const normalizedContent = IngestionOrchestrator.normalizeRawContent(content);

    // 2. Identificação Estrutural
    const matchResult = findMatchingModel(normalizedContent, models);
    const targetModel = matchResult?.model;

    // 3. BLINDAGEM DE ORIGEM: MODELO -> PIPELINE -> UI
    if (targetModel) {
        console.log(`[Pipeline:INPUT] Modelo Identificado: ${targetModel.name}. Ignorando pipeline legado.`);
        
        // Força a extração baseada estritamente no contrato do modelo (Content Integral)
        const result = await StrategyEngine.process(
            fileName, 
            normalizedContent, 
            models, 
            globalKeywords,
            targetModel // O override garante que o motor use apenas as regras do modelo
        );

        console.log(`[Pipeline:OUTPUT] Model -> UI | Transações: ${result.transactions.length}`);

        return {
            transactions: result.transactions,
            method: result.strategyName,
            appliedModel: { id: targetModel.id, name: targetModel.name, confidenceScore: 100 }
        };
    }

    // 4. FALLBACK GENÉRICO
    console.log("[Pipeline:INPUT] Iniciando processamento legado (Sem Modelo):", fileName);
    const result = await StrategyEngine.process(
        fileName, 
        normalizedContent, 
        models, 
        globalKeywords
    );
    
    return {
        transactions: result.transactions,
        method: result.strategyName,
        appliedModel: undefined
    };
};

export const parseContributors = (content: string, ignoreKeywords: string[] = [], typeKeywords: string[] = []): any[] => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const delimiter = Fingerprinter.detectDelimiter(lines[0]);
    const rows = lines.map(l => l.split(delimiter));
    
    const contributors = rows.slice(1).map(row => ({
        name: row[0] || 'Desconhecido',
        amount: parseFloat(String(row[1] || '0').replace(',', '.')) || 0,
        date: row[2] || ''
    })).filter(c => c.name !== 'Desconhecido');

    return contributors;
};
