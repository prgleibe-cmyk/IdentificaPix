
import { Transaction, MatchResult } from '../../types';
import { NameResolver } from '../../core/processors/NameResolver';

/**
 * Lógica de filtragem UNIVERSAL e ROBUSTA (Idêntica ao SmartEditModal).
 * Suporta busca por partes de data (10/05, 10-05), valores flexíveis (100.50, 100,50) e texto.
 */
export const filterTransactionByUniversalQuery = (tx: Transaction, query: string): boolean => {
    if (!query || !query.trim()) return true;
    const terms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);

    // Prepare data for matching
    const rawDate = tx.date || '';
    const dateNormalized = rawDate.replace(/-/g, '/');
    const dateParts = dateNormalized.split('/');
    
    let dateBr = '';
    let dateShort = '';
    
    if (dateParts.length === 3) {
        if (dateParts[0].length === 4) { // ISO YYYY/MM/DD
            dateBr = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
            dateShort = `${dateParts[2]}/${dateParts[1]}`;
        } else { // DD/MM/YYYY
            dateBr = dateNormalized;
            dateShort = `${dateParts[0]}/${dateParts[1]}`;
        }
    } else if (dateParts.length === 2) {
        dateShort = dateNormalized;
    }

    // FIDELIDADE TOTAL: Busca no nome original entregue pelo modelo
    const displayDesc = (tx.cleanedDescription || tx.description || '').toLowerCase();
    const typeStr = (tx.contributionType || '').toLowerCase();
    
    // Flexible Amount Matching
    const amount = Math.abs(tx.amount);
    const amountStrFixed = amount.toFixed(2); // "100.50"
    const amountStrComma = amountStrFixed.replace('.', ','); // "100,50"
    const amountStrRaw = String(amount); // "100.5"

    return terms.every(term => {
        // 1. Text Match
        if (displayDesc.includes(term)) return true;
        if (typeStr.includes(term)) return true;

        // 2. Amount Match (Suporta padrão brasileiro 1.234,56)
        const termAsAmount = term.replace(/\./g, ''); // Remove separador de milhar para comparação
        if (amountStrFixed.includes(term)) return true;
        if (amountStrComma.includes(term) || amountStrComma.includes(termAsAmount)) return true;
        if (amountStrRaw.includes(term)) return true;

        // 3. Date Match (Robust)
        const dateTerm = term.replace(/[-.]/g, '/');
        if (rawDate.toLowerCase().includes(term)) return true;
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
    const rawDate = result.contributor?.date || tx.date || '';
    const dateNormalized = rawDate.replace(/-/g, '/');
    const dateParts = dateNormalized.split('/');
    
    let dateBr = '';
    let dateShort = '';
    
    if (dateParts.length === 3) {
        if (dateParts[0].length === 4) { // ISO YYYY/MM/DD
            dateBr = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
            dateShort = `${dateParts[2]}/${dateParts[1]}`;
        } else { // DD/MM/YYYY
            dateBr = dateNormalized;
            dateShort = `${dateParts[0]}/${dateParts[1]}`;
        }
    } else if (dateParts.length === 2) {
        dateShort = dateNormalized;
    }

    // Text Fields - FIDELIDADE TOTAL (Busca contra nomes originais)
    const displayDesc = (tx.cleanedDescription || tx.description || '').toLowerCase();
    
    const rawContributorName = result.contributor?.cleanedName || result.contributor?.name || '';
    const displayContributorName = rawContributorName.toLowerCase();
    
    const churchName = (result.church?.name || '').toLowerCase();
    const typeStr = (result.contributor?.contributionType || result.contributionType || '').toLowerCase();
    
    // Amount Fields
    const amount = Math.abs(result.contributorAmount ?? tx.amount);
    const amountStrFixed = amount.toFixed(2);
    const amountStrComma = amountStrFixed.replace('.', ',');
    const amountStrRaw = String(amount);

    return terms.every(term => {
        // 1. Text Match
        if (displayDesc.includes(term)) return true;
        if (displayContributorName.includes(term)) return true;
        if (churchName.includes(term)) return true;
        if (typeStr.includes(term)) return true;

        // 2. Amount Match (Suporta padrão brasileiro 1.234,56)
        const termAsAmount = term.replace(/\./g, ''); 
        if (amountStrFixed.includes(term)) return true;
        if (amountStrComma.includes(term) || amountStrComma.includes(termAsAmount)) return true;
        if (amountStrRaw.includes(term)) return true;

        // 3. Date Match (Robust)
        const dateTerm = term.replace(/[-.]/g, '/');
        if (rawDate.toLowerCase().includes(term)) return true;
        if (dateBr.includes(dateTerm)) return true;
        if (dateShort.includes(dateTerm)) return true;

        return false;
    });
};
