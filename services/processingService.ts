
import { Transaction, Contributor, MatchResult, ContributorFile, Church, LearnedAssociation, GroupedReportData } from '../types';
import { Logger, Metrics } from './monitoringService';

// --- Centralized Constants ---

export const PLACEHOLDER_CHURCH: Church = {
    id: 'unidentified',
    name: '---', 
    address: '',
    logoUrl: '',
    pastor: '',
};

// Palavras que indicam linhas de resumo em extratos bancários.
const STOP_WORDS_RESUMO = ['TOTAL', 'SALDO', 'SUBTOTAL', 'RESUMO', 'ACUMULADO', 'FECHAMENTO', 'DISPONIVEL', 'APLICAÇÃO', 'RESGATE', 'SALDO ANTERIOR', 'TOTAL GERAL'];

// --- Intelligent Search Filtering ---

export const getPotentialAmounts = (term: string): number[] => {
    const potentials: number[] = [];
    const cleanTerm = term.replace(/[^\d.,-]/g, '');
    if (!cleanTerm) return [];

    if (/^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(cleanTerm)) {
        const val = parseFloat(cleanTerm.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(val)) potentials.push(val);
    }
    
    if (/^-?\d+(\.\d+)?$/.test(cleanTerm)) {
        const val = parseFloat(cleanTerm);
        if (!isNaN(val)) potentials.push(val);
    }

    const brGeneric = cleanTerm.replace(/\./g, '').replace(',', '.');
    const valBR = parseFloat(brGeneric);
    if (!isNaN(valBR)) potentials.push(valBR);

    return [...new Set(potentials)];
};

export const filterByUniversalQuery = (record: MatchResult, query: string): boolean => {
    if (!query) return true;
    const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);

    return searchTerms.every(term => {
        const normalizedTerm = normalizeString(term);
        let matchFound = false;

        const txDesc = normalizeString(record.transaction.description);
        const txClean = normalizeString(record.transaction.cleanedDescription || '');
        const contribName = record.contributor ? normalizeString(record.contributor.name) : '';
        const churchName = record.church?.name || '';

        if (
            txDesc.includes(normalizedTerm) || 
            txClean.includes(normalizedTerm) || 
            contribName.includes(normalizedTerm) ||
            churchName.includes(normalizedTerm)
        ) {
            matchFound = true;
        }

        if (!matchFound && /\d/.test(term)) {
            const potentials = getPotentialAmounts(term);
            const txAmount = Math.abs(record.transaction.amount);
            const contribAmount = record.contributorAmount ? Math.abs(record.contributorAmount) : (record.contributor?.amount ? Math.abs(record.contributor.amount) : 0);

            const isNumericMatch = potentials.some(val => 
                Math.abs(txAmount - val) < 0.01 || 
                (contribAmount > 0 && Math.abs(contribAmount - val) < 0.01)
            );

            if (isNumericMatch) matchFound = true;
        }

        return matchFound;
    });
};

export const filterTransactionByUniversalQuery = (transaction: Transaction, query: string): boolean => {
    const fakeRecord: MatchResult = {
        transaction,
        contributor: null,
        status: 'NÃO IDENTIFICADO',
        church: PLACEHOLDER_CHURCH
    };
    return filterByUniversalQuery(fakeRecord, query);
};

// --- Heuristics & Parsers ---

export const parseDate = (dateString: string, defaultYear?: number | null): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;
    const trimmed = dateString.trim().replace(/^['"]|['"]$/g, '');
    
    const parts = trimmed.match(/(\d+)/g);
    if (!parts || parts.length < 2) return null;
    
    let day, month, year;
    if (parts.length === 2) {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = defaultYear || new Date().getFullYear();
    } else {
        if (parts[0].length === 4) { [year, month, day] = parts.map(p => parseInt(p, 10)); }
        else { 
            [day, month, year] = parts.map(p => parseInt(p, 10)); 
            if (String(year).length === 2) year += (year < 50 ? 2000 : 1900); 
        }
    }
    
    const date = new Date(Date.UTC(year, month - 1, day));
    return (!isNaN(date.getTime())) ? date : null;
};

const isDateString = (s: string): boolean => {
    if (!s) return false;
    return parseDate(s) !== null;
};

const isAmountString = (s: string): boolean => {
    if (!s || typeof s !== 'string') return false;
    const clean = s.trim();
    if (!/\d/.test(clean)) return false;
    const digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.length >= 11) return false;
    const val = parseAmountString(clean);
    return !isNaN(val) && isFinite(val); 
};

const parseAmountString = (s: string): number => {
    if (s === undefined || s === null) return 0;
    if (typeof s === 'number') return s;

    let cleanS = s.toString().trim();
    const isNegative = cleanS.includes('-') || cleanS.includes('(') || /\b(D|Db|Dr|Débito)\b/i.test(cleanS);
    cleanS = cleanS.replace(/[R$BRL\s]/gi, '').replace(/[^\d.,]/g, '');
    if (!cleanS) return 0;

    const lastComma = cleanS.lastIndexOf(',');
    const lastDot = cleanS.lastIndexOf('.');
    let parsable: string;

    if (lastComma !== -1 && lastDot !== -1) {
        if (lastComma > lastDot) parsable = cleanS.replace(/\./g, '').replace(',', '.');
        else parsable = cleanS.replace(/,/g, '');
    } 
    else if (lastComma !== -1) parsable = cleanS.replace(',', '.');
    else if (lastDot !== -1) {
        const parts = cleanS.split('.');
        if (parts.length > 2 || (parts[parts.length - 1].length === 3 && cleanS.length > 4)) parsable = cleanS.replace(/\./g, '');
        else parsable = cleanS;
    } 
    else parsable = cleanS;

    const value = parseFloat(parsable);
    if (isNaN(value)) return 0;
    return isNegative ? -Math.abs(value) : Math.abs(value);
};

// --- Parser Inteligente ---

const intelligentParser = <T>(
    content: string,
    type: 'EXTRATO' | 'LISTA'
): T[] => {
    if (!content) return [];

    let delimiter = ',';
    if (content.includes('\t')) delimiter = '\t';
    else if (content.includes(';')) {
        const semiCount = (content.match(/;/g) || []).length;
        const commaCount = (content.match(/,/g) || []).length;
        if (semiCount > commaCount * 0.3) delimiter = ';';
    }

    const parseCSVLine = (line: string, delim: string) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === delim && !inQuotes) {
                result.push(cur.trim().replace(/^['"]|['"]$/g, ''));
                cur = '';
            } else cur += char;
        }
        result.push(cur.trim().replace(/^['"]|['"]$/g, ''));
        return result;
    };

    const rawLines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    const lines = rawLines.map(l => parseCSVLine(l, delimiter));
    if (lines.length < 1) return [];

    // Detecção de Cabeçalhos
    let hDate = -1, hAmount = -1, hText = -1;
    for (const row of lines.slice(0, 10)) {
        row.forEach((cell, idx) => {
            const up = cell.toUpperCase().trim();
            if (['DATA', 'DATA_PAGAMENTO', 'DATA_PAGTO', 'DT_MOV', 'DT'].includes(up)) hDate = idx;
            if (['VALOR', 'VALOR_PAGO', 'VR_LANC', 'CONTRIBUIÇÃO', 'QUANTIA', 'VALOR_RECEBIDO'].includes(up)) hAmount = idx;
            if (['NOME', 'CONTRIBUINTE', 'MEMBRO', 'NOME_DO_MEMBRO', 'DESCRIÇÃO', 'HISTORICO', 'NOME COMPLETO'].includes(up)) hText = idx;
        });
    }

    const sample = lines.slice(0, 50);
    const numCols = Math.max(...sample.map(l => l.length));
    const colStats = Array.from({ length: numCols }, () => ({
        dates: 0,
        amounts: 0,
        sumValue: 0,
        countAboveOne: 0,
        uniqueValues: new Set<string>(),
        totalChars: 0,
        numericChars: 0
    }));

    sample.forEach(row => {
        row.forEach((cell, i) => {
            if (!cell || i >= numCols) return;
            if (isDateString(cell)) colStats[i].dates++;
            if (isAmountString(cell)) {
                const val = Math.abs(parseAmountString(cell));
                colStats[i].amounts++;
                colStats[i].sumValue += val;
                if (val > 1.01) colStats[i].countAboveOne++;
            }
            colStats[i].uniqueValues.add(cell.toUpperCase());
            colStats[i].totalChars += cell.length;
            colStats[i].numericChars += (cell.match(/\d/g) || []).length;
        });
    });

    const dateIdx = hDate !== -1 ? hDate : colStats.findIndex((s) => s.dates > (sample.length * 0.2));
    
    // Identificação de Valor Individual vs Totais/Centavos
    let amountIdx = hAmount;
    if (amountIdx === -1) {
        const candidates = colStats
            .map((s, i) => ({ 
                i, 
                count: s.amounts, 
                avg: s.amounts > 0 ? s.sumValue / s.amounts : Infinity,
                aboveOneRatio: s.amounts > 0 ? s.countAboveOne / s.amounts : 0
            }))
            .filter(c => c.i !== dateIdx && c.count > (sample.length * 0.1) && c.aboveOneRatio > 0.3) // Exclui colunas que parecem apenas centavos
            .sort((a, b) => {
                // Prioriza a coluna com a MENOR média (coluna individual vs total acumulado), mas garante que não é apenas centavos
                if (Math.abs(a.count - b.count) < (sample.length * 0.1)) return a.avg - b.avg;
                return b.count - a.count;
            });
        if (candidates.length > 0) amountIdx = candidates[0].i;
    }

    // Identificação de Texto (Nome/Descrição) - INDIVIDUALIZADA
    let textIdx = hText;
    if (textIdx === -1) {
        const textCandidates = colStats
            .map((s, i) => {
                const numericRatio = s.totalChars > 0 ? s.numericChars / s.totalChars : 1;
                // Penaliza colunas puramente numéricas ou datas
                const penalty = (numericRatio > 0.6 || i === dateIdx || i === amountIdx) ? 0.0001 : 1.0;
                return { i, score: s.uniqueValues.size * (s.totalChars / (sample.length || 1)) * penalty };
            })
            .sort((a, b) => b.score - a.score);
        if (textCandidates.length > 0 && textCandidates[0].score > 0.1) textIdx = textCandidates[0].i;
    }

    const results: any[] = [];
    lines.forEach(row => {
        const dateRaw = dateIdx !== -1 ? row[dateIdx] : null;
        const amountRaw = amountIdx !== -1 ? row[amountIdx] : null;
        const textRaw = textIdx !== -1 ? row[textIdx] : null;

        if (!dateRaw || !amountRaw || !isDateString(dateRaw) || !isAmountString(amountRaw)) return;
        const parsedAmount = parseAmountString(amountRaw);

        if (type === 'EXTRATO') {
            results.push({
                date: dateRaw,
                amount: parsedAmount,
                originalAmount: amountRaw,
                description: textRaw || 'Sem Descrição'
            });
        } else {
            if (textRaw && textRaw.length > 1) {
                const upperText = textRaw.toUpperCase();
                const isStopWord = STOP_WORDS_RESUMO.some(sw => upperText.includes(sw));
                const isHeader = ['NOME', 'CONTRIBUINTE', 'MEMBRO', 'VALOR', 'DATA', 'HISTÓRICO', 'HISTORICO'].includes(upperText);
                if (!isStopWord && !isHeader) {
                    results.push({ name: textRaw, date: dateRaw, amount: parsedAmount, originalAmount: amountRaw });
                }
            }
        }
    });

    return results;
};

export const parseBankStatement = (content: string, customIgnoreKeywords: string[] = []): Transaction[] => {
    const raw = intelligentParser<Transaction>(content, 'EXTRATO');
    const ignoreRegex = createIgnoreKeywordsRegex(customIgnoreKeywords);
    return raw.map((t, i) => ({
        ...t,
        id: `tx-${i}-${Math.random().toString(36).substr(2, 5)}`,
        cleanedDescription: cleanText(t.description, ignoreRegex, true)
    }));
};

export const parseContributors = (content: string, customIgnoreKeywords: string[] = []): Contributor[] => {
    const raw = intelligentParser<Contributor>(content, 'LISTA');
    const ignoreRegex = createIgnoreKeywordsRegex(customIgnoreKeywords);
    return raw.map((c, i) => ({
        ...c,
        id: `contrib-${i}-${Math.random().toString(36).substr(2, 5)}`,
        cleanedName: cleanText(c.name, ignoreRegex, false), 
        normalizedName: normalizeString(c.name, customIgnoreKeywords)
    }));
};

// --- Helpers de Limpeza ---

const removeCodes = (text: string): string => {
    const cpfRegex = /\d{3}\.\d{3}\.\d{3}-\d{2}|\*\*\*\.\d{3}\.\d{3}-\*\*/g;
    const longNumRegex = /\b\d{8,}\b/g;
    return text.replace(cpfRegex, '').replace(longNumRegex, '').replace(/\s+/g, ' ').trim();
};

export const normalizeString = (str: string, ignoreKeywords: string[] = []): string => {
    if (!str) return '';
    let normalized = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    normalized = removeCodes(normalized);

    if (ignoreKeywords.length > 0) {
        const regex = createIgnoreKeywordsRegex(ignoreKeywords);
        if (regex) {
            // No modo de normalização, removemos as palavras ignoradas também normalizadas
            normalized = normalized.replace(regex, '');
        }
    }

    return normalized.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

export const cleanTransactionDescriptionForDisplay = (text: string): string => {
    if (!text) return '';
    let cleaned = text.replace(/PIX Recebido|TED|DOC|<[^>]*>/gi, '');
    cleaned = removeCodes(cleaned);
    return cleaned.replace(/\s+/g, ' ').trim();
};

const createIgnoreKeywordsRegex = (keywords: string[]): RegExp | null => {
    if (!keywords || keywords.length === 0) return null;
    
    // Para cada palavra, geramos uma versão normalizada (sem acentos) para garantir o match
    const allVariations = keywords.flatMap(k => {
        const trimmed = k.trim();
        if (!trimmed) return [];
        const unaccented = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return unaccented !== trimmed ? [trimmed, unaccented] : [trimmed];
    });

    // Escapa caracteres especiais e junta com pipe
    const pattern = allVariations
        .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');

    // Usamos delimitadores flexíveis (espaço, início, fim ou pontuação bancária comum) em vez de \b estrito
    return new RegExp(`(?:^|\\s|[-:/])(${pattern})(?:$|\\s|[-:/])`, 'gi');
};

const cleanText = (text: string, ignoreRegex: RegExp | null, isBankStatement: boolean): string => {
    if (!text) return '';
    let cleaned = removeCodes(text);
    
    if (ignoreRegex) {
        // Remove múltiplas vezes caso haja palavras coladas ou repetidas
        let lastCleaned = '';
        while (cleaned !== lastCleaned) {
            lastCleaned = cleaned;
            cleaned = cleaned.replace(ignoreRegex, (match, p1) => {
                // Mantém os delimitadores externos e remove apenas a palavra capturada (p1)
                return match.replace(p1, '');
            });
        }
    }
    
    return cleaned.replace(/\s+/g, ' ').trim();
};

// --- Matching Logic ---

export const calculateNameSimilarity = (desc: string, contrib: Contributor): number => {
    const s1 = normalizeString(desc);
    const s2 = contrib.normalizedName || normalizeString(contrib.name);
    if (!s1 || !s2) return 0;
    
    const words1 = new Set(s1.split(' ').filter(w => w.length > 1));
    const words2 = new Set(s2.split(' ').filter(w => w.length > 1));
    
    const intersect = new Set([...words1].filter(w => words2.has(w)));
    if (words1.size + words2.size === 0) return 0;
    return (2 * intersect.size) / (words1.size + words2.size) * 100;
};

export const matchTransactions = (
    transactions: Transaction[],
    contributorFiles: ContributorFile[],
    options: { similarityThreshold: number; dayTolerance: number; },
    learnedAssociations: LearnedAssociation[],
    churches: Church[],
    customIgnoreKeywords: string[] = []
): MatchResult[] => {
    const allContributors = contributorFiles.flatMap(file => 
        file.contributors.map(c => ({ ...c, church: file.church }))
    );

    const finalResults: MatchResult[] = [];
    const matchedContributorIds = new Set<string>();

    transactions.forEach(tx => {
        let bestMatch: any = null;
        let highestScore = 0;

        const txDescNormalized = normalizeString(tx.description, customIgnoreKeywords);
        const learned = learnedAssociations.find(la => la.normalizedDescription === txDescNormalized);
        
        if (learned) {
            const matchedContrib = allContributors.find(c => 
                (c.normalizedName === learned.contributorNormalizedName) && 
                (c.church.id === learned.churchId)
            );
            if (matchedContrib) {
                matchedContributorIds.add(`${matchedContrib.church.id}-${matchedContrib.id}`);
                finalResults.push({ transaction: tx, contributor: matchedContrib, status: 'IDENTIFICADO', church: matchedContrib.church, similarity: 100, matchMethod: 'LEARNED', contributorAmount: matchedContrib.amount });
                return;
            }
        }

        allContributors.forEach(contrib => {
            if (contrib.date && tx.date) {
                const d1 = parseDate(tx.date), d2 = parseDate(contrib.date);
                if (d1 && d2) {
                    const diffDays = Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
                    if (diffDays > options.dayTolerance) return;
                }
            }
            const score = calculateNameSimilarity(tx.description, contrib);
            if (score >= options.similarityThreshold && score > highestScore) {
                highestScore = score;
                bestMatch = contrib;
            }
        });

        if (bestMatch) {
            matchedContributorIds.add(`${bestMatch.church.id}-${bestMatch.id}`);
            finalResults.push({ transaction: tx, contributor: bestMatch, status: 'IDENTIFICADO', church: bestMatch.church, similarity: highestScore, matchMethod: 'AUTOMATIC', contributorAmount: bestMatch.amount });
        } else {
            finalResults.push({ transaction: tx, contributor: null, status: 'NÃO IDENTIFICADO', church: PLACEHOLDER_CHURCH });
        }
    });

    allContributors.forEach(contrib => {
        const uniqueId = `${contrib.church.id}-${contrib.id}`;
        if (!matchedContributorIds.has(uniqueId)) {
            const virtualTx: Transaction = {
                id: `pending-${contrib.id}-${Math.random().toString(36).substr(2, 5)}`,
                date: contrib.date || '---',
                description: `[Pendente no Extrato] ${contrib.name}`,
                cleanedDescription: contrib.cleanedName || contrib.name,
                amount: 0, originalAmount: '0,00'
            };
            finalResults.push({ transaction: virtualTx, contributor: contrib, status: 'NÃO IDENTIFICADO', church: contrib.church, contributorAmount: contrib.amount, similarity: 0 });
        }
    });

    return finalResults;
};

export const groupResultsByChurch = (results: MatchResult[]): GroupedReportData => {
    const grouped: GroupedReportData = {};
    results.forEach(r => {
        const key = r.church?.id || 'unidentified';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
    });
    return grouped;
};

// Fix typo on line 493: PLACEHOLDER_CHOLDER_CHURCH -> PLACEHOLDER_CHURCH
export const processExpenses = (txs: Transaction[]): MatchResult[] => 
    txs.map(t => ({ transaction: t, contributor: null, status: 'NÃO IDENTIFICADO', church: PLACEHOLDER_CHURCH }));
