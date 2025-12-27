import { Transaction, Contributor, MatchResult, Church, FileModel } from '../types';
import { NameResolver } from '../core/processors/NameResolver';
import { DateResolver } from '../core/processors/DateResolver';
import { AmountResolver } from '../core/processors/AmountResolver';
import { StrategyEngine } from '../core/strategies';
import { detectDelimiter, generateFingerprint } from '../core/processors/Fingerprinter';

export { detectDelimiter, generateFingerprint };

export const PLACEHOLDER_CHURCH: Church = {
    id: 'unidentified',
    name: '---', 
    address: '',
    logoUrl: '',
    pastor: '',
};

export const DEFAULT_CONTRIBUTION_KEYWORDS = [
    'DÍZIMO', 'DÍZIMOS', 'OFERTA', 'OFERTAS', 'COLETA', 'COLETAS', 'MISSÃO', 'MISSÕES', 'VOTOS', 'CAMPANHA'
];

export const extractSnippet = (content: string): string => {
    if (!content) return '';
    return content.split(/\r?\n/).slice(0, 20).join('\n');
};

/**
 * Nova função principal de processamento que usa o Motor de Estratégias.
 * Agora aceita modelos aprendidos (FileModel[]) e keywords globais.
 */
export const processFileContent = (content: string, fileName: string, models: FileModel[] = [], globalKeywords: string[] = []): { transactions: Transaction[], method: string } => {
    const result = StrategyEngine.process(fileName, content, models, globalKeywords);
    return {
        transactions: result.transactions,
        method: result.strategyName
    };
};

export const normalizeString = (str: string, ignoreKeywords: string[] = []): string => {
    if (!str) return '';
    let cleaned = NameResolver.clean(str, ignoreKeywords);
    if (!cleaned || cleaned.trim().length === 0) cleaned = str;
    return NameResolver.normalize(cleaned).toLowerCase();
};

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
    const allContributors = contributorFiles.flatMap(file => 
        file.contributors.map((c: any, idx: number) => ({ 
            ...c, 
            church: file.church,
            _internalId: `${file.church.id}-${idx}-${c.name}` // Unique key for tracking usage
        }))
    );
    
    const finalResults: MatchResult[] = [];
    const usedContributors = new Set<string>();

    transactions.forEach(tx => {
        if (NameResolver.isControlRow(tx.description)) return;

        const txDescNormalized = normalizeString(tx.description, customIgnoreKeywords);
        
        // 1. Check Learned Associations
        const learned = learnedAssociations.find(la => la.normalizedDescription === txDescNormalized);
        if (learned) {
            const matchedContrib = allContributors.find(c => 
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

        allContributors.forEach(contrib => {
            if (options.dayTolerance !== undefined && contrib.date && tx.date) {
                const tDate = parseDate(tx.date);
                const cDate = parseDate(contrib.date);
                if (tDate && cDate) {
                    const diffDays = Math.ceil(Math.abs(tDate.getTime() - cDate.getTime()) / (1000 * 3600 * 24));
                    if (diffDays > options.dayTolerance) return;
                }
            }

            const score = calculateNameSimilarity(tx.description, contrib, customIgnoreKeywords);
            if (score >= options.similarityThreshold && score > highestScore) {
                highestScore = score;
                bestMatch = contrib;
            }
        });

        if (bestMatch) {
            usedContributors.add(bestMatch._internalId);
            finalResults.push({ 
                transaction: tx, contributor: bestMatch, status: 'IDENTIFICADO', 
                church: bestMatch.church, similarity: highestScore, 
                matchMethod: 'AUTOMATIC', contributorAmount: bestMatch.amount,
                contributionType: bestMatch.contributionType || tx.contributionType
            });
        } else {
            finalResults.push({ 
                transaction: tx, contributor: null, status: 'NÃO IDENTIFICADO', 
                church: PLACEHOLDER_CHURCH,
                contributionType: tx.contributionType
            });
        }
    });

    // 3. Add Unmatched Contributors (Ghost Transactions for Reporting)
    allContributors.forEach(contrib => {
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

export const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const clean = dateString.trim().replace(/\//g, '-');
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return new Date(clean);

    const parts = clean.split('-');
    if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        else return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return null;
};

// Mantido para compatibilidade
export const parseContributors = (content: string, ignoreKeywords: string[] = [], contributionKeywords: string[] = DEFAULT_CONTRIBUTION_KEYWORDS): Contributor[] => {
    const result = StrategyEngine.process("contributors.csv", content, [], ignoreKeywords);
    return result.transactions.map(t => ({
        name: t.description,
        cleanedName: t.cleanedDescription,
        normalizedName: normalizeString(t.description, ignoreKeywords),
        amount: t.amount,
        date: t.date,
        originalAmount: t.originalAmount,
        contributionType: t.contributionType
    }));
};

export const cleanTransactionDescriptionForDisplay = (description: string, ignoreKeywords: string[] = []): string => {
    const cleaned = NameResolver.clean(description, ignoreKeywords);
    if (!cleaned || cleaned.trim().length === 0) return description;
    return cleaned;
};

export const formatIncomeDescription = (description: string, ignoreKeywords: string[] = []): string => {
    return cleanTransactionDescriptionForDisplay(description, ignoreKeywords);
};

export const formatExpenseDescription = (description: string): string => {
    return NameResolver.clean(description);
};

/**
 * Lógica de filtragem UNIVERSAL e ROBUSTA (Idêntica ao SmartEditModal).
 * Suporta busca por partes de data (10/05, 10-05), valores flexíveis (100.50, 100,50) e texto.
 */
export const filterTransactionByUniversalQuery = (tx: Transaction, query: string): boolean => {
    if (!query || !query.trim()) return true;
    const terms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);

    // Prepare data for matching
    const dateIso = tx.date ? tx.date.toLowerCase() : '';
    let dateBr = '';
    let dateShort = '';
    
    if (tx.date) {
        const parts = tx.date.split('-'); // ISO YYYY-MM-DD
        if (parts.length === 3) {
            dateBr = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/AAAA
            dateShort = `${parts[2]}/${parts[1]}`; // DD/MM
        }
    }

    const descStr = (tx.cleanedDescription || tx.description || '').toLowerCase();
    const typeStr = (tx.contributionType || '').toLowerCase();
    
    // Flexible Amount Matching
    const amount = Math.abs(tx.amount);
    const amountStrFixed = amount.toFixed(2); // "100.50"
    const amountStrComma = amountStrFixed.replace('.', ','); // "100,50"
    const amountStrRaw = String(amount); // "100.5"

    return terms.every(term => {
        // 1. Text Match
        if (descStr.includes(term)) return true;
        if (typeStr.includes(term)) return true;

        // 2. Amount Match
        if (amountStrFixed.includes(term)) return true;
        if (amountStrComma.includes(term)) return true;
        if (amountStrRaw.includes(term)) return true;

        // 3. Date Match (Robust)
        // Normalize term for date matching (allow 10-10 or 10.10 to match 10/10)
        const dateTerm = term.replace(/[-.]/g, '/');
        
        if (dateIso.includes(term)) return true;
        if (dateBr.includes(dateTerm)) return true;
        if (dateShort.includes(dateTerm)) return true;

        return false;
    });
};

/**
 * Lógica de filtragem UNIVERSAL e ROBUSTA para Resultados de Conciliação.
 */
export const filterByUniversalQuery = (result: MatchResult, query: string): boolean => {
    if (!query || !query.trim()) return true;
    const terms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    
    const tx = result.transaction;
    
    // Dates (Prefer Contributor Date if matched, else Tx Date)
    const rawDate = result.contributor?.date || tx.date;
    const dateIso = rawDate ? rawDate.toLowerCase() : '';
    let dateBr = '';
    let dateShort = '';
    
    if (rawDate) {
        const parts = rawDate.split('-'); // ISO YYYY-MM-DD
        if (parts.length === 3) {
            dateBr = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/AAAA
            dateShort = `${parts[2]}/${parts[1]}`; // DD/MM
        }
    }

    // Text Fields
    const descStr = (tx.cleanedDescription || tx.description || '').toLowerCase();
    const contribName = (result.contributor?.name || '').toLowerCase();
    const contribCleanedName = (result.contributor?.cleanedName || '').toLowerCase();
    const churchName = (result.church?.name || '').toLowerCase();
    const typeStr = (result.contributor?.contributionType || result.contributionType || '').toLowerCase();
    
    // Amount Fields
    const amount = Math.abs(result.contributorAmount ?? tx.amount);
    const amountStrFixed = amount.toFixed(2);
    const amountStrComma = amountStrFixed.replace('.', ',');
    const amountStrRaw = String(amount);

    return terms.every(term => {
        // 1. Text Match
        if (descStr.includes(term)) return true;
        if (contribName.includes(term)) return true;
        if (contribCleanedName.includes(term)) return true;
        if (churchName.includes(term)) return true;
        if (typeStr.includes(term)) return true;

        // 2. Amount Match
        if (amountStrFixed.includes(term)) return true;
        if (amountStrComma.includes(term)) return true;
        if (amountStrRaw.includes(term)) return true;

        // 3. Date Match (Robust)
        const dateTerm = term.replace(/[-.]/g, '/');
        
        if (dateIso.includes(term)) return true;
        if (dateBr.includes(dateTerm)) return true;
        if (dateShort.includes(dateTerm)) return true;

        return false;
    });
};

// Funções LEGADO mantidas como stub
export const findMatchingModel = (content: string, models: FileModel[]) => null;
export const isModelSafeToApply = (content: string, model: FileModel) => ({ safe: true });
export const parseWithModel = (content: string, model: FileModel, userKeywords: string[]) => StrategyEngine.process("file", content, [model], userKeywords).transactions;
export const parseBankStatement = (content: string, kw: string[], ck: string[]) => StrategyEngine.process("file", content, []).transactions;