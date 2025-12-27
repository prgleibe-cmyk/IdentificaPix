
import { Language } from '../types';

/**
 * Formats a number as a currency string according to Brazilian (BRL) standards.
 * @param amount The number to format.
 * @param language The current language for locale-specific formatting.
 * @returns A formatted currency string (e.g., "R$ 1.234,56").
 */
export const formatCurrency = (amount: number, language: Language = 'pt'): string => {
    return new Intl.NumberFormat(language, { 
        style: 'currency', 
        currency: 'BRL' 
    }).format(amount);
};

/**
 * Converte data ISO (YYYY-MM-DD) para formato brasileiro (DD/MM/AAAA).
 */
export const formatDate = (isoDate: string): string => {
    if (!isoDate) return '';
    // Se já estiver com barras, assume que já está formatado ou é original
    if (isoDate.includes('/')) return isoDate;
    
    const parts = isoDate.split('-');
    if (parts.length === 3) {
        // YYYY-MM-DD -> DD/MM/AAAA
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
};
