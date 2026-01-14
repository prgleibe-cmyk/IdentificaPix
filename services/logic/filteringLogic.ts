
import { Transaction, MatchResult } from '../../types';

/**
 * Lógica de filtragem UNIVERSAL e ROBUSTA (Idêntica ao SmartEditModal).
 * Suporta busca por partes de data (10/05, 10-05), valores flexíveis (100.50, 100,50) e texto.
 */
export const filterTransactionByUniversalQuery = (tx: Transaction, query: string): boolean => {
    if (!query || !query.trim()) return true;
    const terms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);

    // Prepare data for matching
    const dateIso = tx.date ? tx.date.toLowerCase() : '';
    let dateBr = '';
    let dateShort = '';
    
    if (tx.date) {
        const parts = tx.date.split('-'); // ISO YYYY-MM-DD
        if (parts.length === 3) {
            dateBr = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/AAAA
            dateShort = `${parts[2]}/${parts[1]}`; // DD/MM
        }
    }

    const descStr = (tx.cleanedDescription || tx.description || '').toLowerCase();
    const typeStr = (tx.contributionType || '').toLowerCase();
    
    // Flexible Amount Matching
    const amount = Math.abs(tx.amount);
    const amountStrFixed = amount.toFixed(2); // "100.50"
    const amountStrComma = amountStrFixed.replace('.', ','); // "100,50"
    const amountStrRaw = String(amount); // "100.5"

    return terms.every(term => {
        // 1. Text Match
        if (descStr.includes(term)) return true;
        if (typeStr.includes(term)) return true;

        // 2. Amount Match
        if (amountStrFixed.includes(term)) return true;
        if (amountStrComma.includes(term)) return true;
        if (amountStrRaw.includes(term)) return true;

        // 3. Date Match (Robust)
        // Normalize term for date matching (allow 10-10 or 10.10 to match 10/10)
        const dateTerm = term.replace(/[-.]/g, '/');
        
        if (dateIso.includes(term)) return true;
        if (dateBr.includes(dateTerm)) return true;
        if (dateShort.includes(dateTerm)) return true;

        return false;
    });
};

/**
 * Lógica de filtragem UNIVERSAL e ROBUSTA para Resultados de Conciliação.
 */
export const filterByUniversalQuery = (result: MatchResult, query: string): boolean => {
    if (!query || !query.trim()) return true;
    const terms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    
    const tx = result.transaction;
    
    // Dates (Prefer Contributor Date if matched, else Tx Date)
    const rawDate = result.contributor?.date || tx.date;
    const dateIso = rawDate ? rawDate.toLowerCase() : '';
    let dateBr = '';
    let dateShort = '';
    
    if (rawDate) {
        const parts = rawDate.split('-'); // ISO YYYY-MM-DD
        if (parts.length === 3) {
            dateBr = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/AAAA
            dateShort = `${parts[2]}/${parts[1]}`; // DD/MM
        }
    }

    // Text Fields
    const descStr = (tx.cleanedDescription || tx.description || '').toLowerCase();
    const contribName = (result.contributor?.name || '').toLowerCase();
    const contribCleanedName = (result.contributor?.cleanedName || '').toLowerCase();
    const churchName = (result.church?.name || '').toLowerCase();
    const typeStr = (result.contributor?.contributionType || result.contributionType || '').toLowerCase();
    
    // Amount Fields
    const amount = Math.abs(result.contributorAmount ?? tx.amount);
    const amountStrFixed = amount.toFixed(2);
    const amountStrComma = amountStrFixed.replace('.', ',');
    const amountStrRaw = String(amount);

    return terms.every(term => {
        // 1. Text Match
        if (descStr.includes(term)) return true;
        if (contribName.includes(term)) return true;
        if (contribCleanedName.includes(term)) return true;
        if (churchName.includes(term)) return true;
        if (typeStr.includes(term)) return true;

        // 2. Amount Match
        if (amountStrFixed.includes(term)) return true;
        if (amountStrComma.includes(term)) return true;
        if (amountStrRaw.includes(term)) return true;

        // 3. Date Match (Robust)
        const dateTerm = term.replace(/[-.]/g, '/');
        
        if (dateIso.includes(term)) return true;
        if (dateBr.includes(dateTerm)) return true;
        if (dateShort.includes(dateTerm)) return true;

        return false;
    });
};
