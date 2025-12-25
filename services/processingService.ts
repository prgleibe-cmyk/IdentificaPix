
import { Transaction, Contributor, MatchResult, Church, FileModel } from '../types';
import { NameResolver } from '../core/processors/NameResolver';
import { DateResolver } from '../core/processors/DateResolver';
import { AmountResolver } from '../core/processors/AmountResolver';
import { RowValidator } from '../core/processors/RowValidator';

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

/**
 * Extrai as primeiras 20 linhas de um arquivo para fins de snippet/preview.
 * Aumentado de 5 para 20 para garantir a captura de cabeçalhos em arquivos com muitos metadados no topo.
 */
export const extractSnippet = (content: string): string => {
    if (!content) return '';
    return content.split(/\r?\n/).slice(0, 20).join('\n');
};

/**
 * Identifica a coluna de TIPO analisando palavras-chave específicas de forma puramente local.
 */
const identifyTypeColumn = (rows: string[][], contributionKeywords: string[]): number => {
    const sample = rows.slice(0, 100);
    if (sample.length === 0) return -1;
    
    const scores = new Array(rows[0]?.length || 0).fill(0);
    const keywords = contributionKeywords.map(k => k.toUpperCase().trim());

    sample.forEach(row => {
        row.forEach((cell, index) => {
            const val = String(cell || '').toUpperCase().trim();
            // Pontua a coluna se o valor for exatamente uma das palavras-chave ou contiver o termo de forma isolada
            if (keywords.some(k => val === k || val.includes(k))) {
                scores[index] += 1;
            }
        });
    });

    const maxScore = Math.max(...scores);
    // Exige que pelo menos 10% das linhas tenham o termo para classificar a coluna
    return maxScore > (sample.length * 0.10) ? scores.indexOf(maxScore) : -1;
};

export const generateFingerprint = (content: string): FileModel['fingerprint'] | null => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return null;

    let delimiter = ';';
    if (lines[0].includes('\t')) delimiter = '\t';
    else if (!lines[0].includes(';') && lines[0].includes(',')) delimiter = ',';

    const header = lines[0];
    const cells = header.split(delimiter);
    
    const headerHash = header.split('').reduce((a, b) => { 
        a = ((a << 5) - a) + b.charCodeAt(0); 
        return a & a; 
    }, 0).toString(36);

    const dataRows = lines.slice(1, 10);
    let topology = "";
    if (dataRows.length > 0) {
        const sampleRow = dataRows.find(r => r.split(delimiter).length === cells.length) || dataRows[0];
        topology = sampleRow.split(delimiter).map(c => {
            const clean = c.trim().replace(/[R$\s]/g, '').replace(',', '.');
            return isNaN(parseFloat(clean)) ? 'S' : 'N';
        }).join(',');
    }

    return { columnCount: cells.length, delimiter, headerHash, dataTopology: topology };
};

export const findMatchingModel = (content: string, models: FileModel[]): FileModel | null => {
    const current = generateFingerprint(content);
    if (!current) return null;

    return models.find(m => 
        m.is_active &&
        m.fingerprint.columnCount === current.columnCount &&
        m.fingerprint.delimiter === current.delimiter &&
        m.fingerprint.dataTopology === current.dataTopology
    ) || null;
};

export const isModelSafeToApply = (content: string, model: FileModel): { safe: boolean; reason?: string } => {
    const current = generateFingerprint(content);
    if (!current) return { safe: false, reason: "Arquivo vazio ou inválido" };

    if (current.columnCount !== model.fingerprint.columnCount) {
        return { safe: false, reason: `Divergência de colunas: esperado ${model.fingerprint.columnCount}, detectado ${current.columnCount}` };
    }

    if (current.dataTopology !== model.fingerprint.dataTopology) {
        return { safe: false, reason: "A estrutura de tipos de dados mudou (Topologia divergente)." };
    }

    return { safe: true };
};

const finalizeTransaction = (
    rawDate: string, 
    rawDesc: string, 
    rawAmount: string, 
    rawType: string | undefined,
    anchorYear: number, 
    index: number, 
    userKeywords: string[] = []
): Transaction | null => {
    const isoDate = DateResolver.resolveToISO(rawDate, anchorYear);
    const standardizedAmountStr = AmountResolver.clean(rawAmount);
    const numericAmount = parseFloat(standardizedAmountStr);

    if (!RowValidator.isValid(isoDate, rawDesc, standardizedAmountStr)) {
        return null;
    }

    const cleanedName = NameResolver.clean(rawDesc, userKeywords);

    return {
        id: `tx-norm-${index}-${Date.now()}`,
        date: isoDate,
        description: cleanedName,
        amount: numericAmount,
        originalAmount: rawAmount,
        cleanedDescription: cleanedName,
        contributionType: rawType?.trim().toUpperCase()
    };
};

export const parseWithModel = (content: string, model: FileModel, userKeywords: string[] = []): Transaction[] => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    const { mapping, fingerprint, parsingRules } = model;
    const anchorYear = DateResolver.discoverAnchorYear(content);
    
    const dataLines = lines.slice(mapping.skipRowsStart, lines.length - mapping.skipRowsEnd);
    
    return dataLines.map((line, i) => {
        const upperLine = line.toUpperCase();
        if (parsingRules?.rowFilters?.some(f => upperLine.includes(f.toUpperCase()))) return null;

        const cells = line.split(fingerprint.delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
        
        const rawDate = cells[mapping.dateColumnIndex] || '';
        const rawDesc = cells[mapping.descriptionColumnIndex] || '';
        const rawAmount = cells[mapping.amountColumnIndex] || '';
        const rawType = mapping.typeColumnIndex !== undefined ? cells[mapping.typeColumnIndex] : undefined;

        return finalizeTransaction(rawDate, rawDesc, rawAmount, rawType, anchorYear, i, userKeywords);
    }).filter((t): t is Transaction => t !== null);
};

export const parseBankStatement = (content: string, customIgnoreKeywords: string[] = [], contributionKeywords: string[] = DEFAULT_CONTRIBUTION_KEYWORDS): Transaction[] => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 1) return [];

    let delimiter = ';';
    if (lines[0].includes('\t')) delimiter = '\t';
    else if (!lines[0].includes(';') && lines[0].includes(',')) delimiter = ',';

    const parsedRows = lines.map(l => l.split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim()));
    const anchorYear = DateResolver.discoverAnchorYear(content);

    const dateIdx = DateResolver.identifyDateColumn(parsedRows);
    const amountIdx = AmountResolver.identifyAmountColumn(parsedRows, [dateIdx]);
    const nameIdx = NameResolver.identifyNameColumn(parsedRows, [dateIdx, amountIdx]);
    const typeIdx = identifyTypeColumn(parsedRows, contributionKeywords);

    return parsedRows.map((row, i) => {
        const rawType = typeIdx !== -1 ? row[typeIdx] : undefined;
        // Fix: Safely handle if date column was not identified (-1) to avoid passing undefined
        const rawDate = dateIdx !== -1 ? (row[dateIdx] || '') : ''; 
        return finalizeTransaction(rawDate, row[nameIdx], row[amountIdx], rawType, anchorYear, i, customIgnoreKeywords);
    }).filter((t): t is Transaction => t !== null);
};

export const normalizeString = (str: string, ignoreKeywords: string[] = []): string => {
    if (!str) return '';
    let cleaned = NameResolver.clean(str, ignoreKeywords);
    return NameResolver.normalize(cleaned).toLowerCase();
};

export const calculateNameSimilarity = (description: string, contributor: Contributor, ignoreKeywords: string[] = []): number => {
    const txNorm = normalizeString(description, ignoreKeywords);
    const contribNorm = contributor.normalizedName || normalizeString(contributor.name, ignoreKeywords);
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
    const allContributors = contributorFiles.flatMap(file => 
        file.contributors.map((c: any) => ({ ...c, church: file.church }))
    );
    
    const finalResults: MatchResult[] = [];

    transactions.forEach(tx => {
        const txDescNormalized = normalizeString(tx.description, customIgnoreKeywords);
        
        const learned = learnedAssociations.find(la => la.normalizedDescription === txDescNormalized);
        if (learned) {
            const matchedContrib = allContributors.find(c => 
                (normalizeString(c.name, customIgnoreKeywords) === learned.contributorNormalizedName) && 
                (c.church.id === learned.churchId)
            );
            if (matchedContrib) {
                finalResults.push({ 
                    transaction: tx, contributor: matchedContrib, status: 'IDENTIFICADO', 
                    church: matchedContrib.church, matchMethod: 'LEARNED', similarity: 100, 
                    contributorAmount: matchedContrib.amount,
                    contributionType: matchedContrib.contributionType || tx.contributionType
                });
                return;
            }
        }

        let bestMatch: any = null;
        let highestScore = 0;

        allContributors.forEach(contrib => {
            // MODIFICADO: Só verifica data se o contribuinte tiver data válida. 
            // Listas sem data são permitidas e ignoram a tolerância.
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
    const parts = clean.split('-');
    
    if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        else return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return null;
};

// MODIFICADO: Parser de Contribuintes agora é mais tolerante
export const parseContributors = (content: string, ignoreKeywords: string[] = [], contributionKeywords: string[] = DEFAULT_CONTRIBUTION_KEYWORDS): Contributor[] => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 1) return [];

    let delimiter = ';';
    if (lines[0].includes('\t')) delimiter = '\t';
    else if (!lines[0].includes(';') && lines[0].includes(',')) delimiter = ',';

    const parsedRows = lines.map(l => l.split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim()));
    const anchorYear = DateResolver.discoverAnchorYear(content);

    const dateIdx = DateResolver.identifyDateColumn(parsedRows);
    const amountIdx = AmountResolver.identifyAmountColumn(parsedRows, [dateIdx]);
    const nameIdx = NameResolver.identifyNameColumn(parsedRows, [dateIdx, amountIdx]);
    const typeIdx = identifyTypeColumn(parsedRows, contributionKeywords);

    return parsedRows.map((row, i): Contributor | null => {
        // Tolerância: Se não achar coluna de data, assume string vazia (sem data)
        const rawDate = dateIdx !== -1 ? (row[dateIdx] || '') : '';
        const isoDate = rawDate ? DateResolver.resolveToISO(rawDate, anchorYear) : undefined;
        
        const rawName = nameIdx !== -1 ? (row[nameIdx] || '') : '';
        const rawAmount = amountIdx !== -1 ? (row[amountIdx] || '') : '0.00';
        const rawType = typeIdx !== -1 ? row[typeIdx] : undefined;

        // Limpeza básica
        const cleanedName = NameResolver.clean(rawName, ignoreKeywords);
        const standardizedAmountStr = AmountResolver.clean(rawAmount);
        const numericAmount = parseFloat(standardizedAmountStr);

        // Validação Mínima para Contribuinte: Precisa ter Nome e Valor válido
        if (!cleanedName || cleanedName.length < 2 || isNaN(numericAmount)) {
            return null;
        }

        return {
            name: cleanedName, // Usa o nome limpo como display principal
            cleanedName: cleanedName,
            normalizedName: normalizeString(rawName, ignoreKeywords),
            amount: numericAmount,
            date: isoDate, // Pode ser undefined
            originalAmount: rawAmount,
            contributionType: rawType?.trim().toUpperCase()
        };
    }).filter((c): c is Contributor => c !== null);
};

export const cleanTransactionDescriptionForDisplay = (description: string, ignoreKeywords: string[] = []): string => {
    return NameResolver.clean(description, ignoreKeywords);
};

export const formatIncomeDescription = (description: string, ignoreKeywords: string[] = []): string => {
    return NameResolver.clean(description, ignoreKeywords);
};

export const formatExpenseDescription = (description: string): string => {
    return NameResolver.clean(description);
};

export const filterTransactionByUniversalQuery = (tx: Transaction, query: string): boolean => {
    if (!query || !query.trim()) return true;
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const dateStr = tx.date.toLowerCase();
    const descStr = (tx.cleanedDescription || tx.description || '').toLowerCase();
    const typeStr = (tx.contributionType || '').toLowerCase();
    const amountStr = tx.amount.toFixed(2).replace('.', ',');
    const amountStrDot = tx.amount.toFixed(2);

    return terms.every(term => 
        dateStr.includes(term) || 
        descStr.includes(term) || 
        typeStr.includes(term) ||
        amountStr.includes(term) || 
        amountStrDot.includes(term)
    );
};

export const filterByUniversalQuery = (result: MatchResult, query: string): boolean => {
    if (!query || !query.trim()) return true;
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    
    const tx = result.transaction;
    const dateStr = (result.contributor?.date || tx.date).toLowerCase();
    const descStr = (tx.cleanedDescription || tx.description || '').toLowerCase();
    const contribName = (result.contributor?.name || '').toLowerCase();
    const churchName = (result.church?.name || '').toLowerCase();
    const typeStr = (result.contributionType || '').toLowerCase();
    
    const amount = result.contributorAmount ?? tx.amount;
    const amountStr = amount.toFixed(2).replace('.', ',');
    const amountStrDot = amount.toFixed(2);

    return terms.every(term => 
        dateStr.includes(term) || 
        descStr.includes(term) || 
        contribName.includes(term) || 
        churchName.includes(term) || 
        typeStr.includes(term) ||
        amountStr.includes(term) || 
        amountStrDot.includes(term)
    );
};
