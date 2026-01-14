
import { Contributor, MatchResult, Church, Transaction } from '../../types';
import { normalizeString, parseDate, PLACEHOLDER_CHURCH } from '../utils/parsingUtils';

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

export const matchTransactions = (
    transactions: Transaction[],
    contributorFiles: any[],
    options: { similarityThreshold: number; dayTolerance: number; },
    learnedAssociations: any[],
    churches: Church[],
    customIgnoreKeywords: string[] = []
): MatchResult[] => {
    // Flatten contributors and assign internal IDs if missing
    const allContributors = contributorFiles.flatMap((file: any) => 
        file.contributors.map((c: any, idx: number) => ({ 
            ...c, 
            church: file.church,
            _internalId: `${file.church.id}-${idx}-${c.name}` // Unique key for tracking usage
        }))
    );
    
    const finalResults: MatchResult[] = [];
    const usedContributors = new Set<string>();

    transactions.forEach(tx => {
        // REMOVIDO FILTRO DE CONTROLE (SALDO/TOTAL) A PEDIDO DO USUÁRIO
        // if (NameResolver.isControlRow(tx.description)) return;

        const txDescNormalized = normalizeString(tx.description, customIgnoreKeywords);
        
        // 1. Check Learned Associations
        const learned = learnedAssociations.find((la: any) => la.normalizedDescription === txDescNormalized);
        if (learned) {
            const matchedContrib = allContributors.find((c: any) => 
                (normalizeString(c.name, customIgnoreKeywords) === learned.contributorNormalizedName) && 
                (c.church.id === learned.churchId)
            );
            if (matchedContrib) {
                usedContributors.add(matchedContrib._internalId);
                finalResults.push({ 
                    transaction: tx, contributor: matchedContrib, status: 'IDENTIFICADO', 
                    church: matchedContrib.church, matchMethod: 'LEARNED', similarity: 100, 
                    contributorAmount: matchedContrib.amount,
                    contributionType: matchedContrib.contributionType || tx.contributionType
                });
                return;
            }
        }

        // 2. Check Automatic Match
        let bestMatch: any = null;
        let highestScore = 0;

        allContributors.forEach((contrib: any) => {
            if (options.dayTolerance !== undefined && contrib.date && tx.date) {
                const tDate = parseDate(tx.date);
                const cDate = parseDate(contrib.date);
                if (tDate && cDate) {
                    const diffDays = Math.ceil(Math.abs(tDate.getTime() - cDate.getTime()) / (1000 * 3600 * 24));
                    if (diffDays > options.dayTolerance) return;
                }
            }

            const score = calculateNameSimilarity(tx.description, contrib, customIgnoreKeywords);
            
            // Logica alterada: Captura o melhor score independente do threshold
            if (score > highestScore) {
                highestScore = score;
                bestMatch = contrib;
            }
        });

        if (bestMatch && highestScore >= options.similarityThreshold) {
            usedContributors.add(bestMatch._internalId);
            finalResults.push({ 
                transaction: tx, contributor: bestMatch, status: 'IDENTIFICADO', 
                church: bestMatch.church, similarity: highestScore, 
                matchMethod: 'AUTOMATIC', contributorAmount: bestMatch.amount,
                contributionType: bestMatch.contributionType || tx.contributionType
            });
        } else {
            // Se tiver um score razoável (ex: > 40%), anexa como sugestão
            const suggestion = (highestScore > 40 && bestMatch) ? bestMatch : undefined;
            
            finalResults.push({ 
                transaction: tx, 
                contributor: null, 
                status: 'NÃO IDENTIFICADO', 
                church: PLACEHOLDER_CHURCH,
                contributionType: tx.contributionType,
                suggestion: suggestion, // Novo campo
                similarity: highestScore // Score do best match
            });
        }
    });

    // 3. Add Unmatched Contributors (Ghost Transactions for Reporting)
    allContributors.forEach((contrib: any) => {
        if (!usedContributors.has(contrib._internalId)) {
            finalResults.push({
                transaction: {
                    id: `ghost-${contrib._internalId}-${Date.now()}`,
                    date: contrib.date || new Date().toISOString().split('T')[0],
                    description: contrib.name, // Nome do contribuinte vira descrição
                    amount: 0, // Valor zero pois não caiu no banco
                    cleanedDescription: contrib.name,
                    contributionType: contrib.contributionType,
                    originalAmount: "0.00"
                },
                contributor: contrib,
                status: 'PENDENTE', // Novo Status: Estava na lista, não no banco
                church: contrib.church,
                matchMethod: 'MANUAL', // Placeholder para indicar que veio da lista manual
                similarity: 0,
                contributorAmount: contrib.amount, // Valor esperado
                contributionType: contrib.contributionType
            });
        }
    });

    return finalResults;
};

export const groupResultsByChurch = (results: MatchResult[]): Record<string, MatchResult[]> => {
    const grouped: Record<string, MatchResult[]> = {};
    results.forEach(r => {
        const key = r.church?.id || 'unidentified';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
    });
    return grouped;
};
