
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
 * Extrai códigos numéricos significativos de uma string (DNA identificador).
 * Busca sequências de 4 ou mais dígitos que costumam ser partes fixas de CPF/CNPJ.
 */
export const extractIdentifyingCode = (str: string): string | null => {
    if (!str) return null;
    // Busca sequências de números. Ignora pontos, traços e barras.
    const cleanNumbers = str.replace(/\D/g, '');
    
    // Se a string tem uma sequência longa de números, essa é a nossa âncora
    const matches = str.match(/\d{4,14}/g);
    if (matches && matches.length > 0) {
        // Retorna a maior sequência numérica encontrada como código de identificação
        return matches.sort((a, b) => b.length - a.length)[0];
    }
    return null;
};

export const normalizeString = (str: string, ignoreKeywords: string[] = []): string => {
    if (!str) return '';
    return NameResolver.normalize(str);
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
