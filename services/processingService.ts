
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
        const churchName = normalizeString(record.church?.name || '');

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
    if (/^\d{11,}$/.test(clean.replace(/\D/g, ''))) return false;
    const val = parseAmountString(clean);
    return !isNaN(val); 
};

const parseAmountString = (s: string): number => {
    if (!s) return 0;
    if (typeof s === 'number') return s;

    let cleanS = s.toString().trim().replace(/[R$BRL\s]/gi, '').replace(/[^\d.,-]/g, '');
    let isNegative = s.includes('-') || s.includes('(') || /\b(D|Db|Dr|Débito)\b/i.test(s);

    const lastComma = cleanS.lastIndexOf(',');
    const lastDot = cleanS.lastIndexOf('.');

    let parsableString;
    if (lastComma > lastDot) {
        parsableString = cleanS.replace(/\./g, '').replace(',', '.');
    } 
    else if (lastDot > lastComma) {
        parsableString = cleanS.replace(/,/g, '');
    } 
    else {
        parsableString = cleanS.replace(',', '.');
    }

    const value = parseFloat(parsableString);
    return isNegative ? -Math.abs(value) : Math.abs(value);
};

// --- Parser Inteligente com Filtro de Validade ---

const intelligentParser = <T>(
    content: string,
    type: 'EXTRATO' | 'LISTA'
): T[] => {
    const delimiter = content.includes('\t') ? '\t' : content.includes(';') ? ';' : ',';
    const lines = content.split('\n').map(l => l.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')));
    
    if (lines.length < 1) return [];

    const sample = lines.slice(0, 100);
    const numCols = Math.max(...sample.map(l => l.length));
    const colStats = Array.from({ length: numCols }, () => ({
        dates: 0,
        amounts: 0,
        sumAbsValue: 0,
        uniqueValues: new Set<string>(),
        totalLength: 0
    }));

    sample.forEach(row => {
        row.forEach((cell, i) => {
            if (!cell || i >= numCols) return;
            if (isDateString(cell)) colStats[i].dates++;
            if (isAmountString(cell)) {
                colStats[i].amounts++;
                colStats[i].sumAbsValue += Math.abs(parseAmountString(cell));
            }
            colStats[i].uniqueValues.add(cell.toUpperCase());
            colStats[i].totalLength += cell.length;
        });
    });

    let dateIdx = -1, amountIdx = -1, textIdx = -1;

    dateIdx = colStats.findIndex((s, i) => s.dates === Math.max(...colStats.map(x => x.dates)) && s.dates > 0);
    
    const amountCandidates = colStats
        .map((s, i) => ({ 
            i, 
            count: s.amounts, 
            avg: s.amounts > 0 ? s.sumAbsValue / s.amounts : Infinity 
        }))
        .filter(c => c.i !== dateIdx && c.count > (sample.length * 0.05))
        .sort((a, b) => {
            if (Math.abs(a.count - b.count) < (sample.length * 0.1)) {
                return a.avg - b.avg;
            }
            return b.count - a.count;
        });

    if (amountCandidates.length > 0) amountIdx = amountCandidates[0].i;

    const textCandidates = colStats
        .map((s, i) => ({ i, score: s.uniqueValues.size * (s.totalLength / (sample.length || 1)) }))
        .filter(c => c.i !== dateIdx && c.i !== amountIdx)
        .sort((a, b) => b.score - a.score);

    if (textCandidates.length > 0) textIdx = textCandidates[0].i;

    const results: any[] = [];
    lines.forEach(row => {
        const dateRaw = dateIdx !== -1 ? row[dateIdx] : null;
        const amountRaw = amountIdx !== -1 ? row[amountIdx] : null;
        const textRaw = textIdx !== -1 ? row[textIdx] : null;

        // REGRA DE OURO: Para ser válido, deve ter Data Válida E Valor Válido
        const hasValidDate = dateRaw && isDateString(dateRaw);
        const hasValidAmount = amountRaw && isAmountString(amountRaw);

        if (!hasValidDate || !hasValidAmount) return; // DESCARTA LINHA INVÁLIDA

        if (type === 'EXTRATO') {
            const entry: any = {
                date: dateRaw,
                amount: parseAmountString(amountRaw),
                originalAmount: amountRaw,
                description: textRaw || 'Sem Descrição'
            };
            results.push(entry);
        } else {
            if (textRaw && textRaw.length > 2) {
                const upperText = textRaw.toUpperCase();
                const isStopWord = STOP_WORDS_RESUMO.some(sw => upperText.includes(sw));
                const isHeader = ['NOME', 'CONTRIBUINTE', 'MEMBRO', 'DESCRIÇÃO', 'DESCRICAO', 'NOME_DO_MEMBRO'].includes(upperText);

                if (!isStopWord && !isHeader) {
                    const entry: any = {
                        name: textRaw,
                        date: dateRaw,
                        amount: parseAmountString(amountRaw),
                        originalAmount: amountRaw
                    };
                    results.push(entry);
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
        id: `tx-${i}`,
        cleanedDescription: cleanText(t.description, ignoreRegex, true)
    }));
};

export const parseContributors = (content: string, customIgnoreKeywords: string[] = []): Contributor[] => {
    const raw = intelligentParser<Contributor>(content, 'LISTA');
    return raw.map((c, i) => ({
        ...c,
        id: `contrib-${i}`,
        cleanedName: c.name, 
        normalizedName: normalizeString(c.name)
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
    const pattern = keywords.map(k => k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return new RegExp(`\\b(${pattern})\\b`, 'gi');
};

const cleanText = (text: string, ignoreRegex: RegExp | null, isBankStatement: boolean): string => {
    if (!text) return '';
    let cleaned = removeCodes(text);
    if (isBankStatement && ignoreRegex) {
        cleaned = cleaned.replace(ignoreRegex, '');
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
                finalResults.push({
                    transaction: tx,
                    contributor: matchedContrib,
                    status: 'IDENTIFICADO',
                    church: matchedContrib.church,
                    similarity: 100,
                    matchMethod: 'LEARNED',
                    contributorAmount: matchedContrib.amount
                });
                return;
            }
        }

        allContributors.forEach(contrib => {
            if (contrib.date && tx.date) {
                const d1 = parseDate(tx.date);
                const d2 = parseDate(contrib.date);
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
            finalResults.push({
                transaction: tx,
                contributor: bestMatch,
                status: 'IDENTIFICADO',
                church: bestMatch.church,
                similarity: highestScore,
                matchMethod: 'AUTOMATIC',
                contributorAmount: bestMatch.amount
            });
        } else {
            finalResults.push({
                transaction: tx,
                contributor: null,
                status: 'NÃO IDENTIFICADO',
                church: PLACEHOLDER_CHURCH
            });
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
                amount: 0, 
                originalAmount: '0,00'
            };

            finalResults.push({
                transaction: virtualTx,
                contributor: contrib,
                status: 'NÃO IDENTIFICADO',
                church: contrib.church,
                contributorAmount: contrib.amount,
                similarity: 0
            });
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

export const processExpenses = (txs: Transaction[]): MatchResult[] => 
    txs.map(t => ({ transaction: t, contributor: null, status: 'NÃO IDENTIFICADO', church: PLACEHOLDER_CHURCH }));
