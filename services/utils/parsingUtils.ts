
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

/**
 * Normalização Estrita (DNA da Transação):
 * Transforma a descrição em uma chave de comparação fiel.
 * Preserva números (CPF/CNPJ/CÓDIGOS), remove acentos e colapsa espaços.
 */
export const strictNormalize = (str: string): string => {
    if (!str) return '';
    return str
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^A-Z0-9\s]/g, ' ')   // Mantém letras e números
        .replace(/\s+/g, ' ')           // Colapsa espaços
        .trim();
};

/**
 * Extrai códigos numéricos significativos de uma string (DNA identificador).
 */
export const extractIdentifyingCode = (str: string): string | null => {
    if (!str) return null;
    const matches = str.match(/\d{4,14}/g);
    if (matches && matches.length > 0) {
        return matches.sort((a, b) => b.length - a.length)[0];
    }
    return null;
};

/**
 * Normalização Robusta para Matching Geral.
 */
export const normalizeString = (str: string, _ignoreKeywords: string[] = []): string => {
    if (!str) return '';
    const cleaned = NameResolver.clean(str);
    return NameResolver.normalize(cleaned);
};

export const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const clean = dateString.trim().replace(/\/|\\/g, '-');
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return new Date(clean);

    const parts = clean.split('-');
    if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        else return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return null;
};

export const cleanTransactionDescriptionForDisplay = (description: string): string => {
    return description || '';
};
