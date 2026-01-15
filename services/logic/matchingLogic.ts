
import { Contributor, MatchResult, Church, Transaction } from '../../types';
import { normalizeString, parseDate, PLACEHOLDER_CHURCH, cleanTransactionDescriptionForDisplay } from '../utils/parsingUtils';

/**
 * LÓGICA DE ASSOCIAÇÃO (MATCHING) - V2 (Fonte de Verdade Isolada)
 * 
 * Esta função é PURE FUNCTION. Ela não altera os inputs.
 * Ela cruza Transações x Contribuintes e gera uma lista plana de Resultados.
 */

export const calculateNameSimilarity = (description: string, contributor: Contributor, ignoreKeywords: string[] = []): number => {
    const txNorm = normalizeString(description, ignoreKeywords);
    const contribNorm = contributor.normalizedName || normalizeString(contributor.name, ignoreKeywords);
    
    if (!txNorm || !contribNorm) return 0;

    const txTokens = txNorm.split(/\s+/).filter(t => t.length > 0);
    const contribTokens = contribNorm.split(/\s+/).filter(t => t.length > 0);
    
    if (txTokens.length === 0 || contribTokens.length === 0) return 0;
    
    // Set Intersection para similaridade básica de tokens
    const txSet = new Set(txTokens);
    const contribSet = new Set(contribTokens);
    const intersection = [...txSet].filter(w => contribSet.has(w)).length;
    
    return (2 * intersection) / (txSet.size + contribSet.size) * 100;
};

export const matchTransactions = (
    transactions: Transaction[],
    contributorFiles: any[],
    options: { similarityThreshold: number; dayTolerance: number; },
    learnedAssociations: any[],
    churches: Church[],
    customIgnoreKeywords: string[] = []
): MatchResult[] => {
    // 1. Preparação: Flatten contributors com ID único interno para rastreamento
    const allContributors = contributorFiles.flatMap((file: any) => 
        file.contributors.map((c: any, idx: number) => ({ 
            ...c, 
            church: file.church,
            // ID Interno determinístico: Igreja + Nome + Valor (Evita duplicar fantasmas em reprocessamentos)
            // Se o contributor já tiver ID (do banco), usa. Senão gera hash.
            _internalId: c.id || `contrib-${file.church.id}-${normalizeString(c.name).replace(/\s/g, '')}-${c.amount}`
        }))
    );
    
    const finalResults: MatchResult[] = [];
    const usedContributors = new Set<string>(); // Rastreia quais contribuintes da lista foram "consumidos"

    // 2. Processamento de Transações Reais (Do Extrato)
    transactions.forEach(tx => {
        // Objeto base do resultado. A transação original NUNCA é mutada aqui.
        let matchResult: MatchResult = {
            transaction: tx,
            contributor: null,
            status: 'NÃO IDENTIFICADO',
            church: PLACEHOLDER_CHURCH,
            matchMethod: undefined,
            similarity: 0,
            contributionType: tx.contributionType
        };

        const txDescNormalized = normalizeString(tx.description, customIgnoreKeywords);
        
        // A. Tentativa: Associação Aprendida (Memória)
        const learned = learnedAssociations.find((la: any) => la.normalizedDescription === txDescNormalized);
        if (learned) {
            const matchedContrib = allContributors.find((c: any) => 
                (normalizeString(c.name, customIgnoreKeywords) === learned.contributorNormalizedName) && 
                (c.church.id === learned.churchId)
            );

            // Validação de Data para aprendizado também
            let isDateValid = true;
            if (matchedContrib && options.dayTolerance !== undefined && matchedContrib.date && tx.date) {
                const tDate = parseDate(tx.date);
                const cDate = parseDate(matchedContrib.date);
                if (tDate && cDate) {
                    const diffDays = Math.ceil(Math.abs(tDate.getTime() - cDate.getTime()) / (1000 * 3600 * 24));
                    if (diffDays > options.dayTolerance) isDateValid = false;
                }
            }

            if (matchedContrib && isDateValid) {
                usedContributors.add(matchedContrib._internalId);
                matchResult = {
                    ...matchResult,
                    status: 'IDENTIFICADO',
                    contributor: matchedContrib,
                    church: matchedContrib.church,
                    matchMethod: 'LEARNED',
                    similarity: 100,
                    contributorAmount: matchedContrib.amount,
                    contributionType: matchedContrib.contributionType || tx.contributionType
                };
                finalResults.push(matchResult);
                return; // Próxima transação
            }
        }

        // B. Tentativa: Algoritmo de Similaridade
        let bestMatch: any = null;
        let highestScore = 0;

        allContributors.forEach((contrib: any) => {
            // Se já foi usado, pula (revisar essa regra se permitir múltiplos matches)
            // Por enquanto, assumimos 1:1 para simplificar, mas a UI permite edição.
            // if (usedContributors.has(contrib._internalId)) return; 

            // Filtro de Data (Tolerance)
            if (options.dayTolerance !== undefined && contrib.date && tx.date) {
                const tDate = parseDate(tx.date);
                const cDate = parseDate(contrib.date);
                if (tDate && cDate) {
                    const diffDays = Math.ceil(Math.abs(tDate.getTime() - cDate.getTime()) / (1000 * 3600 * 24));
                    if (diffDays > options.dayTolerance) return;
                }
            }

            const score = calculateNameSimilarity(tx.description, contrib, customIgnoreKeywords);
            
            if (score > highestScore) {
                highestScore = score;
                bestMatch = contrib;
            }
        });

        if (bestMatch && highestScore >= options.similarityThreshold) {
            usedContributors.add(bestMatch._internalId);
            matchResult = {
                ...matchResult,
                status: 'IDENTIFICADO',
                contributor: bestMatch,
                church: bestMatch.church,
                matchMethod: 'AUTOMATIC',
                similarity: highestScore,
                contributorAmount: bestMatch.amount,
                contributionType: bestMatch.contributionType || tx.contributionType
            };
        } else {
            // Se não bateu o threshold, mas tem algum score, guarda como sugestão
            if (highestScore > 40 && bestMatch) {
                matchResult.suggestion = bestMatch;
                matchResult.similarity = highestScore;
            }
        }

        finalResults.push(matchResult);
    });

    // 3. Processamento de Fantasmas (Itens da Lista que sobraram)
    // Eles geram "Transações Virtuais" para aparecer no relatório de pendências
    allContributors.forEach((contrib: any) => {
        if (!usedContributors.has(contrib._internalId)) {
            
            // FIX: Aplicar limpeza dinâmica usando as palavras-chave globais/customizadas atuais
            const dynamicCleanedName = cleanTransactionDescriptionForDisplay(contrib.name, customIgnoreKeywords);

            finalResults.push({
                transaction: {
                    id: `ghost-${contrib._internalId}`, // ID Determinístico para facilitar remoção futura
                    date: contrib.date || new Date().toISOString().split('T')[0],
                    description: contrib.name,
                    rawDescription: contrib.name, // Mantém fidelidade
                    amount: 0, // Valor zero pois não caiu no banco
                    cleanedDescription: dynamicCleanedName, // Versão limpa para filtros
                    contributionType: contrib.contributionType,
                    originalAmount: "0.00"
                },
                contributor: {
                    ...contrib,
                    cleanedName: dynamicCleanedName // Atualiza o objeto contributor para a UI exibir limpo
                },
                status: 'PENDENTE',
                church: contrib.church,
                matchMethod: 'MANUAL', 
                similarity: 0,
                contributorAmount: contrib.amount,
                contributionType: contrib.contributionType,
                _injectedId: contrib._internalId // Marcador para saber que é fantasma
            });
        }
    });

    return finalResults;
};

/**
 * Função Pura de Agrupamento para View
 * Transforma a lista plana em dicionário agrupado por Igreja.
 * Usada para gerar o reportPreviewData.
 */
export const groupResultsByChurch = (results: MatchResult[]): Record<string, MatchResult[]> => {
    const grouped: Record<string, MatchResult[]> = {};
    
    results.forEach(r => {
        // Define a chave de agrupamento
        let key = 'unidentified';
        
        if (r.status === 'IDENTIFICADO' && r.church?.id) {
            key = r.church.id;
        } else if (r.status === 'PENDENTE' && r.church?.id) {
            // FIX: Agrupa Fantasmas (Pendentes) na igreja de origem
            // Isso garante que a lista de membros apareça completa (identificados + não identificados)
            key = r.church.id;
        }

        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
    });
    
    return grouped;
};
