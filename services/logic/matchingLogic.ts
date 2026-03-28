
import { Contributor, MatchResult, Church, Transaction, ReconciliationStatus, MatchMethod } from '../../types';
import { strictNormalize, extractIdentifyingCode, PLACEHOLDER_CHURCH, normalizeString } from '../utils/parsingUtils';

/**
 * Calcula a similaridade valorizando códigos identificadores (DNA Numérico).
 */
export const calculateNameSimilarity = (description: string, contributor: Contributor, ignoreKeywords: string[] = []): number => {
    const txCode = extractIdentifyingCode(description);
    const contribCode = extractIdentifyingCode(contributor.name) || (contributor.id && extractIdentifyingCode(contributor.id));

    // REGRA DE OURO: Se o código numérico (DNA) bater, o match é 100%
    if (txCode && contribCode && txCode.length >= 4 && contribCode.length >= 4) {
        if (txCode.includes(contribCode) || contribCode.includes(txCode)) {
            return 100; // Prioridade absoluta ao código
        }
    }

    const txNorm = normalizeString(description, ignoreKeywords);
    const contribNorm = contributor.normalizedName || normalizeString(contributor.name, ignoreKeywords);
    
    if (!txNorm || !contribNorm) return 0;

    const txTokens = txNorm.split(/\s+/).filter(t => t.length > 2);
    const contribTokens = contribNorm.split(/\s+/).filter(t => t.length > 2);
    
    if (txTokens.length === 0 || contribTokens.length === 0) {
        return txNorm === contribNorm ? 100 : 0;
    }
    
    const txSet = new Set(txTokens);
    const contribSet = new Set(contribTokens);
    const intersection = [...txSet].filter(w => contribSet.has(w)).length;
    
    return (2 * intersection) / (txSet.size + contribSet.size) * 100;
};

export const matchTransactions = (
    transactions: Transaction[],
    contributorFiles: any[] = [],
    options: { similarityThreshold: number; dayTolerance: number; },
    learnedAssociations: any[],
    churches: Church[],
    customIgnoreKeywords: string[] = [],
    existingResults: MatchResult[] = [] 
): MatchResult[] => {
    const contributorsByChurch = new Map<string, any[]>();
    
    if (contributorFiles && contributorFiles.length > 0) {
        contributorFiles.forEach((file: any) => {
            const churchId = file.church.id;
            const list = file.contributors.map((c: any) => ({ 
                ...c, 
                church: file.church,
                _churchId: churchId,
                _internalId: c.id || `contrib-${churchId}-${normalizeString(c.name, customIgnoreKeywords).replace(/\s/g, '')}`
            }));
            contributorsByChurch.set(churchId, list);
        });
    }

    const allContributorsFlat = Array.from(contributorsByChurch.values()).flat();
    const finalResults: MatchResult[] = [];
    const usedContributors = new Set<string>();

    transactions.forEach(tx => {
        const existingMatch = existingResults.find(r => r.transaction.id === tx.id);
        if (existingMatch && existingMatch.status === ReconciliationStatus.IDENTIFIED) {
            finalResults.push(existingMatch);
            if (existingMatch.contributor?._internalId) {
                usedContributors.add(existingMatch.contributor._internalId);
            }
            return;
        }

        // 🎯 AJUSTE SOLICITADO: Normalização estrita da descrição bancária
        const txDescStrict = strictNormalize(tx.description);
        
        let matchResult: MatchResult = {
            transaction: tx,
            contributor: null,
            status: ReconciliationStatus.UNIDENTIFIED,
            church: PLACEHOLDER_CHURCH,
            similarity: 0,
            contributionType: tx.contributionType,
            paymentMethod: tx.paymentMethod
        };

        // PRIORIDADE 1: Aprendizado Manual (Usa a descrição exata como DNA)
        const learned = learnedAssociations.find((la: any) => 
            la.normalizedDescription === txDescStrict
        );

        if (learned && learned.churchId) {
            const church = churches.find(c => c.id === learned.churchId);
            if (church) {
                matchResult = {
                    ...matchResult,
                    status: ReconciliationStatus.IDENTIFIED,
                    church: church,
                    matchMethod: MatchMethod.LEARNED,
                    similarity: 100,
                    contributor: { 
                        name: learned.contributorNormalizedName, 
                        amount: tx.amount,
                        cleanedName: learned.contributorNormalizedName
                    },
                    contributorAmount: tx.amount
                };
                finalResults.push(matchResult);
                return;
            }
        }

        // PRIORIDADE 2: Match por Similaridade com DNA Numérico (Lógica Fuzzy)
        if (allContributorsFlat.length > 0) {
            let bestMatch: any = null;
            let highestScore = 0;

            allContributorsFlat.forEach((contrib: any) => {
                const score = calculateNameSimilarity(tx.description, contrib, customIgnoreKeywords);
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = contrib;
                }
            });

            if (bestMatch && highestScore >= (options.similarityThreshold || 55)) {
                usedContributors.add(bestMatch._internalId);
                matchResult = {
                    ...matchResult,
                    status: ReconciliationStatus.IDENTIFIED,
                    contributor: bestMatch,
                    church: bestMatch.church,
                    matchMethod: MatchMethod.AI,
                    similarity: highestScore,
                    contributorAmount: bestMatch.amount,
                    contributionType: bestMatch.contributionType || tx.contributionType,
                    paymentMethod: bestMatch.paymentMethod || tx.paymentMethod
                };
            } else if (bestMatch && highestScore >= 25) {
                matchResult.suggestion = bestMatch;
                matchResult.similarity = highestScore;
            }
        }

        finalResults.push(matchResult);
    });

    // Processamento de Fantasmas
    if (allContributorsFlat.length > 0) {
        allContributorsFlat.forEach((contrib: any) => {
            if (!usedContributors.has(contrib._internalId)) {
                const ghostAmount = contrib.amount || 0;
                finalResults.push({
                    transaction: {
                        id: `ghost-${contrib._internalId}`,
                        date: contrib.date || new Date().toISOString().split('T')[0],
                        description: contrib.name,
                        rawDescription: contrib.name,
                        amount: ghostAmount,
                        cleanedDescription: contrib.name,
                        contributionType: contrib.contributionType,
                        paymentMethod: contrib.paymentMethod,
                        originalAmount: String(ghostAmount)
                    },
                    contributor: { ...contrib, cleanedName: contrib.name },
                    status: ReconciliationStatus.PENDING,
                    church: contrib.church,
                    matchMethod: MatchMethod.MANUAL,
                    similarity: 0,
                    contributorAmount: ghostAmount
                });
            }
        });
    }

    return finalResults;
};

export const groupResultsByChurch = (results: MatchResult[]): Record<string, MatchResult[]> => {
    const grouped: Record<string, MatchResult[]> = {};
    results.forEach(r => {
        let key = 'unidentified';
        if ((r.status === ReconciliationStatus.IDENTIFIED || r.status === ReconciliationStatus.PENDING) && r.church?.id) {
            key = r.church.id;
        }
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
    });
    return grouped;
};
