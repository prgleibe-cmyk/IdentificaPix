
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

export const normalizeString = (str: string, ignoreKeywords: string[] = []): string => {
    if (!str) return '';
    let cleaned = NameResolver.clean(str, ignoreKeywords);
    if (!cleaned || cleaned.trim().length === 0) cleaned = str;
    return NameResolver.normalize(cleaned).toLowerCase();
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
