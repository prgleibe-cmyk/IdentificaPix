import { Transaction, Contributor, MatchResult, ContributorFile, Church, LearnedAssociation } from '../types';
import { Logger } from './monitoringService';

// --- Centralized Constants ---

export const PLACEHOLDER_CHURCH: Church = {
    id: 'unidentified',
    name: '---', // This name is for internal reference; the UI should use a translated string.
    address: '',
    logoUrl: '',
    pastor: '',
};

// --- Intelligent Search Filtering ---

/**
 * Filters a MatchResult record based on a universal query string.
 * The query is split into terms, and all terms must match something in the record.
 * A term can match a date, an exact value, or text in the name/description.
 * @param record The MatchResult to check.
 * @param query The user's search query.
 * @returns True if the record matches the query, false otherwise.
 */
export const filterByUniversalQuery = (record: MatchResult, query: string): boolean => {
    const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (searchTerms.length === 0) {
        return true;
    }

    const { transaction, contributor } = record;

    // All search terms must match something in the record
    return searchTerms.every(term => {
        // Attempt to parse term as a number for value matching
        const numericValue = parseFloat(term.replace(',', '.'));
        const isNumericTerm = !isNaN(numericValue);

        // 1. Check for exact value match
        if (isNumericTerm && transaction.amount === numericValue) {
            return true;
        }

        // 2. Check for date match (partial or full)
        if (transaction.date.includes(term)) {
            return true;
        }

        // 3. Check for text match in description or name
        if ((contributor?.name || '').toLowerCase().includes(term) ||
            (contributor?.cleanedName || '').toLowerCase().includes(term) ||
            transaction.description.toLowerCase().includes(term)) {
            return true;
        }
        
        return false;
    });
};

/**
 * A variation of the universal filter for raw Transaction objects.
 * @param transaction The Transaction to check.
 * @param query The user's search query.
 * @returns True if the transaction matches the query, false otherwise.
 */
export const filterTransactionByUniversalQuery = (transaction: Transaction, query: string): boolean => {
    const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (searchTerms.length === 0) {
        return true;
    }
    
    return searchTerms.every(term => {
        const numericValue = parseFloat(term.replace(',', '.'));
        const isNumericTerm = !isNaN(numericValue);

        if (isNumericTerm && transaction.amount === numericValue) {
            return true;
        }
        if (transaction.date.includes(term)) {
            return true;
        }
        if (transaction.description.toLowerCase().includes(term)) {
            return true;
        }
        
        return false;
    });
};


// --- Intelligent Parsing Helpers ---

const isDateString = (s: string): boolean => {
    if (!s) return false;
    // Matches dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, etc.
    const dateRegex = /^(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})$/;
    return dateRegex.test(s.trim());
};

const isAmountString = (s: string): boolean => {
    if (!s) return false;
    // Check for numbers, currency symbols, commas, periods.
    // It's a potential amount if it contains at least one digit.
    return /\d/.test(s) && /^[R$BRL\s.,0-9-]+$/.test(s.trim());
};

/**
 * A highly robust heuristic to determine if a string from any file column is likely a person's name.
 * This version is much stricter to prevent misidentification of description columns.
 * It works by first rejecting any string with transactional keywords, then cleaning and
 * validating the rest.
 * @param s The string to check.
 * @returns True if the string is probably a name.
 */
const isProbablyName = (s: string): boolean => {
    if (!s || typeof s !== 'string') return false;
    const workingString = s.trim();

    // Early exit for obviously wrong data
    if (workingString.length < 2 || workingString.length > 150) return false;
    if (/[<>{}\[\]]/.test(workingString)) return false; // Reject HTML/code like structures
    if (isDateString(workingString)) return false; // It's a date, not a name

    const lowerWorkingString = workingString.toLowerCase();
    
    // A set of keywords that, if a string consists ONLY of them, it's not a name.
    // This prevents columns like "Dízimos" or "Missões" from being flagged as name columns.
    const nonNameKeywords = new Set([
        'pix', 'ted', 'doc', 'cpf', 'cnpj', 'valor', 'data', 'extrato', 'conta', 'agencia', 'id',
        'transf', 'recebimento', 'pagamento', 'deposito', 'dizimo', 'dizimos', 'oferta', 'ofertas',
        'doacao', 'doacoes', 'taxa', 'juros', 'tarifa', 'imposto', 'missao', 'missoes', 'terreno',
        'sede', 'contribuicao', 'sr', 'sra', 'dr', 'dra'
    ]);

    const potentialNameParts = lowerWorkingString
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z\s]/g, '')        // remove non-alpha and numbers
        .trim()
        .split(' ')
        .filter(w => w.length > 1);      // filter out single letters and empty strings

    if (potentialNameParts.length === 0) {
        return false;
    }
    
    // If the string consists solely of one or more non-name keywords, it's not a name.
    // e.g., "dizimo", "dizimos e ofertas"
    const isOnlyKeywords = potentialNameParts.every(part => nonNameKeywords.has(part));
    if (isOnlyKeywords) {
        return false;
    }

    // Now we clean the rest of the noise to see if a name is left.
    const cleanedForCheck = lowerWorkingString
        // Remove number patterns that might look like IDs or codes
        .replace(/\d{2,3}\.?\d{3}\.?\d{3}[/-]?\d{2,4}-?\d{2}/g, '')
        // Remove any remaining numbers
        .replace(/[0-9]/g, '')
        // Remove symbols, keeping only letters and spaces
        .replace(/[^a-z\sÀ-ÿ]/gi, '')
        .trim();

    // After cleaning, is there anything left that looks like a name?
    if (cleanedForCheck.length < 2) return false;

    // Add a check on the number of words. A name is unlikely to be a long sentence.
    const wordCount = cleanedForCheck.split(' ').filter(w => w.length > 0).length;
    if (wordCount > 7) {
        return false;
    }

    // It must contain at least one word with two or more letters.
    if (!/[a-zA-ZÀ-ÿ]{2,}/.test(cleanedForCheck)) return false;
    
    // Final sanity check: If the original string looked like a currency amount,
    // and we removed most of it, it's probably not a name.
    if (isAmountString(workingString) && cleanedForCheck.length < workingString.length / 2) {
        return false;
    }

    return true;
};


/**
 * Parses a string that represents a monetary value into a number.
 * This robust version handles common international and Brazilian currency formats
 * by detecting the likely decimal separator.
 * @param s The string to parse.
 * @returns The parsed number, or NaN if parsing fails.
 */
const parseAmountString = (s: string): number => {
    if (!s) return NaN;
    const cleaned = s
        .replace(/[R$BRL\s]/gi, '')   // Remove currency symbols and whitespace
    
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    let parsableString;
    // If both exist, the last one is likely the decimal separator
    if (lastComma > -1 && lastDot > -1) {
        if (lastComma > lastDot) {
            // Format is likely 1.234,56
            parsableString = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            // Format is likely 1,234.56
            parsableString = cleaned.replace(/,/g, '');
        }
    }
    // If only comma exists, it's the decimal
    else if (lastComma > -1) {
        parsableString = cleaned.replace(',', '.');
    }
    // If only dot exists, or none, it's already in the right format
    else {
        parsableString = cleaned;
    }

    const value = parseFloat(parsableString);
    return isNaN(value) ? NaN : value;
};

/**
 * Calculates basic statistics for an array of numbers.
 * @param values An array of numbers.
 * @returns An object containing the mean and standard deviation.
 */
const calculateStats = (values: number[]): { mean: number; stdDev: number } => {
    const n = values.length;
    if (n === 0) return { mean: 0, stdDev: 0 };

    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / n;

    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    return { mean, stdDev };
};


/**
 * Automatically detects the most likely delimiter (comma, semicolon, or tab) in a text block.
 * It favors the delimiter that appears most consistently across the first few lines.
 * @param content The raw string content of the file.
 * @returns The detected delimiter character.
 */
const detectDelimiter = (content: string): string => {
    const delimiters = [',', ';', '\t'];
    const lines = content.trim().split('\n').slice(0, 10); // Sample first 10 lines
    if (lines.length === 0) return ',';

    const scores: Record<string, { count: number, consistency: number }> = {
        ',': { count: 0, consistency: 0 },
        ';': { count: 0, consistency: 0 },
        '\t': { count: 0, consistency: 0 },
    };

    for (const delimiter of delimiters) {
        let totalCount = 0;
        const countsPerLine: number[] = [];
        for (const line of lines) {
            // Use a simple split to count, which is faster than regex for this case.
            const count = line.split(delimiter).length - 1;
            if (count > 0) {
                countsPerLine.push(count);
                totalCount += count;
            }
        }
        
        if (countsPerLine.length === 0) continue;

        scores[delimiter].count = totalCount;
        
        const mean = totalCount / countsPerLine.length;
        const variance = countsPerLine.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / countsPerLine.length;
        
        // A lower variance means higher consistency.
        scores[delimiter].consistency = 1 / (variance + 1);
    }

    let bestDelimiter = ',';
    let maxScore = 0;

    for (const delimiter of delimiters) {
        // A good delimiter has a high count and high consistency.
        const score = scores[delimiter].count * scores[delimiter].consistency;
        if (score > maxScore) {
            maxScore = score;
            bestDelimiter = delimiter;
        }
    }
    
    return bestDelimiter;
};


/**
 * Parses CSV/text content without relying on header names. It analyzes the content
 * of each column to determine its data type (date, amount, name) and automatically
 * detects the delimiter. If multiple columns look like amounts, it intelligently
 * chooses the one most likely to be transaction data.
 * @param content The raw string content of the file.
 * @param fieldHeuristics An array of rules to identify columns.
 * @param requiredField The key field used to validate if a row is data vs. a header.
 * @returns An array of parsed objects.
 */
const intelligentCSVParser = <T>(
    content: string,
    fieldHeuristics: { field: keyof T; checker: (s: string) => boolean; isTextual?: boolean }[],
    requiredField: keyof T
): T[] => {
    const delimiter = detectDelimiter(content);
    const allRows = content
        .trim()
        .replace(/\r/g, '')
        .split('\n')
        .map(line => line.split(delimiter).map(cell => cell.trim()));

    if (allRows.length < 2) return [];

    const numColumns = allRows[0]?.length || 0;
    if (numColumns === 0) return [];

    const sampleRows = allRows.slice(0, 30); // Use a larger sample for better accuracy

    // --- Column Content Analysis for diversity ---
    const columnAnalysis = Array(numColumns).fill(0).map((_, colIndex) => {
        const values = sampleRows.map(row => row[colIndex]?.trim() || '').filter(Boolean);
        if (values.length < 3) return { mostCommonRatio: 0 }; // Not enough data to analyze

        const valueCounts = values.reduce((acc, val) => {
            const lowerVal = val.toLowerCase();
            acc[lowerVal] = (acc[lowerVal] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const mostCommonCount = Math.max(...Object.values(valueCounts));
        return { mostCommonRatio: mostCommonCount / values.length };
    });

    // --- Column Scoring Logic ---
    const columnScores = Array(numColumns).fill(0).map(() => {
        const scores: Record<string, number> = {};
        fieldHeuristics.forEach(h => scores[h.field as string] = 0);
        return scores;
    });

    for (const row of sampleRows) {
        if (row.length !== numColumns) continue;
        for (let i = 0; i < numColumns; i++) {
            const cell = row[i] || '';
            fieldHeuristics.forEach(heuristic => {
                if (heuristic.checker(cell)) {
                    columnScores[i][heuristic.field as string]++;
                }
            });
        }
    }

    // --- Disqualify columns based on content analysis ---
    fieldHeuristics.forEach(({ field }) => {
        columnScores.forEach((scores, index) => {
            // Only penalize if it was a candidate
            if (scores[field as string] > 0) {
                const analysis = columnAnalysis[index];
                // If a 'name' column has >60% identical values, it's likely a description/type column.
                if (field === 'name' && analysis.mostCommonRatio > 0.60) {
                    scores[field as string] = 0;
                }
                // If an 'amount' column has >80% identical values, it's likely a fee, total, or irrelevant number column.
                if (field === 'amount' && analysis.mostCommonRatio > 0.80) {
                    scores[field as string] = 0;
                }
            }
        });
    });


    // A column must have at least this many matching cells in the sample to be considered.
    const confidenceThreshold = Math.max(2, Math.floor(sampleRows.length * 0.25));

    // --- Find all valid candidate columns for each field ---
    const candidateColumns: Record<string, { index: number; score: number }[]> = {};
    fieldHeuristics.forEach(({ field }) => {
        candidateColumns[field as string] = [];
        columnScores.forEach((scores, index) => {
            if (scores[field as string] >= confidenceThreshold) {
                candidateColumns[field as string].push({ index, score: scores[field as string] });
            }
        });
        candidateColumns[field as string].sort((a, b) => b.score - a.score);
    });

    // --- Special Heuristic for Amount Column ---
    const amountCandidates = candidateColumns['amount'] || [];
    if (amountCandidates.length > 1) {
        const columnStats = amountCandidates.map(candidate => {
            const values = allRows
                .map(row => (row.length > candidate.index ? parseAmountString(row[candidate.index]) : NaN))
                .filter(v => !isNaN(v) && v !== 0) // Only use valid, non-zero numbers for stats
                .map(Math.abs); // Use absolute values

            if (values.length < 2) {
                 return { index: candidate.index, score: 0 };
            }
            
            const { mean, stdDev } = calculateStats(values);
            const score = stdDev / (mean + 1e-6); 

            return { index: candidate.index, score };
        });

        const bestAmountCandidate = columnStats.sort((a, b) => b.score - a.score)[0];
        
        if (bestAmountCandidate) {
            candidateColumns['amount'] = [{ index: bestAmountCandidate.index, score: Infinity }]; // Promote it
        }
    }

    // --- Strict Column Mapping: Resolve Mappings, ignoring discarded columns ---
    const fieldMap: Partial<Record<keyof T, number>> = {};
    const usedIndices = new Set<number>();
    
    const sortedFields = fieldHeuristics
        .map(h => h.field as string)
        .sort((a, b) => {
            if (a === 'amount') return -1;
            if (b === 'amount') return 1;
            const isAText = fieldHeuristics.find(h => h.field as string === a)?.isTextual;
            const isBText = fieldHeuristics.find(h => h.field as string === b)?.isTextual;
            return (isAText ? 1 : 0) - (isBText ? 1 : 0);
        });

    sortedFields.forEach(field => {
        const candidates = candidateColumns[field] || [];
        for (const candidate of candidates) {
            if (!usedIndices.has(candidate.index)) {
                fieldMap[field as keyof T] = candidate.index;
                usedIndices.add(candidate.index);
                break;
            }
        }
    });

    // --- Data Extraction & Header Filtering ---
    const parsedData = allRows.map(row => {
        const entry = {} as T;
        if (row.length !== numColumns) return null;

        for (const key in fieldMap) {
            const typedKey = key as keyof T;
            const colIndex = fieldMap[typedKey];
            if (colIndex === undefined) continue;

            const value = row[colIndex] || '';
            (entry as any)[typedKey] = (typedKey === 'amount') ? parseAmountString(value) : value;
        }
        return entry;
    }).filter(entry => entry !== null) as T[];

    // Filter out rows that are likely headers
    return parsedData.filter(entry => {
        if (!entry || !entry[requiredField]) return false;
        const value = entry[requiredField];
        if (requiredField === 'amount') {
            return !isNaN(value as number);
        }
        if (requiredField === 'name') {
            return isProbablyName(value as string);
        }
        return true;
    });
};


export const parseBankStatement = (content: string, customIgnoreKeywords: string[] = []): Transaction[] => {
    const heuristics = [
        { field: 'date' as keyof Transaction, checker: isDateString },
        { field: 'amount' as keyof Transaction, checker: isAmountString },
        { field: 'description' as keyof Transaction, checker: (s: string) => /[a-zA-Z]/.test(s) && s.length > 3, isTextual: true },
    ];
    
    const transactions = intelligentCSVParser<Transaction>(content, heuristics, 'amount');

    return transactions
        .filter(t => t.amount !== 0 && !isNaN(t.amount)) // Filter out zero or invalid amounts
        .map((t, index) => ({ 
            ...t, 
            id: `tx-${Date.now()}-${index}`,
            cleanedDescription: cleanTransactionDescriptionForDisplay(t.description, customIgnoreKeywords),
        }));
};

/**
 * Analyzes a list of raw contributor entries to dynamically identify recurring non-name keywords.
 * It looks for frequently occurring first words that are not common Portuguese names.
 * @param contributors Raw contributor data from the parser.
 * @returns An array of detected keywords to be ignored.
 */
const detectDynamicKeywords = (contributors: Contributor[]): string[] => {
    const frequencyThreshold = 5; // A word must appear more than 5 times to be considered a keyword.
    const minKeywordLength = 3; // Keywords must be longer than 3 characters.

    // A small, non-exhaustive list to prevent common first names from being flagged.
    const commonFirstNames = new Set([
        'jose', 'joao', 'antonio', 'francisco', 'carlos', 'paulo', 'pedro', 'lucas', 'luiz', 'marcos',
        'maria', 'ana', 'francisca', 'antonia', 'adriana', 'juliana', 'marcia', 'fernanda', 'patricia', 'aline'
    ]);

    const wordCounts: Record<string, number> = {};

    for (const contributor of contributors) {
        if (!contributor.name || typeof contributor.name !== 'string') continue;

        const name = contributor.name.trim().toLowerCase();
        const firstWordMatch = name.match(/^[a-zà-ÿ]+/); // Get the first word
        
        if (firstWordMatch) {
            const word = firstWordMatch[0]
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, ""); // Normalize for counting
            
            if (word.length > minKeywordLength && !commonFirstNames.has(word)) {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            }
        }
    }
    
    // Filter for words that exceed the frequency threshold.
    const detectedKeywords = Object.keys(wordCounts).filter(word => wordCounts[word] > frequencyThreshold);

    if (detectedKeywords.length > 0) {
        Logger.info('Dynamically detected keywords to ignore', { keywords: detectedKeywords });
    }

    return detectedKeywords;
};


export const parseContributors = (content: string, customIgnoreKeywords: string[] = []): Contributor[] => {
    const heuristics = [
        { field: 'name' as keyof Contributor, checker: isProbablyName, isTextual: true },
        { field: 'date' as keyof Contributor, checker: isDateString },
        { field: 'amount' as keyof Contributor, checker: isAmountString },
        { field: 'cpf' as keyof Contributor, checker: (s: string) => /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(s.trim()) }
    ];

    const contributors = intelligentCSVParser<Contributor>(content, heuristics, 'name');

    // --- Dynamic Keyword Detection ---
    const autoDetectedKeywords = detectDynamicKeywords(contributors);
    const finalKeywords = [...new Set([...customIgnoreKeywords, ...autoDetectedKeywords])];
    
    // --- Post-parsing cleanup ---
    // 1. Filter out contributors with zero, negative, or NaN amounts
    let cleanedContributors = contributors.filter(c => c.amount === undefined || (!isNaN(c.amount) && c.amount > 0));

    // 2. Count name occurrences for frequency filtering
    const nameCounts = cleanedContributors.reduce((acc, contributor) => {
        const normalizedName = normalizeString(contributor.name, finalKeywords);
        if (normalizedName) {
            acc[normalizedName] = (acc[normalizedName] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    // 3. Identify names that appear more than 10 times
    const namesToRemove = new Set(Object.keys(nameCounts).filter(name => nameCounts[name] > 10));

    // 4. Filter out the overly frequent names
    if (namesToRemove.size > 0) {
        cleanedContributors = cleanedContributors.filter(c => {
            const normalizedName = normalizeString(c.name, finalKeywords);
            return !namesToRemove.has(normalizedName);
        });
    }

    return cleanedContributors
        .filter(c => c.name)
        .map((c, index) => ({
            ...c,
            id: `contrib-${Date.now()}-${index}`,
            cleanedName: cleanTransactionDescriptionForDisplay(c.name, finalKeywords),
            normalizedName: normalizeString(c.name, finalKeywords),
        }));
};


// --- Matching Logic ---

/**
 * Converts a string to Title Case, respecting common Portuguese conjunctions.
 * @param str The string to convert.
 * @returns The Title Cased string.
 */
const toTitleCase = (str: string): string => {
    if (!str) return '';
    const exceptions = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'a', 'o', 'em', 'para', 'com', 'por']);
    return str
        .toLowerCase()
        .split(' ')
        .map((word, index) => {
            if (word.length === 0) return '';
            // Always capitalize the first word
            if (index > 0 && exceptions.has(word)) {
                return word;
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
};

/**
 * Normalizes a string for robust matching. It converts to lowercase, removes accents,
 * stop words, and a comprehensive list of standard and custom keywords, including
 * multi-word phrases. The matching is insensitive to case, accents, and special characters.
 * @param str The string to normalize.
 * @param customKeywords A list of user-defined keywords to ignore.
 * @param keepStopWords If true, words like 'de', 'da', 'do' are not removed.
 * @returns A cleaned, lowercase string suitable for comparison.
 */
export const normalizeString = (str: string, customKeywords: string[] = [], keepStopWords: boolean = false): string => {
    if (!str) return '';

    const fullyNormalize = (s: string): string => {
        if (!s) return '';
        return s
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[^a-z\s]/g, '')      // Remove all non-alpha characters (keeps only letters and spaces)
            .trim()
            .replace(/\s+/g, ' ');         // Collapse multiple spaces into one
    };

    const normalizedCustom = (customKeywords || []).map(k => fullyNormalize(k)).filter(Boolean);
    const allKeywords = [...new Set(normalizedCustom)];
    const sortedKeywords = allKeywords.sort((a, b) => b.length - a.length);

    let processedStr = str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    // Remove isolated numbers, dates, and alphanumeric codes first.
    processedStr = processedStr.replace(/\b[\d\/\.-]+\b/g, '');
    // Removes short alphanumeric codes like ID123, OP4567.
    processedStr = processedStr.replace(/\b(?=[a-z]*\d)(?=\d*[a-z])[a-z\d]+\b/g, '');
    
    // Remove all non-alpha characters (keeps only letters and spaces)
    processedStr = processedStr.replace(/[^a-z\s]/g, '').trim();

    sortedKeywords.forEach(keyword => {
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKeyword}s?\\b`, 'gi');
        processedStr = processedStr.replace(regex, '');
    });
    
    if (!keepStopWords) {
        const stopWords = /\b(de|da|do|dos|das|e|a|o|em|para|com|por)\b/gi;
        processedStr = processedStr.replace(stopWords, '');
    }

    return processedStr.trim().replace(/\s+/g, ' ');
};


/**
 * Aggressively cleans a raw string from any file to isolate a likely name for display.
 * It removes common transactional keywords, numbers, symbols, and applies Title Case.
 * This function now uses the more powerful `normalizeString` to ensure consistency.
 * @param description The raw string from the bank statement or contributor file.
 * @param customKeywords An optional list of additional keywords to remove.
 * @returns A cleaner, Title Cased string, likely containing just the name.
 */
export const cleanTransactionDescriptionForDisplay = (description: string, customKeywords: string[] = []): string => {
    if (!description) return '';
    // Use the robust normalization logic, but keep stop words for better readability.
    const normalized = normalizeString(description, customKeywords, true);
    // Convert the cleaned, normalized string to Title Case for display.
    return toTitleCase(normalized);
};


/**
 * Calculates the similarity between a transaction description and a contributor's name,
 * giving heavy priority to a matching first name.
 * @param description The raw transaction description.
 * @param contributor The contributor's object.
 * @param customKeywords Optional keywords to ignore during normalization.
 * @returns A similarity score from 0 to 100.
 */
export const calculateNameSimilarity = (description: string, contributor: Contributor, customKeywords: string[] = []): number => {
    const normalizedDesc = normalizeString(description, customKeywords);
    const normalizedContributorName = contributor.normalizedName || normalizeString(contributor.name, customKeywords);

    const descriptionWords = normalizedDesc.split(' ').filter(p => p.length > 0);
    const contributorWords = normalizedContributorName.split(' ').filter(p => p.length > 0);

    if (descriptionWords.length === 0 || contributorWords.length === 0) {
        return 0;
    }

    const descFirstName = descriptionWords[0];
    const contributorFirstName = contributorWords[0];
    
    // Base score is 80 if first names match, giving a strong advantage.
    // If they don't match, we still calculate similarity but cap it below 80
    // to ensure a first-name match is always better.
    if (descFirstName === contributorFirstName) {
        let score = 80;
        const descRemainder = descriptionWords.slice(1);
        const contributorRemainder = contributorWords.slice(1);

        if (descRemainder.length === 0 || contributorRemainder.length === 0) {
            return 100; // If first name matches and one of them is a single name, it's a very strong match.
        }
        
        // Calculate similarity of the rest of the name for the remaining 20 points.
        const intersection = new Set(descRemainder.filter(word => new Set(contributorRemainder).has(word)));
        const similarity = intersection.size / Math.max(descRemainder.length, contributorRemainder.length);
        score += similarity * 20;
        
        return Math.min(100, score);
    } else {
        // Fallback for when first names don't match.
        const allDescWords = new Set(descriptionWords);
        const allContributorWords = new Set(contributorWords);
        const intersection = new Set([...allDescWords].filter(word => allContributorWords.has(word)));
        
        // Calculate similarity based on all words.
        const similarity = intersection.size / Math.max(allDescWords.size, allContributorWords.size);
        
        // Cap the score at 79 to ensure it's always lower than a first-name match.
        return similarity * 79;
    }
};


/**
 * Robustly parses various common date string formats into a valid, timezone-agnostic Date object.
 * @param dateString The string to parse (e.g., "DD/MM/YYYY", "YYYY-MM-DD").
 * @returns A Date object or null if parsing fails.
 */
// NOTE: Exported for testing
export const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    
    const trimmedDateString = dateString.trim();

    // Attempt to handle ISO-like formats (YYYY-MM-DD), which new Date() handles reliably.
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(trimmedDateString)) {
        const isoDate = new Date(trimmedDateString);
        if (!isNaN(isoDate.getTime())) {
            // Adjust for potential timezone shift by re-creating in UTC
            return new Date(Date.UTC(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate()));
        }
    }

    // Handle DD/MM/YYYY or DD-MM-YYYY formats.
    const parts = trimmedDateString.match(/(\d+)/g);
    if (!parts || parts.length < 3) return null;

    let day, month, year;

    // YYYY-MM-DD
    if (parts[0].length === 4) {
        [year, month, day] = parts.map(p => parseInt(p, 10));
    } 
    // DD/MM/YYYY
    else {
        [day, month, year] = parts.map(p => parseInt(p, 10));
        if (String(year).length === 2) {
             // Heuristic for 2-digit years: '24' -> 2024, '99' -> 1999
            year += (year < 50 ? 2000 : 1900);
        }
    }
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

    // Reject dates with unreasonable years.
    const currentYear = new Date().getFullYear();
    if (year > currentYear + 1 || year < 1970) {
        return null;
    }
    
    // Month is 0-indexed in JS Date constructor. Use UTC to prevent timezone issues.
    const date = new Date(Date.UTC(year, month - 1, day));

    // Final validation to catch invalid dates like 31/02/2024, which JS would otherwise auto-correct.
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    
    return date;
};

const daysDifference = (date1: Date, date2: Date): number => {
    const timeDiff = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

const calculateAmountSimilarity = (txAmount: number, contributorAmount?: number): number => {
    // If no contributor amount is listed, we can't compare. Return a neutral score.
    if (contributorAmount === undefined || contributorAmount <= 0) {
        return 50; 
    }
    const difference = Math.abs(txAmount - contributorAmount);
    if (difference === 0) return 100;
    // The score decreases as the percentage difference grows.
    // A 50% difference results in a score of 0.
    const percentageDifference = difference / txAmount;
    return Math.max(0, 100 * (1 - percentageDifference * 2));
};

const calculateDateSimilarity = (txDate: Date, contributorDate: Date | null, dayTolerance: number): number => {
    // If no contributor date is listed, return a neutral score.
    if (!contributorDate) {
        return 50;
    }
    // Handle the case where tolerance is zero for exact day matching.
    if (dayTolerance === 0) {
        return daysDifference(txDate, contributorDate) === 0 ? 100 : 0;
    }
    const diff = daysDifference(txDate, contributorDate);
    if (diff > dayTolerance) {
        return 0;
    }
    // Linear falloff from 100 to 0 over the tolerance period.
    return 100 * (1 - (diff / dayTolerance));
};


export const matchTransactions = (
    transactions: Transaction[],
    contributorFiles: ContributorFile[],
    options: {
        similarityThreshold: number;
        dayTolerance: number;
    },
    learnedAssociations: LearnedAssociation[],
    customIgnoreKeywords: string[] = []
): MatchResult[] => {
    Logger.info(`Starting transaction matching`, { 
        numTransactions: transactions.length,
        numContributorFiles: contributorFiles.length,
        numLearnedAssociations: learnedAssociations.length 
    });
    const allResults: MatchResult[] = [];
    const processedTransactionIds = new Set<string>();

    // 1. Pre-pass for learned associations
    transactions.forEach(transaction => {
        const normalizedDesc = normalizeString(transaction.description, customIgnoreKeywords);
        const learnedMatch = learnedAssociations.find(a => a.normalizedDescription === normalizedDesc);

        if (learnedMatch) {
            const church = contributorFiles.find(cf => cf.church.id === learnedMatch.churchId)?.church;
            const contributorList = contributorFiles.find(cf => cf.church.id === learnedMatch.churchId)?.contributors;
            const contributor = contributorList?.find(c => normalizeString(c.name) === normalizeString(learnedMatch.contributorName));

            if (church && contributor) {
                allResults.push({
                    transaction,
                    contributor,
                    church,
                    status: 'IDENTIFICADO',
                    matchMethod: 'LEARNED',
                    similarity: 100, // Learned matches are considered 100%
                    contributorAmount: contributor.amount,
                });
                processedTransactionIds.add(transaction.id);
            }
        }
    });

    // 2. Main pass for automatic matching
    const allPossiblePairs: { 
        transaction: Transaction;
        contributor: Contributor;
        church: Church;
        score: number;
        nameSimilarity: number;
    }[] = [];

    const remainingTransactions = transactions.filter(t => !processedTransactionIds.has(t.id));

    remainingTransactions.forEach(transaction => {
        const transactionDate = parseDate(transaction.date);
        if (!transactionDate) return;

        contributorFiles.forEach(({ church, contributors }) => {
            contributors.forEach(contributor => {
                const contributorDate = parseDate(contributor.date || '');

                const isDateWithinTolerance = !contributorDate || daysDifference(transactionDate, contributorDate) <= options.dayTolerance;
                if (!isDateWithinTolerance) {
                    return;
                }

                const nameScore = calculateNameSimilarity(transaction.description, contributor, customIgnoreKeywords);
                if (nameScore < options.similarityThreshold) {
                    return;
                }

                const amountScore = calculateAmountSimilarity(transaction.amount, contributor.amount);
                const dateScore = calculateDateSimilarity(transactionDate, contributorDate, options.dayTolerance);
                const rankingScore = (nameScore * 10000) + (amountScore * 100) + dateScore;

                allPossiblePairs.push({
                    transaction,
                    contributor,
                    church,
                    score: rankingScore,
                    nameSimilarity: nameScore,
                });
            });
        });
    });

    allPossiblePairs.sort((a, b) => b.score - a.score);

    const matchedTransactionIds = new Set<string>();
    const matchedContributorIds = new Set<string>();

    allPossiblePairs.forEach(pair => {
        if (pair.contributor.id && !matchedTransactionIds.has(pair.transaction.id) && !matchedContributorIds.has(pair.contributor.id)) {
            allResults.push({
                transaction: pair.transaction,
                contributor: pair.contributor,
                status: 'IDENTIFICADO',
                church: pair.church,
                matchMethod: 'AUTOMATIC',
                similarity: pair.nameSimilarity,
                contributorAmount: pair.contributor.amount,
            });
            
            matchedTransactionIds.add(pair.transaction.id);
            processedTransactionIds.add(pair.transaction.id);
            matchedContributorIds.add(pair.contributor.id);
        }
    });

    // 3. Post-pass for UNMATCHED CONTRIBUTORS from church lists
    contributorFiles.forEach(({ church, contributors }) => {
        contributors.forEach(contributor => {
            if (contributor.id && !matchedContributorIds.has(contributor.id)) {
                allResults.push({
                    transaction: {
                        id: `pending-${contributor.id}`,
                        date: contributor.date || '---',
                        description: contributor.name, // Use contributor name as placeholder
                        cleanedDescription: contributor.cleanedName,
                        amount: contributor.amount || 0,
                    },
                    contributor: contributor,
                    status: 'NÃO IDENTIFICADO',
                    church: church,
                    similarity: 0,
                    contributorAmount: contributor.amount,
                });
            }
        });
    });

    // 4. Post-pass for any remaining unidentified transactions
    transactions.forEach(transaction => {
        if (!processedTransactionIds.has(transaction.id)) {
            allResults.push({
                transaction,
                contributor: null,
                status: 'NÃO IDENTIFICADO',
                church: PLACEHOLDER_CHURCH,
                similarity: 0,
            });
        }
    });

    const identifiedCount = allResults.filter(r => r.status === 'IDENTIFICADO').length;
    Logger.info(`Matching complete`, {
        totalResults: allResults.length,
        identified: identifiedCount,
    });

    return allResults.sort((a, b) => {
        const dateA = parseDate(a.transaction.date)?.getTime() || parseDate(a.contributor?.date || '')?.getTime() || 0;
        const dateB = parseDate(b.transaction.date)?.getTime() || parseDate(b.contributor?.date || '')?.getTime() || 0;
        return dateB - dateA; // Sort descending, most recent first
    });
};

export const processExpenses = (
    transactions: Transaction[],
): MatchResult[] => {
    return transactions.map((transaction): MatchResult => ({
        transaction,
        contributor: null,
        status: 'NÃO IDENTIFICADO',
        church: PLACEHOLDER_CHURCH,
        similarity: 0,
    })).sort((a, b) => {
        const dateA = parseDate(a.transaction.date)?.getTime() || 0;
        const dateB = parseDate(b.transaction.date)?.getTime() || 0;
        return dateB - dateA; // Sort descending, most recent first
    });
};

export const countRawContributors = (content: string): number => {
    const heuristics = [
        { field: 'name' as keyof Contributor, checker: isProbablyName, isTextual: true },
    ];
    // This will find the name column, filter out headers, and count valid rows.
    const contributors = intelligentCSVParser<Contributor>(content, heuristics, 'name');
    return contributors.length;
};