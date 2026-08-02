
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
    'DÍZIMO', 'OFERTA'
];

/**
 * Normalização Estrita (DNA da Transação):
 * Transforma a descrição em uma chave de comparação fiel e imutável.
 */
export const strictNormalize = (str: string): string => {
    if (!str) return '';
    return str
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^A-Z0-9]/g, '')      // REMOVE TUDO exceto letras e números (DNA PURO)
        .trim();
};

/**
 * Extrai códigos numéricos significativos de uma string.
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
export const normalizeString = (str: string): string => {
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

/**
 * Verifica se uma string de nome é inválida, vazia, puramente numérica ou um valor/moeda formatado (ex: "16000,00", "16.000,00", "R$ 16.000,00", "16000").
 */
export const isInvalidOrNumericName = (name: string | undefined | null, txDescription?: string): boolean => {
    if (!name) return true;
    const trimmed = String(name).trim();
    if (!trimmed) return true;

    // Se for puramente numérico ou valor/moeda formatado
    // Ex: "16000,00", "16.000,00", "16000.00", "16000", "R$ 16.000,00", "-150,00", "50,00C", "50,00D"
    const numericOrCurrencyRegex = /^[\sR$\-+]?[\d.,]+[CDcd]?$/;
    if (numericOrCurrencyRegex.test(trimmed)) return true;

    // Se for apenas números e pontuação
    const numbersOnly = trimmed.replace(/[^\d]/g, '');
    const lettersOnly = trimmed.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
    if (lettersOnly.length === 0 && numbersOnly.length > 0) return true;

    // Se for igual à descrição do banco quando a descrição é genérica/numérica
    if (txDescription && trimmed.toUpperCase() === txDescription.trim().toUpperCase()) {
        if (numericOrCurrencyRegex.test(txDescription.trim())) return true;
    }

    // Se for palavra de sistema/cabeçalho conhecido ou operação financeira automática
    const systemKeywords = ['SALDO', 'RESUMO', 'EXTRATO', 'DEMONSTRATIVO', 'PERÍODO', 'PERIODO', 'TOTAL', 'SICOOB', 'SICREDI', 'RECEBIMENTO', 'LANCAMENTO', 'LANÇAMENTO', 'RDC', 'AUTOMATICO', 'AUTOMÁTICO', 'RESGATE', 'APLIC'];
    const upper = trimmed.toUpperCase();
    if (systemKeywords.some(k => upper.includes(k))) {
        if (
            upper.includes('SALDO') || upper.includes('RESUMO') || upper.includes('EXTRATO') || 
            upper.includes('DEMONSTRATIVO') || upper.includes('PERIODO') || upper.includes('PERÍODO') || 
            upper === 'TOTAL' || upper.includes('RDC') || upper.includes('AUTOMATICO') || upper.includes('AUTOMÁTICO') ||
            upper.includes('RESGATE')
        ) {
            return true;
        }
    }

    return false;
};

/**
 * Retorna o nome de exibição resolvido com fidelidade absoluta à Verdade:
 * Se houver nome de contribuinte válido (não numérico/não valor), usa o nome do contribuinte.
 * Caso contrário, utiliza a descrição autêntica da transação bancária.
 */
export const getResolvedDisplayName = (row: { contributor?: any; transaction?: any } | null | undefined): string => {
    if (!row) return '';
    const contribName = row.contributor?.cleanedName || row.contributor?.name;
    if (contribName && !isInvalidOrNumericName(contribName, row.transaction?.description)) {
        return String(contribName).trim().toUpperCase();
    }
    const txDesc = row.transaction?.cleanedDescription || row.transaction?.description || '';
    return String(txDesc).trim().toUpperCase();
};

