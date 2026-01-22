
import { Contributor, MatchResult, Church, Transaction, ReconciliationStatus, MatchMethod } from '../../types';
import { normalizeString, parseDate, PLACEHOLDER_CHURCH, cleanTransactionDescriptionForDisplay } from '../utils/parsingUtils';

/**
 * Calcula a similaridade focada apenas no NOME.
 */
export const calculateNameSimilarity = (description: string, contributor: Contributor, ignoreKeywords: string[] = []): number => {
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
    contributorFiles: any[] = [], // Agora opcional com default vazio
    options: { similarityThreshold: number; dayTolerance: number; },
    learnedAssociations: any[],
    churches: Church[],
    customIgnoreKeywords: string[] = []
): MatchResult[] => {
    const contributorsByChurch = new Map<string, any[]>();
    
    // Prepara as listas de contribuintes apenas se os arquivos existirem
    if (contributorFiles && contributorFiles.length > 0) {
        contributorFiles.forEach((file: any) => {
            const churchId = file.church.id;
            const list = file.contributors.map((c: any) => ({ 
                ...c, 
                church: file.church,
                _churchId: churchId,
                _internalId: c.id || `contrib-${churchId}-${normalizeString(c.name).replace(/\s/g, '')}`
            }));
            contributorsByChurch.set(churchId, list);
        });
    }

    const allContributorsFlat = Array.from(contributorsByChurch.values()).flat();
    const finalResults: MatchResult[] = [];
    const usedContributors = new Set<string>();

    transactions.forEach(tx => {
        const txDescNormalized = normalizeString(tx.description, customIgnoreKeywords);
        
        let matchResult: MatchResult = {
            transaction: tx,
            contributor: null,
            status: ReconciliationStatus.UNIDENTIFIED,
            church: PLACEHOLDER_CHURCH,
            similarity: 0,
            contributionType: tx.contributionType,
            paymentMethod: tx.paymentMethod
        };

        // PRIORIDADE 1: Associações Aprendidas (Cérebro do Sistema)
        const learned = learnedAssociations.find((la: any) => la.normalizedDescription === txDescNormalized);
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

        // PRIORIDADE 2: Match por Similaridade (se houver listas carregadas)
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

            if (bestMatch && highestScore >= (options.similarityThreshold || 90)) {
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

    // Registros "Fantasmas" só fazem sentido se houver listas de membros carregadas
    if (allContributorsFlat.length > 0) {
        allContributorsFlat.forEach((contrib: any) => {
            if (!usedContributors.has(contrib._internalId)) {
                finalResults.push({
                    transaction: {
                        id: `ghost-${contrib._internalId}`,
                        date: contrib.date || new Date().toISOString().split('T')[0],
                        description: contrib.name,
                        rawDescription: contrib.name,
                        amount: 0,
                        cleanedDescription: contrib.name,
                        contributionType: contrib.contributionType,
                        paymentMethod: contrib.paymentMethod,
                        originalAmount: "0.00"
                    },
                    contributor: { ...contrib, cleanedName: contrib.name },
                    status: ReconciliationStatus.PENDING,
                    church: contrib.church,
                    matchMethod: MatchMethod.MANUAL,
                    similarity: 0,
                    contributorAmount: contrib.amount
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
