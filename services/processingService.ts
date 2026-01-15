
import { Transaction, Contributor, MatchResult, Church, FileModel } from '../types';
import { StrategyEngine } from '../core/strategies';
import { detectDelimiter, generateFingerprint } from '../core/processors/Fingerprinter';
import { observationService } from './observationService';
import { 
    PLACEHOLDER_CHURCH, 
    DEFAULT_CONTRIBUTION_KEYWORDS, 
    extractSnippet, 
    normalizeString, 
    parseDate, 
    cleanTransactionDescriptionForDisplay, 
    formatIncomeDescription, 
    formatExpenseDescription 
} from './utils/parsingUtils';
import { 
    calculateNameSimilarity, 
    matchTransactions, 
    groupResultsByChurch 
} from './logic/matchingLogic';
import { 
    filterTransactionByUniversalQuery, 
    filterByUniversalQuery 
} from './logic/filteringLogic';

export { 
    detectDelimiter, 
    generateFingerprint,
    PLACEHOLDER_CHURCH, 
    DEFAULT_CONTRIBUTION_KEYWORDS, 
    extractSnippet, 
    normalizeString, 
    parseDate, 
    cleanTransactionDescriptionForDisplay, 
    formatIncomeDescription, 
    formatExpenseDescription,
    calculateNameSimilarity,
    matchTransactions,
    groupResultsByChurch,
    filterTransactionByUniversalQuery,
    filterByUniversalQuery
};

/**
 * 🛡️ CORE_ESTAVEL - PIPELINE DE PRODUÇÃO
 */

export const findMatchingModel = (content: string, models: FileModel[]): { model: FileModel, score: number } | null => {
    if (!models || models.length === 0) return null;
    
    const fileFp = generateFingerprint(content);
    if (!fileFp) return null;

    let bestMatch: FileModel | null = null;
    let bestScore = 0;

    for (const model of models) {
        if (!model.is_active || !model.fingerprint) continue;
        
        const modelFp = model.fingerprint;
        let score = 0;

        if (modelFp.structuralPattern && fileFp.structuralPattern && 
            modelFp.structuralPattern !== 'UNKNOWN' &&
            modelFp.structuralPattern === fileFp.structuralPattern) {
            score = 95; 
        }
        else if (modelFp.canonicalSignature && fileFp.canonicalSignature && 
                 modelFp.canonicalSignature === fileFp.canonicalSignature) {
            score = 90; 
        } 
        else {
            const colDiff = Math.abs(modelFp.columnCount - fileFp.columnCount);
            if (colDiff > 1) continue; 
            
            score += 20;
            if (colDiff === 0) score += 10;

            if (modelFp.headerHash && fileFp.headerHash && modelFp.headerHash === fileFp.headerHash) {
                score += 40;
            }

            if (modelFp.dataTopology && fileFp.dataTopology && modelFp.dataTopology === fileFp.dataTopology) {
                score += 20;
            }
        }

        if (score > bestScore && score >= 75) {
            bestScore = score;
            bestMatch = model;
        }
    }

    return bestMatch ? { model: bestMatch, score: bestScore } : null;
};

/**
 * Função PRINCIPAL de processamento.
 * ATUALIZAÇÃO FASE DE FIDELIDADE: Nenhuma alteração interna na descrição.
 * A StrategyEngine já entrega { rawDescription, description, cleanedDescription } corretamente populados.
 */
export const processFileContent = (content: string, fileName: string, models: FileModel[] = [], globalKeywords: string[] = []): { transactions: Transaction[], method: string, appliedModel?: any } => {
    
    let targetModel: FileModel | undefined;
    let appliedModelMeta: any = undefined;

    try {
        const matchResult = findMatchingModel(content, models);
        
        if (matchResult) {
            console.log(`[Observation Mode] O arquivo "${fileName}" foi identificado como modelo: "${matchResult.model.name}" (Score: ${matchResult.score})`);
            observationService.addLog(fileName, matchResult.model, matchResult.score);

            if (matchResult.model.status === 'approved' && matchResult.score >= 85) {
                targetModel = matchResult.model;
            }
        }
    } catch (e) {
        console.warn("[Observation Mode] Erro na verificação passiva de modelos:", e);
    }

    const result = StrategyEngine.process(fileName, content, models, globalKeywords, targetModel);
    
    if (targetModel && result.strategyName.includes(targetModel.name)) {
        appliedModelMeta = {
            id: targetModel.id,
            name: targetModel.name,
            confidenceScore: 100
        };
    }

    // FIDELIDADE TOTAL:
    // Não fazemos map para sobrescrever 'description' com 'cleanedDescription'.
    // Mantemos os objetos exatamente como saíram do motor de estratégia.
    // Isso garante que a UI mostre o que foi lido do arquivo, a menos que a própria estratégia tenha decidido limpar.
    
    return {
        transactions: result.transactions,
        method: result.strategyName,
        appliedModel: appliedModelMeta
    };
};

export const parseContributors = (content: string, ignoreKeywords: string[] = [], contributionKeywords: string[] = DEFAULT_CONTRIBUTION_KEYWORDS): Contributor[] => {
    const allKeywords = [...ignoreKeywords, ...contributionKeywords];
    const result = StrategyEngine.process("contributors.csv", content, [], allKeywords);
    
    return result.transactions.map(t => ({
        name: t.cleanedDescription || t.description,
        cleanedName: t.cleanedDescription,
        normalizedName: normalizeString(t.description, ignoreKeywords),
        amount: t.amount,
        date: t.date,
        originalAmount: t.originalAmount,
        contributionType: t.contributionType
    }));
};

export const isModelSafeToApply = (content: string, model: FileModel) => ({ safe: true });

export const parseWithModel = (content: string, model: FileModel, userKeywords: string[]) => StrategyEngine.process("file", content, [model], userKeywords, model).transactions;

export const parseBankStatement = (content: string, kw: string[], ck: string[]) => 
    StrategyEngine.process("file", content, [], [...kw, ...ck]).transactions;
