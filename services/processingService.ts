
import { Transaction, Contributor, MatchResult, ContributorFile, Church, LearnedAssociation } from '../types';
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

export const filterByUniversalQuery = (record: MatchResult, query: string): boolean => {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean); // keep simple split
    if (searchTerms.length === 0) {
        return true;
    }

    const { transaction, contributor } = record;

    return searchTerms.every(term => {
        // Simple raw check against original string
        if (transaction.originalAmount && transaction.originalAmount.toLowerCase().includes(term)) {
            return true;
        }
        
        // Also check parsed amount for convenience if user types number with dot/comma different from file
        const numericValue = parseFloat(term.replace(',', '.'));
        const isNumericTerm = !isNaN(numericValue);
        if (isNumericTerm && Math.abs(transaction.amount - numericValue) < 0.01) {
            return true;
        }

        if (transaction.date.toLowerCase().includes(term)) {
            return true;
        }
        if ((contributor?.name || '').toLowerCase().includes(term) ||
            (contributor?.cleanedName || '').toLowerCase().includes(term) ||
            transaction.description.toLowerCase().includes(term)) {
            return true;
        }
        
        return false;
    });
};

export const filterTransactionByUniversalQuery = (transaction: Transaction, query: string): boolean => {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (searchTerms.length === 0) {
        return true;
    }
    
    return searchTerms.every(term => {
        if (transaction.originalAmount && transaction.originalAmount.toLowerCase().includes(term)) {
            return true;
        }
        
        const numericValue = parseFloat(term.replace(',', '.'));
        const isNumericTerm = !isNaN(numericValue);
        if (isNumericTerm && Math.abs(transaction.amount - numericValue) < 0.01) {
            return true;
        }

        if (transaction.date.toLowerCase().includes(term)) {
            return true;
        }
        if (transaction.description.toLowerCase().includes(term)) {
            return true;
        }
        
        return false;
    });
};


// --- Parsing Helpers ---

// NOTE: Exported for testing
export const parseDate = (dateString: string): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;
    const trimmedDateString = dateString.trim();
    // Simple attempts
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(trimmedDateString)) {
        const isoDate = new Date(trimmedDateString);
        if (!isNaN(isoDate.getTime())) return new Date(Date.UTC(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate()));
    }
    // Match parts: allow . / - as separators
    const parts = trimmedDateString.match(/(\d+)/g);
    if (!parts || parts.length < 3) return null;
    
    let day, month, year;
    
    // Check order YYYY-MM-DD vs DD-MM-YYYY
    if (parts[0].length === 4) {
        [year, month, day] = parts.map(p => parseInt(p, 10));
    } else {
        [day, month, year] = parts.map(p => parseInt(p, 10));
        // Handle 2-digit years
        if (String(year).length === 2) year += (year < 50 ? 2000 : 1900);
    }
    
    // Basic validation
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    const date = new Date(Date.UTC(year, month - 1, day));
    return (!isNaN(date.getTime())) ? date : null;
};

const isDateString = (s: string): boolean => {
    // Robust check: relies on the parser logic instead of rigid regex
    return parseDate(s) !== null;
};

const isAmountString = (s: string): boolean => {
    if (!s || typeof s !== 'string') return false;
    // Check for date format explicitly to avoid overlap
    if (isDateString(s)) return false;
    
    // Must contain a digit
    if (!/\d/.test(s)) return false;

    // Try to parse it. If it results in a valid non-zero number, it's a potential amount.
    // We allow letters/noise because OCR often leaves artifacts like "100,00 C" or "R$ 500".
    const val = parseAmountString(s);
    return !isNaN(val) && val !== 0;
};

const isProbablyName = (s: string): boolean => {
    if (!s || typeof s !== 'string') return false;
    
    // STRICT RULE: If it's a date, it's not a name.
    if (isDateString(s)) return false;

    // It's likely a name if it has length
    return s.trim().length > 0;
};

const parseAmountString = (s: string): number => {
    if (!s) return 0;
    const cleanS = s.trim();
    
    // Check for negative indicators BEFORE cleaning special chars
    // Enhanced for suffixes like '100.00D' common in bank PDFs
    let isNegative = /^[\(-]/.test(cleanS) || 
                       /[\)-]$/.test(cleanS) ||
                       /\b(D|Db|Dr|Débito|Debito)\b/i.test(cleanS) ||
                       /[\d](D|d)$/.test(cleanS); // Ends in D (e.g. 30,00D)

    // Check for explicit Credit indicator 'C' to ensure positive
    const isCredit = /[\d](C|c)$/.test(cleanS) || /\b(C|Cr|Crédito|Credito)\b/i.test(cleanS);
    if (isCredit) isNegative = false;

    let cleaned = cleanS
        .replace(/["'()]/g, '') // remove quotes and parens
        .replace(/[a-zA-Z$]/g, '') // remove letters and currency symbols
        .replace(/[R$BRL\s]/gi, ''); // remove specific currencies/spaces

    // Remove any remaining non-numeric chars except . , -
    cleaned = cleaned.replace(/[^\d.,-]/g, '');

    // Handle trailing/leading minus from the cleaned numeric string
    if (cleaned.endsWith('-')) cleaned = cleaned.slice(0, -1);
    if (cleaned.startsWith('-')) cleaned = cleaned.slice(1);
    
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    let parsableString;
    // Heuristic for separators
    if (lastComma > -1 && lastDot > -1) {
        if (lastComma > lastDot) {
            parsableString = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            parsableString = cleaned.replace(/,/g, '');
        }
    }
    else if (lastComma > -1) {
        // Assume comma is decimal if it's the only one, or standard PT-BR
        parsableString = cleaned.replace(/\./g, '').replace(',', '.');
    }
    else {
        parsableString = cleaned;
    }

    const value = parseFloat(parsableString);
    if (isNaN(value)) return 0;

    // Apply negative sign if detected
    return isNegative ? -Math.abs(value) : Math.abs(value);
};

const detectDelimiter = (content: string): string => {
    const delimiters = [',', ';', '\t'];
    const lines = content.split('\n').slice(0, 10);
    if (lines.length === 0) return ',';

    let bestDelimiter = ',';
    let maxCount = 0;

    for (const delimiter of delimiters) {
        let totalCount = 0;
        for (const line of lines) {
            totalCount += line.split(delimiter).length - 1;
        }
        if (totalCount > maxCount) {
            maxCount = totalCount;
            bestDelimiter = delimiter;
        }
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
            if (insideQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === delimiter && !insideQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
};

const intelligentCSVParser = <T>(
    content: string,
    fieldHeuristics: { field: keyof T; checker: (s: string) => boolean; isTextual?: boolean }[],
    requiredField: keyof T
): T[] => {
    const delimiter = detectDelimiter(content);
    // REMOVED: .trim() on content to avoid stripping leading/trailing whitespace of the file
    let allRows = content
        .replace(/\r/g, '')
        .split('\n')
        .map(line => splitCSVLine(line, delimiter));

    if (allRows.length < 2) return [];

    const rowLengths = allRows.map(r => r.length);
    let numColumns = 0;
    // Simple mode detection
    const counts: Record<number, number> = {};
    for (const l of rowLengths) counts[l] = (counts[l] || 0) + 1;
    numColumns = parseInt(Object.keys(counts).reduce((a, b) => counts[parseInt(a)] > counts[parseInt(b)] ? a : b));

    const sampleRows = allRows.slice(0, 50);

    // --- Column Scoring Logic ---
    const columnScores = Array(numColumns + 5).fill(0).map(() => {
        const scores: Record<string, number> = {};
        fieldHeuristics.forEach(h => scores[h.field as string] = 0);
        return scores;
    });

    for (const row of sampleRows) {
        for (let i = 0; i < row.length; i++) {
            const cell = row[i] || '';
            fieldHeuristics.forEach(heuristic => {
                if (heuristic.checker(cell)) {
                    columnScores[i][heuristic.field as string]++;
                }
            });
        }
    }

    const candidateColumns: Record<string, { index: number; score: number }[]> = {};
    const columnAverages: Record<number, number> = {}; // Cache for column averages

    fieldHeuristics.forEach(({ field, isTextual }) => {
        candidateColumns[field as string] = [];
        columnScores.forEach((scores, index) => {
            if (scores[field as string] > 0) {
                candidateColumns[field as string].push({ index, score: scores[field as string] });
            }
        });

        // SPECIAL LOGIC FOR AMOUNT:
        if (field === 'amount') {
            candidateColumns['amount'].sort((a, b) => {
                const threshold = sampleRows.length * 0.3; 
                
                const aValid = a.score > threshold;
                const bValid = b.score > threshold;

                if (aValid && !bValid) return -1;
                if (!aValid && bValid) return 1;

                // Compare averages
                if (columnAverages[a.index] === undefined) {
                    let sum = 0, count = 0;
                    for (const row of sampleRows) {
                        if (row[a.index]) {
                            const val = Math.abs(parseAmountString(row[a.index]));
                            if (val > 0) { sum += val; count++; }
                        }
                    }
                    columnAverages[a.index] = count > 0 ? sum / count : Infinity;
                }
                
                if (columnAverages[b.index] === undefined) {
                    let sum = 0, count = 0;
                    for (const row of sampleRows) {
                        if (row[b.index]) {
                            const val = Math.abs(parseAmountString(row[b.index]));
                            if (val > 0) { sum += val; count++; }
                        }
                    }
                    columnAverages[b.index] = count > 0 ? sum / count : Infinity;
                }

                if (columnAverages[a.index] !== Infinity && columnAverages[b.index] !== Infinity) {
                    return columnAverages[a.index] - columnAverages[b.index];
                }

                return b.score - a.score;
            });
        } 
        else if (field === 'name' || isTextual) {
            candidateColumns[field as string].sort((a, b) => {
                const getColumnValues = (colIndex: number) => {
                    return sampleRows
                        .map(row => row[colIndex])
                        .filter(val => val && val.trim().length > 0);
                };

                const valuesA = getColumnValues(a.index);
                const valuesB = getColumnValues(b.index);

                const uniqueA = new Set(valuesA).size;
                const uniqueB = new Set(valuesB).size;

                const isRepetitiveA = uniqueA <= 1 && valuesA.length > 5;
                const isRepetitiveB = uniqueB <= 1 && valuesB.length > 5;

                if (isRepetitiveA && !isRepetitiveB) return 1; 
                if (!isRepetitiveA && isRepetitiveB) return -1; 

                const ratioA = valuesA.length > 0 ? uniqueA / valuesA.length : 0;
                const ratioB = valuesB.length > 0 ? uniqueB / valuesB.length : 0;
                
                if (Math.abs(ratioA - ratioB) > 0.1) {
                    return ratioB - ratioA;
                }

                return b.score - a.score;
            });
        } else {
            candidateColumns[field as string].sort((a, b) => b.score - a.score);
        }
    });

    // --- Resolve Mappings ---
    const fieldMap: Partial<Record<keyof T, number>> = {};
    const usedIndices = new Set<number>();
    
    // Prioritize Amount, then others
    const sortedFields = fieldHeuristics
        .map(h => h.field as string)
        .sort((a, b) => {
            if (a === 'amount') return -1;
            if (b === 'amount') return 1;
            return 0;
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

    // --- Data Extraction with Fallback ---
    const parsedData = allRows.map(row => {
        const entry = {} as T;
        let hasData = false;

        // First pass: Try to get data from the mapped columns
        for (const key in fieldMap) {
            const typedKey = key as keyof T;
            const colIndex = fieldMap[typedKey];
            if (colIndex === undefined || colIndex >= row.length) continue;

            const value = row[colIndex];
            if (value !== undefined && value.trim() !== '') hasData = true;

            if (typedKey === 'amount') {
                 (entry as any)['originalAmount'] = value;
            }
            (entry as any)[typedKey] = (typedKey === 'amount') ? parseAmountString(value) : value;
        }

        // --- FALLBACK STRATEGY ---
        // If critical fields are missing or invalid (due to shifted columns), scan the entire row.
        
        // Check Date validity
        // @ts-ignore
        const hasValidDate = entry['date'] && isDateString(entry['date']);
        if (!hasValidDate) {
            const dateCandidate = row.find(cell => isDateString(cell));
            if (dateCandidate) {
                (entry as any)['date'] = dateCandidate;
                hasData = true;
            }
        }

        // Check Amount validity
        // @ts-ignore
        const currentAmount = entry['amount'];
        const hasValidAmount = typeof currentAmount === 'number' && currentAmount !== 0;
        
        if (!hasValidAmount) {
            // Look for a cell that is a valid amount string AND is not the date we just found
            const amountCandidate = row.find(cell => {
                // @ts-ignore
                if (cell === entry['date']) return false;
                return isAmountString(cell);
            });

            if (amountCandidate) {
                (entry as any)['amount'] = parseAmountString(amountCandidate);
                (entry as any)['originalAmount'] = amountCandidate;
                hasData = true;
            }
        }

        return hasData ? entry : null;
    }).filter(entry => entry !== null) as T[];

    return parsedData;
};


export const parseBankStatement = (content: string, customIgnoreKeywords: string[] = []): Transaction[] => {
    const heuristics = [
        { field: 'date' as keyof Transaction, checker: isDateString },
        { field: 'amount' as keyof Transaction, checker: isAmountString },
        { field: 'description' as keyof Transaction, checker: (s: string) => s.length > 3 && !isDateString(s) && !isAmountString(s), isTextual: true },
    ];
    
    // 1. Get raw objects from the parser.
    const rawTransactions = intelligentCSVParser<Transaction>(content, heuristics, 'amount');

    // 2. Advanced Filtering & Merging Logic (Fix for PDF Statements like SICOOB)
    // Banks like SICOOB often put the Description on multiple lines.
    // Line 1: Date | Description Start | Amount
    // Line 2: Empty | Description Continued | Empty
    // We need to merge Line 2 into Line 1.

    const validTransactions: Transaction[] = [];
    let lastValidTransaction: Transaction | null = null;

    rawTransactions.forEach(t => {
        const hasValidDate = t.date && isDateString(t.date);
        const hasValidAmount = t.amount !== 0; 
        
        // Is this a primary transaction row?
        if (hasValidDate && hasValidAmount) {
            // It's a new transaction
            const newTx = {
                ...t,
                id: `tx-${validTransactions.length}`, // temp id
                description: t.description || '---',
                cleanedDescription: '' // Will set later
            };
            validTransactions.push(newTx);
            lastValidTransaction = newTx;
        } 
        // Is this a continuation row? (No date, No amount, but has text)
        else if (!hasValidDate && !hasValidAmount && t.description && lastValidTransaction) {
            // Check if the description is just noise or part of the transaction
            const noise = ['saldo', 'bloq', 'anterior'].some(w => t.description.toLowerCase().includes(w));
            
            if (!noise && t.description.trim().length > 1) {
                // Append to previous transaction
                lastValidTransaction.description += ` ${t.description.trim()}`;
            }
        }
    });

    // 3. Final Cleanup
    return validTransactions.map((t, index) => ({ 
            ...t, 
            id: `tx-${index}`,
            cleanedDescription: cleanTransactionDescriptionForDisplay(t.description || '---', customIgnoreKeywords),
        }));
};

export const parseContributors = (content: string, customIgnoreKeywords: string[] = []): Contributor[] => {
    const heuristics = [
        { field: 'name' as keyof Contributor, checker: isProbablyName, isTextual: true },
        { field: 'date' as keyof Contributor, checker: isDateString },
        { field: 'amount' as keyof Contributor, checker: isAmountString },
        { field: 'cpf' as keyof Contributor, checker: (s: string) => /^\d{3}/.test(s) } // Relaxed CPF check
    ];

    const contributors = intelligentCSVParser<Contributor>(content, heuristics, 'name');

    // Filter strict rules: Row MUST have a valid Date AND a valid Amount
    const validContributors = contributors.filter(c => {
        const hasValidDate = c.date && isDateString(c.date);
        const hasValidAmount = c.amount !== 0;
        
        return hasValidDate && hasValidAmount;
    });

    return validContributors
        .map((c, index) => ({
            ...c,
            id: `contrib-${index}`,
            name: c.name || '---', // Ensure name is present for display
            cleanedName: cleanTransactionDescriptionForDisplay(c.name || '---', customIgnoreKeywords), 
            normalizedName: normalizeString(c.name || '', customIgnoreKeywords),
        }));
};


// --- Matching Logic ---

// Helper to remove standalone numeric codes but preserve formatted numbers like 100,00 or 12/12/2024
const removeNumericCodes = (text: string): string => {
    const regex = /(\d+(?:[.,\/-]\d+)+)|\b\d+\b/g;
    return text.replace(regex, (match, formatted) => {
        return formatted ? match : '';
    });
};

export const normalizeString = (str: string, customKeywords: string[] = [], keepStopWords: boolean = false): string => {
    if (!str) return '';
    
    // Step 1: Basic normalization (lowercase, remove accents)
    let normalized = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Step 2: Remove keywords. We must normalize keywords too to match.
    if (customKeywords && customKeywords.length > 0) {
        const sortedKeywords = [...customKeywords].sort((a, b) => b.length - a.length);
        for (const keyword of sortedKeywords) {
             const normKeyword = keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
             if (!normKeyword.trim()) continue;
             
             // Escape regex
             const escaped = normKeyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             const regex = new RegExp(escaped, 'g');
             normalized = normalized.replace(regex, '');
        }
    }

    // Step 3: Remove numeric codes (e.g. 84010355115) but keep values (100,00)
    normalized = removeNumericCodes(normalized);

    // Step 4: Final cleanup
    return normalized
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

export const cleanTransactionDescriptionForDisplay = (description: string, customKeywords: string[] = []): string => {
    if (!description) return '';
    let cleaned = description;

    if (customKeywords && customKeywords.length > 0) {
        // Sort by length to avoid partial replacements of longer keywords
        const sortedKeywords = [...customKeywords].sort((a, b) => b.length - a.length);
        
        for (const keyword of sortedKeywords) {
            if (!keyword || !keyword.trim()) continue;
            // Escape regex special characters
            const escapedKeyword = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Regex for case-insensitive replacement (global)
            const regex = new RegExp(escapedKeyword, 'gi');
            cleaned = cleaned.replace(regex, '');
        }
    }
    
    // Step: Remove standalone numeric codes (e.g. 84010355115) while preserving values (100,00)
    cleaned = removeNumericCodes(cleaned);

    // Remove extra spaces that might have been left behind
    return cleaned.replace(/\s+/g, ' ').trim();
};

export const calculateNameSimilarity = (description: string, contributor: Contributor, customKeywords: string[] = []): number => {
    const normalizedDesc = normalizeString(description, customKeywords);
    const normalizedContributorName = contributor.normalizedName || normalizeString(contributor.name, customKeywords);

    if (!normalizedDesc || !normalizedContributorName) return 0;

    const descWords = new Set(normalizedDesc.split(' ').filter(Boolean));
    const contributorWords = new Set(normalizedContributorName.split(' ').filter(Boolean));

    if (descWords.size === 0 || contributorWords.size === 0) return 0;

    const intersection = new Set([...descWords].filter(word => contributorWords.has(word)));
    const diceCoefficient = (2 * intersection.size) / (descWords.size + contributorWords.size);

    return diceCoefficient * 100;
};

const daysDifference = (date1: Date, date2: Date): number => {
    const timeDiff = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

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
    const allContributors = contributorFiles.flatMap(file =>
        file.contributors.map((c, index) => ({ 
            ...c, 
            id: c.id || `contrib-${file.church.id}-${index}`,
            church: file.church 
        }))
    );

    const learnedMap = new Map(learnedAssociations.map(la => [la.normalizedDescription, la]));
    
    const finalResults: MatchResult[] = [];
    const matchedTransactionIds = new Set<string>();
    const matchedContributorIds = new Set<string>();

    // Learned Associations
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

    const potentialMatches: {
        transaction: Transaction;
        contributor: Contributor & { church: Church };
        score: number;
    }[] = [];

    const availableTransactions = transactions.filter(t => !matchedTransactionIds.has(t.id));
    const availableContributors = allContributors.filter(c => c.id! && !matchedContributorIds.has(c.id!));

    const contributorWordSets = availableContributors.map(c => {
        const normalizedName = c.normalizedName || normalizeString(c.name, customIgnoreKeywords);
        const words = new Set(normalizedName.split(' ').filter(w => w.length > 0));
        return { id: c.id, contributor: c, words };
    });

    // Automatic Matching
    for (const transaction of availableTransactions) {
        const txNormalized = normalizeString(transaction.description, customIgnoreKeywords);
        const txWords = new Set(txNormalized.split(' ').filter(w => w.length > 0));

        if (txWords.size === 0) continue;

        for (const { contributor, words: contributorWords } of contributorWordSets) {
            if (contributorWords.size === 0) continue;

            let intersectionSize = 0;
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

    potentialMatches.sort((a, b) => b.score - a.score);

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

    // Pending Transactions
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

    // Pending Contributors
    allContributors.forEach(contributor => {
        if (contributor.id && !matchedContributorIds.has(contributor.id)) {
            finalResults.push({
                transaction: {
                    id: `pending-${contributor.id || `${contributor.normalizedName}-${Math.random()}`}`,
                    date: contributor.date || 'N/A',
                    description: `[Pendente] ${contributor.name}`,
                    amount: 0,
                    cleanedDescription: `[Pendente] ${contributor.cleanedName || contributor.name}`, 
                    originalAmount: contributor.originalAmount // Preserve original amount
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

export const processExpenses = (expenseTransactions: Transaction[]): MatchResult[] => {
    return expenseTransactions.map(transaction => ({
        transaction,
        contributor: null,
        status: 'NÃO IDENTIFICADO',
        church: PLACEHOLDER_CHURCH,
    }));
};
