
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

// Re-export everything to maintain backward compatibility
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
 * --------------------------------------------------------------------------
 * ESTE ARQUIVO É O GATEKEEPER DO PROCESSAMENTO REAL.
 * 
 * Funções aqui (especialmente `processFileContent`) são usadas pelo usuário final
 * nas telas de Lançar Dados e Conciliação.
 * 
 * - NÃO FAÇA ALTERAÇÕES EXPERIMENTAIS AQUI.
 * - Teste qualquer mudança no Admin/Laboratório antes de trazer para cá.
 * --------------------------------------------------------------------------
 */

/**
 * Lógica de Identificação de Modelos (Modo Observação)
 * Compara o fingerprint do arquivo atual com os modelos salvos.
 * Retorna o modelo e o score de confiança.
 */
export const findMatchingModel = (content: string, models: FileModel[]): { model: FileModel, score: number } | null => {
    if (!models || models.length === 0) return null;
    
    // Gera o DNA do arquivo atual
    const fileFp = generateFingerprint(content);
    if (!fileFp) return null;

    let bestMatch: FileModel | null = null;
    let bestScore = 0;

    for (const model of models) {
        if (!model.is_active || !model.fingerprint) continue;
        
        const modelFp = model.fingerprint;
        let score = 0;

        // --- NIVEL 1: PADRÃO ESTRUTURAL LÓGICO (CDS) - PESO MÁXIMO ---
        // Se a sequência lógica de entidades (ex: "DT-TX-NM") for idêntica,
        // é o mesmo documento funcionalmente, independente se veio de PDF, Imagem ou Excel.
        // Isso resolve o problema de quebras de linha e colunas fantasmas no OCR.
        if (modelFp.structuralPattern && fileFp.structuralPattern && 
            modelFp.structuralPattern !== 'UNKNOWN' &&
            modelFp.structuralPattern === fileFp.structuralPattern) {
            score = 95; // Confiança Altíssima (Estrutura Lógica Idêntica)
        }

        // --- NIVEL 2: ASSINATURA CANÔNICA (Conteúdo Exato) ---
        // Se o conteúdo das primeiras linhas for idêntico (após normalização), é um match perfeito.
        else if (modelFp.canonicalSignature && fileFp.canonicalSignature && 
                 modelFp.canonicalSignature === fileFp.canonicalSignature) {
            score = 90; 
        } 
        
        // --- NIVEL 3: HEURÍSTICAS LEGADAS (Fallback) ---
        else {
            // 1. Filtros Estruturais Básicos
            const colDiff = Math.abs(modelFp.columnCount - fileFp.columnCount);
            if (colDiff > 1) continue; 
            
            score += 20;
            if (colDiff === 0) score += 10;

            // 2. Hash do Cabeçalho Normalizado (High Confidence se houver)
            if (modelFp.headerHash && fileFp.headerHash && modelFp.headerHash === fileFp.headerHash) {
                score += 40;
            }

            // 3. Topologia de Dados Simples (Medium Confidence)
            if (modelFp.dataTopology && fileFp.dataTopology && modelFp.dataTopology === fileFp.dataTopology) {
                score += 20;
            }
        }

        // Critério de escolha: Maior score e acima de um limiar mínimo
        if (score > bestScore && score >= 75) {
            bestScore = score;
            bestMatch = model;
        }
    }

    return bestMatch ? { model: bestMatch, score: bestScore } : null;
};

/**
 * Função PRINCIPAL de processamento.
 * CORE_ESTAVEL - NÃO ALTERAR FLUXO.
 * 
 * Agora aceita modelos aprendidos (FileModel[]) e keywords globais.
 * 
 * NOTA DE ARQUITETURA:
 * Esta função implementa o GATEKEEPER DE GOVERNANÇA.
 * Modelos identificados só são aplicados se estiverem com status 'approved'.
 */
export const processFileContent = (content: string, fileName: string, models: FileModel[] = [], globalKeywords: string[] = []): { transactions: Transaction[], method: string, appliedModel?: any } => {
    
    let targetModel: FileModel | undefined;
    let appliedModelMeta: any = undefined;

    // --- MODO OBSERVAÇÃO & SELEÇÃO DE MODELO ---
    // Tenta identificar se este arquivo corresponde a um modelo conhecido.
    try {
        const matchResult = findMatchingModel(content, models);
        
        if (matchResult) {
            // Log para Observação (Passivo) - Sempre ocorre para fins de auditoria/aprendizado
            console.log(`[Observation Mode] O arquivo "${fileName}" foi identificado como modelo: "${matchResult.model.name}" (Score: ${matchResult.score})`);
            observationService.addLog(fileName, matchResult.model, matchResult.score);

            // REGRA DE APLICAÇÃO ATIVA (Gatekeeper):
            // Só aplica automaticamente se for APROVADO e tiver altíssima confiança.
            if (matchResult.model.status === 'approved' && matchResult.score >= 85) {
                targetModel = matchResult.model;
                console.log(`[Processing] Modelo APROVADO e compatível detectado. Aplicando override: "${targetModel.name}"`);
            } else if (matchResult.model.status !== 'approved') {
                console.log(`[Processing] Modelo compatível encontrado ("${matchResult.model.name}"), mas ignorado pois status é "${matchResult.model.status}". Usando estratégia genérica.`);
            }
        }
    } catch (e) {
        console.warn("[Observation Mode] Erro na verificação passiva de modelos:", e);
    }
    // ----------------------------------

    // Executa o motor, passando o modelo alvo (se houver e tiver passado pelo gatekeeper)
    const result = StrategyEngine.process(fileName, content, models, globalKeywords, targetModel);
    
    // Se o modelo foi efetivamente usado pela estratégia, preenche os metadados de retorno
    // Isso sinaliza para a UI exibir o feedback de sucesso
    if (targetModel && result.strategyName.includes(targetModel.name)) {
        appliedModelMeta = {
            id: targetModel.id,
            name: targetModel.name,
            confidenceScore: 100
        };
    }

    // REGRA DE NEGÓCIO (CORREÇÃO): 
    // Garante que a descrição final da transação seja a versão LIMPA (sem as palavras ignoradas).
    // Se a limpeza resultar em vazio (tudo removido), mantém o original por segurança.
    const transactions = result.transactions.map(t => ({
        ...t,
        description: t.cleanedDescription || t.description
    }));

    return {
        transactions: transactions,
        method: result.strategyName,
        appliedModel: appliedModelMeta
    };
};

// Mantido para compatibilidade
export const parseContributors = (content: string, ignoreKeywords: string[] = [], contributionKeywords: string[] = DEFAULT_CONTRIBUTION_KEYWORDS): Contributor[] => {
    // Combina palavras ignoradas com tipos de contribuição para limpeza profunda (ex: "Dízimo Maria" -> "Maria")
    const allKeywords = [...ignoreKeywords, ...contributionKeywords];
    const result = StrategyEngine.process("contributors.csv", content, [], allKeywords);
    
    return result.transactions.map(t => ({
        // REGRA DE NEGÓCIO (CORREÇÃO): O nome do contribuinte deve ser a versão limpa
        name: t.cleanedDescription || t.description,
        cleanedName: t.cleanedDescription,
        normalizedName: normalizeString(t.description, ignoreKeywords),
        amount: t.amount,
        date: t.date,
        originalAmount: t.originalAmount,
        contributionType: t.contributionType
    }));
};

// Validação de segurança para aplicação de modelos (Stub mantido e exportado)
export const isModelSafeToApply = (content: string, model: FileModel) => ({ safe: true });

// Aplicação forçada de modelo (Stub mantido e exportado)
export const parseWithModel = (content: string, model: FileModel, userKeywords: string[]) => StrategyEngine.process("file", content, [model], userKeywords, model).transactions;

// CORREÇÃO: Passando keywords para o motor e aplicando limpeza no retorno
export const parseBankStatement = (content: string, kw: string[], ck: string[]) => 
    StrategyEngine.process("file", content, [], [...kw, ...ck]).transactions.map(t => ({
        ...t,
        description: t.cleanedDescription || t.description
    }));
