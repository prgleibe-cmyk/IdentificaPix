
import { Church } from '../../types';
import { NameResolver } from '../../core/processors/NameResolver';

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
 * Normalização usada apenas para busca e matching interno.
 */
export const normalizeString = (str: string, ignoreKeywords: string[] = []): string => {
    if (!str) return '';
    // No modo modelo, ignoreKeywords será vazio, mantendo a string original para o match
    if (ignoreKeywords.length === 0) return NameResolver.normalize(str);
    return NameResolver.normalize(NameResolver.clean(str, ignoreKeywords));
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

// FUNÇÕES DE EXIBIÇÃO: Retornam o texto original sem modificações
export const cleanTransactionDescriptionForDisplay = (description: string): string => {
    return description || '';
};

export const formatIncomeDescription = (description: string): string => {
    return description || '';
};

export const formatExpenseDescription = (description: string): string => {
    return description || '';
};
