
import { Contributor, MatchResult, Church, Transaction, ReconciliationStatus, MatchMethod } from '../../types';
import { normalizeString, parseDate, PLACEHOLDER_CHURCH, cleanTransactionDescriptionForDisplay } from '../utils/parsingUtils';

export const calculateNameSimilarity = (description: string, contributor: Contributor, ignoreKeywords: string[] = []): number => {
    const txNorm = normalizeString(description, ignoreKeywords);
    const contribNorm = contributor.normalizedName || normalizeString(contributor.name, ignoreKeywords);
    
    if (!txNorm || !contribNorm) return 0;

    const txTokens = txNorm.split(/\s+/).filter(t => t.length > 0);
    const contribTokens = contribNorm.split(/\s+/).filter(t => t.length > 0);
    
    if (txTokens.length === 0 || contribTokens.length === 0) return 0;
    
    const txSet = new Set(txTokens);
    const contribSet = new Set(contribTokens);
    const intersection = [...txSet].filter(w => contribSet.has(w)).length;
    
    return (2 * intersection) / (txSet.size + contribSet.size) * 100;
};

/**
 * Valida se a diferença de dias entre duas datas está dentro da tolerância.
 */
const isWithinDateTolerance = (date1: string | undefined, date2: string | undefined, tolerance: number): boolean => {
    if (tolerance === undefined || !date1 || !date2) return true;
    const d1 = parseDate(date1);
    const d2 = parseDate(date2);
    if (!d1 || !d2) return true;

    const diffTime = Math.abs(d1.getTime() - d2.getTime());
    const diffDays = diffTime / (1000 * 3600 * 24);
    
    return diffDays <= tolerance;
};

export const matchTransactions = (
    transactions: Transaction[],
    contributorFiles: any[],
    options: { similarityThreshold: number; dayTolerance: number; },
    learnedAssociations: any[],
    churches: Church[],
    customIgnoreKeywords: string[] = []
): MatchResult[] => {
    const allContributors = contributorFiles.flatMap((file: any) => 
        file.contributors.map((c: any) => ({ 
            ...c, 
            church: file.church,
            _internalId: c.id || `contrib-${file.church.id}-${normalizeString(c.name).replace(/\s/g, '')}-${c.amount}`
        }))
    );
    
    const finalResults: MatchResult[] = [];
    const usedContributors = new Set<string>();

    // PROCESSAMENTO DE TODAS AS TRANSAÇÕES DO BANCO (SEM EXCEÇÃO)
    transactions.forEach(tx => {
        let matchResult: MatchResult = {
            transaction: tx,
            contributor: null,
            status: ReconciliationStatus.UNIDENTIFIED,
            church: PLACEHOLDER_CHURCH,
            similarity: 0,
            contributionType: tx.contributionType
        };

        const txDescNormalized = normalizeString(tx.description, customIgnoreKeywords);
        
        // 1. TENTA ASSOCIAÇÃO APRENDIDA
        const learned = learnedAssociations.find((la: any) => la.normalizedDescription === txDescNormalized);
        if (learned) {
            const matchedContrib = allContributors.find((c: any) => 
                (normalizeString(c.name, customIgnoreKeywords) === learned.contributorNormalizedName) && 
                (c.church.id === learned.churchId) &&
                isWithinDateTolerance(tx.date, c.date, options.dayTolerance)
            );

            if (matchedContrib) {
                usedContributors.add(matchedContrib._internalId);
                matchResult = {
                    ...matchResult,
                    status: ReconciliationStatus.IDENTIFIED,
                    contributor: matchedContrib,
                    church: matchedContrib.church,
                    matchMethod: MatchMethod.LEARNED,
                    similarity: 100,
                    contributorAmount: matchedContrib.amount
                };
                finalResults.push(matchResult);
                return;
            }
        }

        // 2. BUSCA POR SIMILARIDADE AUTOMÁTICA
        let bestMatch: any = null;
        let highestScore = 0;

        allContributors.forEach((contrib: any) => {
            if (!isWithinDateTolerance(tx.date, contrib.date, options.dayTolerance)) {
                return;
            }

            const score = calculateNameSimilarity(tx.description, contrib, customIgnoreKeywords);
            if (score > highestScore) {
                highestScore = score;
                bestMatch = contrib;
            }
        });

        // Só marca como IDENTIFICADO se atingir o limiar, mas a LINHA DO BANCO É MANTIDA SEMPRE
        if (bestMatch && highestScore >= options.similarityThreshold) {
            usedContributors.add(bestMatch._internalId);
            matchResult = {
                ...matchResult,
                status: ReconciliationStatus.IDENTIFIED,
                contributor: bestMatch,
                church: bestMatch.church,
                matchMethod: MatchMethod.AUTOMATIC,
                similarity: highestScore,
                contributorAmount: bestMatch.amount
            };
        } else if (bestMatch) {
            // Guarda a sugestão mesmo que baixa, mas mantém status UNIDENTIFIED
            matchResult.suggestion = bestMatch;
            matchResult.similarity = highestScore;
        }

        // A transação original é SEMPRE adicionada à lista final
        finalResults.push(matchResult);
    });

    // 3. GERA REGISTROS PENDENTES PARA O QUE SOBROU NAS LISTAS DE CONTRIBUINTES
    // Garante que nenhum nome da lista de membros seja esquecido
    allContributors.forEach((contrib: any) => {
        if (!usedContributors.has(contrib._internalId)) {
            const dynamicCleanedName = cleanTransactionDescriptionForDisplay(contrib.name, customIgnoreKeywords);
            finalResults.push({
                transaction: {
                    id: `ghost-${contrib._internalId}`,
                    date: contrib.date || new Date().toISOString().split('T')[0],
                    description: contrib.name,
                    rawDescription: contrib.name,
                    amount: 0, // Valor zero no banco pois não foi localizado
                    cleanedDescription: dynamicCleanedName,
                    contributionType: contrib.contributionType,
                    originalAmount: "0.00"
                },
                contributor: { ...contrib, cleanedName: dynamicCleanedName },
                status: ReconciliationStatus.PENDING,
                church: contrib.church,
                matchMethod: MatchMethod.MANUAL,
                similarity: 0,
                contributorAmount: contrib.amount
            });
        }
    });

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
