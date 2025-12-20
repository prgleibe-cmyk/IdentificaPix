
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

    const usGeneric = cleanTerm.replace(/,/g, '');
    const valUS = parseFloat(usGeneric);
    if (!isNaN(valUS)) potentials.push(valUS);

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
        const contribClean = record.contributor?.cleanedName ? normalizeString(record.contributor.cleanedName) : '';
        const churchName = normalizeString(record.church?.name || '');

        if (
            txDesc.includes(normalizedTerm) || 
            txClean.includes(normalizedTerm) || 
            contribName.includes(normalizedTerm) ||
            contribClean.includes(normalizedTerm) ||
            churchName.includes(normalizedTerm)
        ) {
            matchFound = true;
        }

        if (!matchFound) {
            const dateStrings = [record.transaction.date, record.contributor?.date].filter(Boolean) as string[];
            if (term.includes('/') || term.includes('-')) {
                if (dateStrings.some(d => d.includes(term))) matchFound = true;
            } else {
                if (dateStrings.some(d => d.includes(term) || d.replace(/[^0-9]/g, '').includes(term))) matchFound = true;
            }
        }

        if (!matchFound && /\d/.test(term)) {
            const potentials = getPotentialAmounts(term);
            const txAmount = Math.abs(record.transaction.amount);
            const contribAmount = record.contributorAmount ? Math.abs(record.contributorAmount) : (record.contributor?.amount ? Math.abs(record.contributor.amount) : 0);

            const isNumericMatch = potentials.some(val => 
                Math.abs(txAmount - val) < 0.01 || 
                (contribAmount > 0 && Math.abs(contribAmount - val) < 0.01)
            );

            const amountStrings = [
                record.transaction.originalAmount,
                record.contributor?.originalAmount,
                record.transaction.amount.toString(),
                record.transaction.amount.toFixed(2),
                record.transaction.amount.toFixed(2).replace('.', ',')
            ].filter(Boolean) as string[];

            const isStringMatch = amountStrings.some(s => s.includes(term));
            if (isNumericMatch || isStringMatch) matchFound = true;
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

export const parseDate = (dateString: string): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;
    const trimmed = dateString.trim();
    
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(trimmed)) {
        const isoDate = new Date(trimmed);
        if (!isNaN(isoDate.getTime())) return new Date(Date.UTC(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate()));
    }

    const parts = trimmed.match(/(\d+)/g);
    if (!parts || parts.length < 2) return null;
    
    let day, month, year;
    if (parts.length === 2) {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = new Date().getFullYear();
    } else {
        if (parts[0].length === 4) { [year, month, day] = parts.map(p => parseInt(p, 10)); }
        else { [day, month, year] = parts.map(p => parseInt(p, 10)); if (String(year).length === 2) year += (year < 50 ? 2000 : 1900); }
    }
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    const date = new Date(Date.UTC(year, month - 1, day));
    return (!isNaN(date.getTime())) ? date : null;
};

const isDateString = (s: string): boolean => parseDate(s) !== null;

const isAmountString = (s: string): boolean => {
    if (!s || typeof s !== 'string') return false;
    if (isDateString(s)) return false;
    if (!/\d/.test(s)) return false;
    const val = parseAmountString(s);
    return !isNaN(val) && val !== 0;
};

const isProbablyName = (s: string): boolean => {
    if (!s || typeof s !== 'string') return false;
    const clean = s.trim();
    if (clean.length < 3) return false;
    if (isDateString(clean)) return false;
    if (isAmountString(clean)) return false;
    
    const hasLetters = /[a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/.test(clean);
    if (!hasLetters) return false;

    // Se tiver muitos underscores ou caracteres especiais de código, provavelmente não é um nome
    if ((clean.match(/[_]/g) || []).length > 1) return false;

    const numDigits = (clean.match(/\d/g) || []).length;
    // Permite nomes com códigos, mas não colunas que sejam majoritariamente números
    if (numDigits > clean.length * 0.7) return false; 
    
    return true;
};

const parseAmountString = (s: string): number => {
    if (!s) return 0;
    let cleanS = s.toString().trim();
    
    let isNegative = /^[\(-]/.test(cleanS) || /[\)-]$/.test(cleanS) || /\b(D|Db|Dr|Débito|Debito)\b/i.test(cleanS);
    let cleaned = cleanS.replace(/[R$BRL\s]/gi, '').replace(/[^\d.,-]/g, '');

    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    let parsableString;
    if (lastComma > -1 && lastDot > -1) {
        parsableString = (lastComma > lastDot) ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
    } else if (lastComma > -1) {
        parsableString = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        parsableString = cleaned;
    }

    const value = parseFloat(parsableString);
    if (isNaN(value)) return 0;
    return isNegative ? -Math.abs(value) : Math.abs(value);
};

const detectDelimiter = (content: string): string => {
    const delimiters = [',', ';', '\t'];
    const lines = content.split('\n').slice(0, 10);
    let bestDelimiter = ',';
    let maxCount = 0;
    for (const delimiter of delimiters) {
        let totalCount = 0;
        for (const line of lines) totalCount += line.split(delimiter).length - 1;
        if (totalCount > maxCount) { maxCount = totalCount; bestDelimiter = delimiter; }
    }
    return bestDelimiter;
};

const splitCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (insideQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else insideQuotes = !insideQuotes;
        } else if (char === delimiter && !insideQuotes) {
            result.push(current);
            current = '';
        } else current += char;
    }
    result.push(current);
    return result;
};

/**
 * Motor Inteligente que identifica colunas pelo padrão do conteúdo e densidade.
 */
const intelligentCSVParser = <T>(
    content: string,
    fieldHeuristics: { field: keyof T; checker: (s: string) => boolean }[]
): T[] => {
    const delimiter = detectDelimiter(content);
    let allRows = content
        .replace(/\r/g, '')
        .split('\n')
        .map(line => splitCSVLine(line, delimiter))
        .filter(r => r.length > 1);

    if (allRows.length < 1) return [];

    const firstRow = allRows[0];
    const firstRowIsData = firstRow.some(cell => isDateString(cell) || isAmountString(cell));
    const dataRows = firstRowIsData ? allRows : allRows.slice(1);

    const sampleRows = dataRows.slice(0, 50);
    const numCols = Math.max(...allRows.map(r => r.length));

    const colStats = Array.from({ length: numCols }, () => ({
        dateCount: 0,
        amountCount: 0,
        textCount: 0,
        totalTextLen: 0,
        totalWordCount: 0,
        totalAbsValue: 0,
        valueCount: 0,
        underscoreCount: 0
    }));

    sampleRows.forEach(row => {
        row.forEach((cell, i) => {
            if (i >= numCols) return;
            const val = cell.trim();
            if (!val) return;

            if (isDateString(val)) colStats[i].dateCount++;
            if (isAmountString(val)) {
                colStats[i].amountCount++;
                const num = Math.abs(parseAmountString(val));
                if (num > 0) { colStats[i].totalAbsValue += num; colStats[i].valueCount++; }
            }
            if (isProbablyName(val)) {
                colStats[i].textCount++;
                colStats[i].totalTextLen += val.length;
                colStats[i].totalWordCount += val.split(/\s+/).filter(w => w.length > 1).length;
            }
            if (val.includes('_')) colStats[i].underscoreCount++;
        });
    });

    const fieldMap: Partial<Record<keyof T, number>> = {};
    const usedIndices = new Set<number>();

    // 1. Identificar DATA (Maior frequência de datas válidas)
    const dateCandidates = colStats
        .map((s, i) => ({ i, score: s.dateCount }))
        .sort((a, b) => b.score - a.score);
    if (dateCandidates[0].score > 0) {
        fieldMap['date' as keyof T] = dateCandidates[0].i;
        usedIndices.add(dateCandidates[0].i);
    }

    // 2. Identificar VALOR (Regra do Menor Valor Médio para evitar a coluna de Saldo)
    const amountCandidates = colStats
        .map((s, i) => ({ i, score: s.amountCount, avg: s.valueCount > 0 ? s.totalAbsValue / s.valueCount : Infinity }))
        .filter(c => c.score > (sampleRows.length * 0.2) && !usedIndices.has(c.i))
        .sort((a, b) => {
            if (Math.abs(a.score - b.score) < 5) return a.avg - b.avg;
            return b.score - a.score;
        });

    if (amountCandidates.length > 0) {
        fieldMap['amount' as keyof T] = amountCandidates[0].i;
        usedIndices.add(amountCandidates[0].i);
    }

    // 3. Identificar NOME/DESCRIÇÃO (Regra de DENSIDADE DE TEXTO)
    // Se houver múltiplas colunas de texto (ex: Descrição vs Documento), escolhemos a mais rica em palavras reais.
    const textCandidates = colStats
        .map((s, i) => {
            // Penaliza colunas com muitos underscores (comum em códigos de documento como PIX_CRED)
            const underscorePenalty = s.underscoreCount * 2;
            const richness = s.textCount > 0 ? (s.totalWordCount / s.textCount) + (s.totalTextLen / s.textCount / 10) - (underscorePenalty / s.textCount) : 0;
            return { i, score: s.textCount, richness };
        })
        .filter(c => !usedIndices.has(c.i))
        .sort((a, b) => b.richness - a.richness); 

    const nameField = fieldHeuristics.find(h => h.field === 'name' || h.field === 'description')?.field;
    if (nameField && textCandidates.length > 0) {
        fieldMap[nameField] = textCandidates[0].i;
        usedIndices.add(textCandidates[0].i);
    }

    // 4. Mapear CPF ou restantes
    fieldHeuristics.forEach(h => {
        if (fieldMap[h.field] !== undefined) return;
        const candidates = colStats
            .map((s, i) => ({ i, score: h.checker ? s.textCount : 0 }))
            .filter(c => !usedIndices.has(c.i))
            .sort((a, b) => b.score - a.score);
        if (candidates.length > 0 && candidates[0].score > 0) {
            fieldMap[h.field] = candidates[0].i;
            usedIndices.add(candidates[0].i);
        }
    });

    return dataRows.map(row => {
        const entry = {} as T;
        let hasContent = false;
        for (const field in fieldMap) {
            const idx = fieldMap[field as keyof T];
            if (idx === undefined) continue;
            const raw = (row[idx] || '').trim();
            if (raw) hasContent = true;
            if (field === 'amount') {
                (entry as any)['amount'] = parseAmountString(raw);
                (entry as any)['originalAmount'] = raw;
            } else { (entry as any)[field] = raw; }
        }
        return hasContent ? entry : null;
    }).filter(e => e !== null) as T[];
};

export const parseBankStatement = (content: string, customIgnoreKeywords: string[] = []): Transaction[] => {
    const heuristics = [
        { field: 'date' as keyof Transaction, checker: isDateString },
        { field: 'amount' as keyof Transaction, checker: isAmountString },
        { field: 'description' as keyof Transaction, checker: isProbablyName },
    ];
    const raw = intelligentCSVParser<Transaction>(content, heuristics);
    const ignoreRegex = createIgnoreRegex(customIgnoreKeywords);

    return raw
        .filter(t => isDateString(t.date) && t.amount !== 0)
        .map((t, i) => ({ 
            ...t, 
            id: `tx-${i}`,
            cleanedDescription: cleanTransactionDescriptionForDisplay(t.description || '---', ignoreRegex),
        }));
};

export const parseContributors = (content: string, customIgnoreKeywords: string[] = []): Contributor[] => {
    const heuristics = [
        { field: 'name' as keyof Contributor, checker: isProbablyName },
        { field: 'date' as keyof Contributor, checker: isDateString },
        { field: 'amount' as keyof Contributor, checker: isAmountString },
        { field: 'cpf' as keyof Contributor, checker: (s: string) => /^\d{3}/.test(s) }
    ];
    const raw = intelligentCSVParser<Contributor>(content, heuristics);
    const ignoreRegex = createIgnoreRegex(customIgnoreKeywords);

    return raw
        .filter(c => (c as any).name)
        .map((c, i) => ({
            ...c,
            id: `contrib-${i}`,
            name: c.name || '---',
            cleanedName: cleanTransactionDescriptionForDisplay(c.name || '---', ignoreRegex), 
            normalizedName: normalizeString(c.name || '', ignoreRegex),
        }));
};

// --- Matching Logic ---

const removeNumericCodes = (text: string): string => {
    // Remove apenas sequências numéricas longas típicas de IDs ou CPFs (>= 6 dígitos)
    // Preserva pequenos números que podem fazer parte do nome ou endereço.
    const longDigitsRegex = /\b\d{6,}\b/g;
    const symbolsRegex = /[*]{2,}/g; 
    return text.replace(longDigitsRegex, '').replace(symbolsRegex, '').trim();
};

const createIgnoreRegex = (keywords: string[]): RegExp | null => {
    if (!keywords || keywords.length === 0) return null;
    const sorted = [...keywords].sort((a, b) => b.length - a.length);
    const pattern = sorted.filter(k => k.trim().length > 0).map(k => k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return pattern ? new RegExp(`\\b(${pattern})\\b`, 'gi') : null;
}

export const normalizeString = (str: string, ignoreRegexOrKeywords: RegExp | string[] | null = null): string => {
    if (!str) return '';
    let normalized = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (ignoreRegexOrKeywords) {
        const regex = ignoreRegexOrKeywords instanceof RegExp ? ignoreRegexOrKeywords : createIgnoreRegex(ignoreRegexOrKeywords);
        if (regex) normalized = normalized.replace(regex, '');
    }
    
    normalized = removeNumericCodes(normalized);
    return normalized.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

export const cleanTransactionDescriptionForDisplay = (description: string, ignoreRegexOrKeywords: RegExp | string[] | null = null): string => {
    if (!description) return '';
    let cleaned = description;
    
    if (ignoreRegexOrKeywords) {
        const regex = ignoreRegexOrKeywords instanceof RegExp ? ignoreRegexOrKeywords : createIgnoreRegex(ignoreRegexOrKeywords);
        if (regex) cleaned = cleaned.replace(regex, '');
    }
    
    cleaned = removeNumericCodes(cleaned);
    return cleaned.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
};

export const calculateNameSimilarity = (description: string, contributor: Contributor, ignoreRegexOrKeywords: RegExp | string[] | null = null): number => {
    const normalizedDesc = normalizeString(description, ignoreRegexOrKeywords);
    const normalizedContrib = contributor.normalizedName || normalizeString(contributor.name, ignoreRegexOrKeywords);
    if (!normalizedDesc || !normalizedContrib) return 0;
    const descWords = new Set(normalizedDesc.split(' ').filter(Boolean));
    const contribWords = new Set(normalizedContrib.split(' ').filter(Boolean));
    if (descWords.size === 0 || contribWords.size === 0) return 0;
    const intersection = new Set([...descWords].filter(word => contribWords.has(word)));
    return (2 * intersection.size) / (descWords.size + contribWords.size) * 100;
};

const daysDifference = (date1: Date, date2: Date): number => {
    const timeDiff = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

export const matchTransactions = (
    transactions: Transaction[],
    contributorFiles: ContributorFile[],
    options: { similarityThreshold: number; dayTolerance: number; },
    learnedAssociations: LearnedAssociation[],
    churches: Church[],
    customIgnoreKeywords: string[] = []
): MatchResult[] => {
    const ignoreRegex = createIgnoreRegex(customIgnoreKeywords);
    const allContributors = contributorFiles.flatMap(file =>
        file.contributors.map((c, index) => ({ ...c, id: c.id || `contrib-${file.church.id}-${index}`, church: file.church }))
    );

    const learnedMap = new Map(learnedAssociations.map(la => [la.normalizedDescription, la]));
    const finalResults: MatchResult[] = [];
    const matchedTransactionIds = new Set<string>();
    const matchedContributorIds = new Set<string>();

    transactions.forEach(transaction => {
        const normalizedDesc = normalizeString(transaction.description, ignoreRegex);
        const learnedMatch = learnedMap.get(normalizedDesc);
        if (learnedMatch) {
            const contributor = allContributors.find(c => c.normalizedName === learnedMatch.contributorNormalizedName && !matchedContributorIds.has(c.id!));
            if (contributor) {
                finalResults.push({ transaction, contributor, status: 'IDENTIFICADO', church: contributor.church, matchMethod: 'LEARNED', similarity: 100, contributorAmount: contributor.amount });
                matchedTransactionIds.add(transaction.id);
                matchedContributorIds.add(contributor.id!);
            }
        }
    });

    const potentialMatches: { transaction: Transaction; contributor: Contributor & { church: Church }; score: number; }[] = [];
    const availableTransactions = transactions.filter(t => !matchedTransactionIds.has(t.id));
    const availableContributors = allContributors.filter(c => c.id! && !matchedContributorIds.has(c.id!));
    const contributorWordSets = availableContributors.map(c => ({ id: c.id, contributor: c, words: new Set((c.normalizedName || normalizeString(c.name, ignoreRegex)).split(' ').filter(w => w.length > 0)) }));

    for (const transaction of availableTransactions) {
        const txWords = new Set(normalizeString(transaction.description, ignoreRegex).split(' ').filter(w => w.length > 0));
        if (txWords.size === 0) continue;
        for (const { contributor, words: contribWords } of contributorWordSets) {
            if (contribWords.size === 0) continue;
            let intersectionSize = 0;
            const smaller = txWords.size < contribWords.size ? txWords : contribWords;
            const larger = txWords.size < contribWords.size ? contribWords : txWords;
            for (const word of smaller) if (larger.has(word)) intersectionSize++;
            const nameScore = (2 * intersectionSize) / (txWords.size + contribWords.size) * 100;
            if (nameScore >= options.similarityThreshold) {
                const txDate = parseDate(transaction.date);
                const contribDate = contributor.date ? parseDate(contributor.date) : null;
                if (txDate && contribDate && daysDifference(txDate, contribDate) > options.dayTolerance) continue; 
                potentialMatches.push({ transaction, contributor, score: nameScore });
            }
        }
    }

    potentialMatches.sort((a, b) => b.score - a.score);
    for (const match of potentialMatches) {
        if (match.contributor.id && !matchedTransactionIds.has(match.transaction.id) && !matchedContributorIds.has(match.contributor.id)) {
            let divergence: MatchResult['divergence'] | undefined = undefined;
            if (match.contributor.normalizedName) {
                const la = learnedAssociations.find(l => l.contributorNormalizedName === match.contributor.normalizedName);
                if (la && la.churchId !== match.contributor.church.id) {
                    const expected = churches.find(c => c.id === la.churchId);
                    if (expected) { divergence = { type: 'CHURCH_MISMATCH', expectedChurch: expected, actualChurch: match.contributor.church }; Metrics.increment('divergences'); }
                }
            }
            finalResults.push({ transaction: match.transaction, contributor: match.contributor, status: 'IDENTIFICADO', church: match.contributor.church, matchMethod: 'AUTOMATIC', similarity: match.score, contributorAmount: match.contributor.amount, divergence });
            matchedTransactionIds.add(match.transaction.id);
            matchedContributorIds.add(match.contributor.id);
        }
    }

    transactions.forEach(t => { if (!matchedTransactionIds.has(t.id)) finalResults.push({ transaction: t, contributor: null, status: 'NÃO IDENTIFICADO', church: PLACEHOLDER_CHURCH }); });
    allContributors.forEach(c => {
        if (c.id && !matchedContributorIds.has(c.id)) {
            finalResults.push({
                transaction: { id: `pending-${c.id}`, date: c.date || 'N/A', description: `[Pendente] ${c.name}`, amount: 0, cleanedDescription: `[Pendente] ${c.cleanedName || c.name}`, originalAmount: c.originalAmount },
                contributor: c, status: 'NÃO IDENTIFICADO', church: c.church, contributorAmount: c.amount,
            });
        }
    });

    return finalResults;
};

export const processExpenses = (expenseTransactions: Transaction[]): MatchResult[] => expenseTransactions.map(t => ({ transaction: t, contributor: null, status: 'NÃO IDENTIFICADO', church: PLACEHOLDER_CHURCH }));
export const groupResultsByChurch = (results: MatchResult[]): GroupedReportData => {
    const grouped: GroupedReportData = {};
    if (!Array.isArray(results)) return grouped;
    for (const result of results) {
        if (!result) continue;
        const key = result.church?.id || 'unidentified';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(result);
    }
    return grouped;
};
