import { Transaction, Contributor, MatchResult, ContributorFile, Church, LearnedAssociation } from '../types';
import { Logger, Metrics } from './monitoringService';

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
            id: `tx-${index}`, // Deterministic ID
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
    // We removed the filtering of zero/negative amounts and frequent names
    // to ensure all input rows from the user's file are processed and displayed.
    
    return contributors
        .filter(c => c.name) // Basic sanity check: ensure name field is present
        .map((c, index) => ({
            ...c,
            id: `contrib-${index}`, // Deterministic ID
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
 * Calculates the similarity between a transaction description and a contributor's name
 * using the Sørensen-Dice coefficient, which provides a balanced score based on shared words.
 * This method considers the full name and is less biased by just the first name.
 * @param description The raw transaction description.
 * @param contributor The contributor's object.
 * @param customKeywords Optional keywords to ignore during normalization.
 * @returns A similarity score from 0 to 100.
 */
export const calculateNameSimilarity = (description: string, contributor: Contributor, customKeywords: string[] = []): number => {
    const normalizedDesc = normalizeString(description, customKeywords);
    const normalizedContributorName = contributor.normalizedName || normalizeString(contributor.name, customKeywords);

    if (!normalizedDesc || !normalizedContributorName) {
        return 0;
    }

    const descWords = new Set(normalizedDesc.split(' ').filter(Boolean));
    const contributorWords = new Set(normalizedContributorName.split(' ').filter(Boolean));

    if (descWords.size === 0 || contributorWords.size === 0) {
        return 0;
    }

    // Find the intersection of words
    const intersection = new Set([...descWords].filter(word => contributorWords.has(word)));

    // Calculate Sørensen–Dice coefficient
    // This gives a score from 0 to 1 based on shared words.
    // Formula: 2 * |A ∩ B| / (|A| + |B|)
    const diceCoefficient = (2 * intersection.size) / (descWords.size + contributorWords.size);

    return diceCoefficient * 100;
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
    churches: Church[],
    customIgnoreKeywords: string[] = []
): MatchResult[] => {
    // Flatten all contributors and give them a unique ID if they don't have one.
    const allContributors = contributorFiles.flatMap(file =>
        file.contributors.map((c, index) => ({ 
            ...c, 
            id: c.id || `contrib-${file.church.id}-${index}`, // Ensure unique ID
            church: file.church 
        }))
    );

    const learnedMap = new Map(learnedAssociations.map(la => [la.normalizedDescription, la]));
    
    const finalResults: MatchResult[] = [];
    const matchedTransactionIds = new Set<string>();
    const matchedContributorIds = new Set<string>();

    // Step 1: Handle Learned Associations first (highest priority)
    transactions.forEach(transaction => {
        const normalizedDesc = normalizeString(transaction.description, customIgnoreKeywords);
        const learnedMatch = learnedMap.get(normalizedDesc);
        if (learnedMatch) {
            const contributor = allContributors.find(c => 
                c.normalizedName === learnedMatch.contributorNormalizedName && 
                !matchedContributorIds.has(c.id!)
            );
            if (contributor) {
                finalResults.push({
                    transaction,
                    contributor,
                    status: 'IDENTIFICADO',
                    church: contributor.church,
                    matchMethod: 'LEARNED',
                    similarity: 100,
                    contributorAmount: contributor.amount,
                });
                matchedTransactionIds.add(transaction.id);
                matchedContributorIds.add(contributor.id!);
            }
        }
    });

    // Step 2: Create all possible high-scoring pairs from remaining items
    const potentialMatches: {
        transaction: Transaction;
        contributor: Contributor & { church: Church };
        score: number;
    }[] = [];

    const availableTransactions = transactions.filter(t => !matchedTransactionIds.has(t.id));
    const availableContributors = allContributors.filter(c => c.id! && !matchedContributorIds.has(c.id!));

    // OPTIMIZATION: Pre-calculate word sets for all available contributors
    // This avoids repeating string normalization and splitting inside the nested loop (O(N*M)).
    const contributorWordSets = availableContributors.map(c => {
        const normalizedName = c.normalizedName || normalizeString(c.name, customIgnoreKeywords);
        const words = new Set(normalizedName.split(' ').filter(w => w.length > 0));
        return { id: c.id, contributor: c, words };
    });

    for (const transaction of availableTransactions) {
        // Pre-calculate transaction word set for the current transaction
        const txNormalized = normalizeString(transaction.description, customIgnoreKeywords);
        const txWords = new Set(txNormalized.split(' ').filter(w => w.length > 0));

        if (txWords.size === 0) continue;

        for (const { contributor, words: contributorWords } of contributorWordSets) {
            
            if (contributorWords.size === 0) continue;

            // Optimized Dice Coefficient Calculation using pre-calculated sets
            let intersectionSize = 0;
            // Iterate over the smaller set for performance
            if (txWords.size < contributorWords.size) {
                for (const word of txWords) {
                    if (contributorWords.has(word)) intersectionSize++;
                }
            } else {
                for (const word of contributorWords) {
                    if (txWords.has(word)) intersectionSize++;
                }
            }

            const nameScore = (2 * intersectionSize) / (txWords.size + contributorWords.size) * 100;
            
            if (nameScore >= options.similarityThreshold) {
                const txDate = parseDate(transaction.date);
                const contributorDate = contributor.date ? parseDate(contributor.date) : null;
                
                if (txDate && contributorDate && daysDifference(txDate, contributorDate) > options.dayTolerance) {
                    continue; 
                }
                
                potentialMatches.push({
                    transaction,
                    contributor,
                    score: nameScore,
                });
            }
        }
    }

    // Step 3: Sort pairs by score, descending
    potentialMatches.sort((a, b) => b.score - a.score);

    // Step 4: Greedily assign best matches
    for (const match of potentialMatches) {
        if (match.contributor.id && !matchedTransactionIds.has(match.transaction.id) && !matchedContributorIds.has(match.contributor.id)) {
            
            let divergence: MatchResult['divergence'] | undefined = undefined;
            if (match.contributor.normalizedName) {
                const learnedAssociation = learnedAssociations.find(
                    la => la.contributorNormalizedName === match.contributor.normalizedName
                );
        
                if (learnedAssociation && learnedAssociation.churchId !== match.contributor.church.id) {
                    const expectedChurch = churches.find(c => c.id === learnedAssociation.churchId);
                    if (expectedChurch) {
                        divergence = {
                            type: 'CHURCH_MISMATCH',
                            expectedChurch: expectedChurch,
                            actualChurch: match.contributor.church,
                        };
                        Metrics.increment('divergences');
                    }
                }
            }
            
            finalResults.push({
                transaction: match.transaction,
                contributor: match.contributor,
                status: 'IDENTIFICADO',
                church: match.contributor.church,
                matchMethod: 'AUTOMATIC',
                similarity: match.score,
                contributorAmount: match.contributor.amount,
                divergence,
            });

            matchedTransactionIds.add(match.transaction.id);
            matchedContributorIds.add(match.contributor.id);
        }
    }

    // Step 5: Add remaining unmatched transactions
    transactions.forEach(transaction => {
        if (!matchedTransactionIds.has(transaction.id)) {
            finalResults.push({
                transaction,
                contributor: null,
                status: 'NÃO IDENTIFICADO',
                church: PLACEHOLDER_CHURCH,
            });
        }
    });

    // Step 6: Add remaining unmatched contributors
    allContributors.forEach(contributor => {
        if (contributor.id && !matchedContributorIds.has(contributor.id)) {
            finalResults.push({
                transaction: {
                    id: `pending-${contributor.id || `${contributor.normalizedName}-${Math.random()}`}`,
                    date: contributor.date || 'N/A',
                    description: `[Pendente da Lista] ${contributor.name}`,
                    amount: 0, // Not a real bank transaction
                    cleanedDescription: `[Pendente] ${contributor.cleanedName}`
                },
                contributor,
                status: 'NÃO IDENTIFICADO',
                church: contributor.church,
                contributorAmount: contributor.amount,
            });
        }
    });

    return finalResults;
};

// Fix: Add missing processExpenses function
export const processExpenses = (expenseTransactions: Transaction[]): MatchResult[] => {
    return expenseTransactions.map(transaction => ({
        transaction,
        contributor: null,
        status: 'NÃO IDENTIFICADO',
        church: PLACEHOLDER_CHURCH,
    }));
};