
import { Language } from '../types';

/**
 * Formats a number as a currency string according to Brazilian (BRL) standards.
 * @param amount The number to format.
 * @param language The current language for locale-specific formatting.
 * @returns A formatted currency string (e.g., "R$ 1.234,56").
 */
export const formatCurrency = (amount: any, language: Language = 'pt'): string => {
    let num = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (isNaN(num)) num = 0;
    return new Intl.NumberFormat(language, { 
        style: 'currency', 
        currency: 'BRL' 
    }).format(num);
};

/**
 * Converte data ISO (YYYY-MM-DD) para formato brasileiro (DD/MM/AAAA).
 */
export const formatDate = (isoDate: string): string => {
    if (!isoDate || typeof isoDate !== 'string') return '';
    // Se já estiver com barras, assume que já está formatado ou é original
    if (isoDate.includes('/')) return isoDate;
    
    // Se for formato ISO completo (YYYY-MM-DDTHH:mm:ss...), extrai apenas a parte da data (YYYY-MM-DD)
    const cleanDate = isoDate.split(/[T ]/)[0];
    
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        // YYYY-MM-DD -> DD/MM/AAAA
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
};

/**
 * Checks if a given period (month and year) is definitively closed.
 * A period is closed if there is any confirmed transaction in that month and year
 * that represents a period closure (e.g., description containing "FECHAMENTO").
 */
export const isPeriodClosed = (dateStr: string, matchResults: any[]): boolean => {
    if (!dateStr || !matchResults || !Array.isArray(matchResults)) return false;
    
    // Parse the input date
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return false;
    
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth(); // 0-11
    
    return matchResults.some(r => {
        const txDateStr = r.transaction?.date || r.transaction_date || r.date;
        if (!txDateStr) return false;
        
        const txDate = new Date(txDateStr);
        if (isNaN(txDate.getTime())) return false;
        
        if (txDate.getFullYear() !== year || txDate.getMonth() !== month) return false;
        
        // Must be confirmed to represent a definitive closure
        const isConfirmed = r.isConfirmed || r.transaction?.isConfirmed || r.is_confirmed;
        if (!isConfirmed) return false;
        
        const desc = (r.transaction?.description || r.description || '').toUpperCase();
        return desc.includes('FECHAMENTO') || desc.includes('RECEBIMENTO') || desc.includes('FECHAMENTO DE CAIXA');
    });
};

