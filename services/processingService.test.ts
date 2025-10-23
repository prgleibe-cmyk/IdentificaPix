import { describe, it, expect } from '../utils/testRunner';
import { 
    normalizeString,
    cleanTransactionDescriptionForDisplay,
    calculateNameSimilarity,
    parseDate,
    parseBankStatement,
    matchTransactions,
    filterByUniversalQuery,
    filterTransactionByUniversalQuery,
} from './processingService';
import { Contributor, Transaction, ContributorFile, MatchResult } from '../types';

// Mock data
const mockContributors: Contributor[] = [
    { name: 'João da Silva Sauro', cleanedName: 'João da Silva Sauro', normalizedName: 'joao silva sauro', amount: 100, date: '15/07/2024' },
    { name: 'Maria Oliveira (PIX)', cleanedName: 'Maria Oliveira', normalizedName: 'maria oliveira', amount: 250.50, date: '16/07/2024' },
    { name: 'José S. Pereira', cleanedName: 'José S. Pereira', normalizedName: 'jose s pereira', amount: 50, date: '17/07/2024' },
    { name: 'Dra. Ana Costa', cleanedName: 'Ana Costa', normalizedName: 'ana costa', amount: 300, date: '18/07/2024' },
    { name: 'Pedro de Souza e Souza', cleanedName: 'Pedro de Souza e Souza', normalizedName: 'pedro souza souza', amount: 75.25, date: '19/07/2024' },
];

describe('processingService: Name Cleaning', () => {
    it('should normalize strings correctly', () => {
        expect(normalizeString("PIX Recebido de João da Silva Sauro")).toBe('joao silva sauro');
        expect(normalizeString("Maria Oliveira C/C 12345-6")).toBe('maria oliveira');
        expect(normalizeString("  Dr. Carlos Andrade ")).toBe('carlos andrade');
    });
    
    it('should handle custom ignore keywords', () => {
         expect(normalizeString("Dizimo de Ana Costa", ['dizimo', 'oferta'])).toBe('ana costa');
         expect(normalizeString("oferta para Pedro de souza", ['dizimo', 'oferta'])).toBe('pedro souza');
    });

    it('should clean transaction descriptions for display', () => {
        expect(cleanTransactionDescriptionForDisplay("PIX Recebido 12345 João da Silva")).toBe('João da Silva');
        expect(cleanTransactionDescriptionForDisplay("TED <HTML> Maria Oliveira")).toBe('Maria Oliveira');
    });
});

describe('processingService: Similarity Calculation', () => {
    it('should calculate similarity for exact matches', () => {
        const score = calculateNameSimilarity("PIX de João da Silva Sauro", mockContributors[0]);
        expect(score).toBe(100);
    });

    it('should handle abbreviated names', () => {
        const score = calculateNameSimilarity("PIX de José S Pereira", mockContributors[2]);
        expect(score).toBe(100);
    });
    
    it('should handle partial names', () => {
        const score = calculateNameSimilarity("Transferencia Maria", mockContributors[1]);
        expect(score).toBe(100); // "Maria" is one word in desc, matches one word in contributor
    });

    it('should handle initials', () => {
        const score = calculateNameSimilarity("Pagamento J S Pereira", mockContributors[2]);
        expect(score).toBe(100);
    });

    it('should return 0 for no match', () => {
        const score = calculateNameSimilarity("Pix de Fulano de Tal", mockContributors[0]);
        expect(score).toBe(0);
    });
});

describe('processingService: Date Parsing', () => {
     it('should parse various date formats', () => {
        expect(parseDate('15/07/2024')?.toISOString()).toBe(new Date('2024-07-15T00:00:00.000Z').toISOString());
        expect(parseDate('2024-07-16')?.toISOString()).toBe(new Date('2024-07-16T00:00:00.000Z').toISOString());
        expect(parseDate('17-07-2024')?.toISOString()).toBe(new Date('2024-07-17T00:00:00.000Z').toISOString());
     });

     it('should return null for invalid dates', () => {
         expect(parseDate('32/07/2024')).toBeNull();
         expect(parseDate('not a date')).toBeNull();
     });
});

describe('processingService: Intelligent CSV Parser (Column Detection)', () => {
    it('should correctly identify columns in standard format', () => {
        const content = `Data,Descricao,Valor\n15/07/2024,PIX JOAO,100.00`;
        const result = parseBankStatement(content);
        expect(result.length).toBe(1);
        expect(result[0].date).toBe('15/07/2024');
        expect(result[0].description).toBe('PIX JOAO');
        expect(result[0].amount).toBe(100);
    });

    it('should correctly identify columns in different order', () => {
        const content = `Descricao,Valor,Data\nPIX JOAO,100.00,15/07/2024`;
        const result = parseBankStatement(content);
        expect(result.length).toBe(1);
        expect(result[0].date).toBe('15/07/2024');
        expect(result[0].description).toBe('PIX JOAO');
        expect(result[0].amount).toBe(100);
    });
    
    it('should handle extra columns and choose correct amount column', () => {
        const content = `Data,Lixo,Descricao,Valor,Saldo\n15/07/2024,abc,PIX JOAO,100.00,5100.00\n16/07/2024,def,PIX MARIA,200.00,5300.00`;
        const result = parseBankStatement(content);
        expect(result.length).toBe(2);
        expect(result[0].date).toBe('15/07/2024');
        expect(result[0].description).toBe('PIX JOAO');
        expect(result[0].amount).toBe(100); // Should pick 'Valor', not 'Saldo'
    });
});


describe('processingService: Full Matching Logic', () => {
    const mockTransactions: Transaction[] = [
        { id: 't1', date: '15/07/2024', description: 'PIX Recebido de João S. Sauro', amount: 100 },
        { id: 't2', date: '17/07/2024', description: 'Maria Oliveira', amount: 250.50 }, // Divergent date
        { id: 't3', date: '17/07/2024', description: 'Pagamento J Pereira', amount: 50 }, // Abbreviated
        { id: 't4', date: '19/07/2024', description: 'Pix de Algum Estranho', amount: 999 }, // No match
        { id: 't5', date: '18/07/2024', description: 'Dra. Ana Costa', amount: 300 }, // Exact match
        { id: 't6', date: '19/07/2024', description: 'Pedro de Souza', amount: 75.25 }, // Duplicate value
    ];

    const mockContributorFiles: ContributorFile[] = [{
        church: { id: 'c1', name: 'Igreja Matriz', address: '', logoUrl: '', pastor: '' },
        contributors: mockContributors
    }];
    
    const options = {
        similarityThreshold: 80,
        dayTolerance: 2,
    };

    it('should match transactions correctly', () => {
        const results = matchTransactions(mockTransactions, mockContributorFiles, options, []);
        
        const t1Result = results.find(r => r.transaction.id === 't1');
        expect(t1Result?.status).toBe('IDENTIFICADO');
        expect(t1Result?.contributor?.name).toBe('João da Silva Sauro');

        const t3Result = results.find(r => r.transaction.id === 't3');
        expect(t3Result?.status).toBe('IDENTIFICADO');
        expect(t3Result?.contributor?.name).toBe('José S. Pereira');

        const t4Result = results.find(r => r.transaction.id === 't4');
        expect(t4Result?.status).toBe('NÃO IDENTIFICADO');
        expect(t4Result?.contributor).toBeNull();
    });

    it('should handle divergent dates within tolerance', () => {
        const results = matchTransactions(mockTransactions, mockContributorFiles, options, []);
        const t2Result = results.find(r => r.transaction.id === 't2'); // tx date 17/07, contributor date 16/07
        expect(t2Result?.status).toBe('IDENTIFICADO');
        expect(t2Result?.contributor?.name).toBe('Maria Oliveira (PIX)');
        expect(t2Result!.similarity!).toBeGreaterThan(options.similarityThreshold);
    });

    it('should not match with dates outside tolerance', () => {
         const newOptions = { ...options, dayTolerance: 0 };
         const results = matchTransactions(mockTransactions, mockContributorFiles, newOptions, []);
         const t2Result = results.find(r => r.transaction.id === 't2');
         expect(t2Result?.status).toBe('NÃO IDENTIFICADO');
    });

    it('should handle duplicate values correctly', () => {
         const results = matchTransactions(mockTransactions, mockContributorFiles, options, []);
         const t6Result = results.find(r => r.transaction.id === 't6');
         expect(t6Result?.status).toBe('IDENTIFICADO');
         expect(t6Result?.contributor?.name).toBe('Pedro de Souza e Souza');
    });
});

describe('processingService: Universal Search Filtering', () => {
    const mockMatchResult: MatchResult = {
        transaction: { id: 't1', date: '10/09/2024', description: 'PIX de Maria Clara', amount: 150.75, cleanedDescription: 'Maria Clara' },
        contributor: { name: 'Maria Clara de Jesus', cleanedName: 'Maria Clara de Jesus', normalizedName: 'maria clara jesus' },
        status: 'IDENTIFICADO',
        church: { id: 'c1', name: 'Igreja Matriz', address: '', logoUrl: '', pastor: '' }
    };

    it('should return true for empty query', () => {
        expect(filterByUniversalQuery(mockMatchResult, ' ')).toBe(true);
    });

    it('should match by full date', () => {
        expect(filterByUniversalQuery(mockMatchResult, '10/09/2024')).toBe(true);
    });

    it('should match by partial date', () => {
        expect(filterByUniversalQuery(mockMatchResult, '10/09')).toBe(true);
    });
    
    it('should match by exact value with dot', () => {
        expect(filterByUniversalQuery(mockMatchResult, '150.75')).toBe(true);
    });

    it('should match by exact value with comma', () => {
        expect(filterByUniversalQuery(mockMatchResult, '150,75')).toBe(true);
    });

    it('should not match by partial value', () => {
        expect(filterByUniversalQuery(mockMatchResult, '150')).toBe(false); // Exact match only
    });

    it('should match by partial name in contributor', () => {
        expect(filterByUniversalQuery(mockMatchResult, 'clara')).toBe(true);
    });

    it('should match by partial text in description', () => {
        expect(filterByUniversalQuery(mockMatchResult, 'pix de maria')).toBe(true);
    });

    it('should match multiple terms (AND logic)', () => {
        expect(filterByUniversalQuery(mockMatchResult, 'maria 10/09')).toBe(true);
    });

    it('should fail if one of multiple terms does not match', () => {
        expect(filterByUniversalQuery(mockMatchResult, 'maria 11/09')).toBe(false);
    });
    
    it('should handle transaction-only filtering', () => {
        const transaction: Transaction = { id: 't1', date: '10/09/2024', description: 'PIX de Maria Clara', amount: 150.75 };
        expect(filterTransactionByUniversalQuery(transaction, '150,75')).toBe(true);
        expect(filterTransactionByUniversalQuery(transaction, 'clara')).toBe(true);
        expect(filterTransactionByUniversalQuery(transaction, 'joao')).toBe(false);
    });
});