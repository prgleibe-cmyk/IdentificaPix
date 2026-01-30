import { Transaction, MatchResult, SearchFilters } from '../../types';
import { NameResolver } from '../../core/processors/NameResolver';
import { parseDate } from '../utils/parsingUtils';

/**
 * Lógica de filtragem UNIVERSAL e ROBUSTA.
 * Suporta busca por partes de data, valores flexíveis e texto.
 */
export const filterTransactionByUniversalQuery = (tx: Transaction, query: string): boolean => {
    if (!query || !query.trim() || !tx) return true;
    const terms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);

    const rawDate = tx.date || '';
    const dateNormalized = rawDate.replace(/-/g, '/');
    const dateParts = dateNormalized.split('/');
    
    let dateBr = '';
    let dateShort = '';
    
    if (dateParts.length === 3) {
        if (dateParts[0].length === 4) {
            dateBr = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
            dateShort = `${dateParts[2]}/${dateParts[1]}`;
        } else {
            dateBr = dateNormalized;
            dateShort = `${dateParts[0]}/${dateParts[1]}`;
        }
    }

    const displayDesc = (tx.cleanedDescription || tx.description || '').toLowerCase();
    const typeStr = (tx.contributionType || '').toLowerCase();
    
    const amount = Math.abs(tx.amount || 0);
    const amountStrFixed = amount.toFixed(2);
    const amountStrComma = amountStrFixed.replace('.', ',');

    return terms.every(term => {
        if (displayDesc.includes(term)) return true;
        if (typeStr.includes(term)) return true;
        if (amountStrFixed.includes(term)) return true;
        if (amountStrComma.includes(term)) return true;
        const dateTerm = term.replace(/[-.]/g, '/');
        if (dateBr.includes(dateTerm) || dateShort.includes(dateTerm)) return true;
        return false;
    });
};

/**
 * Lógica de filtragem para Resultados de Conciliação.
 */
export const filterByUniversalQuery = (result: MatchResult, query: string): boolean => {
    if (!query || !query.trim() || !result) return true;
    return filterTransactionByUniversalQuery(result.transaction, query);
};

/**
 * APLICA FILTROS AVANÇADOS (BLINDAGEM V4 - ESTÁVEL)
 */
export const applyAdvancedFilters = (results: MatchResult[], filters: SearchFilters): MatchResult[] => {
    try {
        if (!Array.isArray(results)) return [];
        if (!filters) return results;

        let data = [...results];

        // 1. Tipo de Transação
        if (filters.transactionType && filters.transactionType !== 'all') {
            if (filters.transactionType === 'income') {
                data = data.filter(r => {
                    const amt = r.status === 'PENDENTE' ? (r.contributorAmount ?? r.transaction?.amount) : r.transaction?.amount;
                    return typeof amt === 'number' ? amt >= 0 : true;
                });
            } else if (filters.transactionType === 'expenses') {
                data = data.filter(r => {
                    const amt = r.status === 'PENDENTE' ? (r.contributorAmount ?? r.transaction?.amount) : r.transaction?.amount;
                    return typeof amt === 'number' ? amt < 0 : true;
                });
            }
        }

        // 2. Status da Conciliação
        if (filters.reconciliationStatus && filters.reconciliationStatus !== 'all') {
            switch (filters.reconciliationStatus) {
                case 'confirmed_any':
                    data = data.filter(r => r.status === 'IDENTIFICADO');
                    break;
                case 'unconfirmed':
                    data = data.filter(r => r.status === 'NÃO IDENTIFICADO');
                    break;
                case 'confirmed_auto':
                    data = data.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod || r.matchMethod === 'TEMPLATE'));
                    break;
                case 'confirmed_manual':
                    data = data.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));
                    break;
            }
        }

        // 3. Categoria
        if (filters.filterBy === 'contributor' && filters.contributorName?.trim()) {
            const query = filters.contributorName.toLowerCase().trim();
            data = data.filter(r => {
                const name = (r.contributor?.cleanedName || r.contributor?.name || r.transaction?.cleanedDescription || r.transaction?.description || '').toLowerCase();
                return name.includes(query);
            });
        }
        
        if (filters.filterBy === 'church' && Array.isArray(filters.churchIds) && filters.churchIds.length > 0) {
            data = data.filter(r => r.church?.id && filters.churchIds.includes(r.church.id));
        }

        // 4. Período
        if (filters.dateRange && (filters.dateRange.start || filters.dateRange.end)) {
            const startStr = filters.dateRange.start?.trim();
            const endStr = filters.dateRange.end?.trim();
            
            const startDate = startStr ? new Date(startStr).getTime() : null;
            const endDate = endStr ? new Date(endStr).getTime() + 86400000 : null;
            
            if (startDate || endDate) {
                data = data.filter(r => {
                    const dateStr = r.status === 'PENDENTE' ? (r.contributor?.date || r.transaction?.date) : r.transaction?.date;
                    if (!dateStr) return true;

                    const parsed = parseDate(dateStr);
                    if (!parsed) return true;

                    const itemDate = parsed.getTime();
                    if (startDate && itemDate < startDate) return false;
                    if (endDate && itemDate >= endDate) return false;
                    return true;
                });
            }
        }

        // 5. Valor
        const vFilter = filters.valueFilter;
        // Fix: Removed unintentional comparison between number and string on line 129. vFilter.value1 is number | null.
        const hasValue1 = vFilter && vFilter.value1 !== null && vFilter.value1 !== undefined;

        if (vFilter && vFilter.operator !== 'any' && hasValue1) {
            data = data.filter(r => {
                const raw = r.status === 'PENDENTE' ? (r.contributorAmount ?? r.transaction?.amount) : r.transaction?.amount;
                if (typeof raw !== 'number') return true;

                const amount = Math.abs(raw);
                const val1 = Number(vFilter.value1);
                const val2 = Number(vFilter.value2);

                switch (vFilter.operator) {
                    case 'exact': return Math.abs(amount - val1) < 0.01;
                    case 'gt': return amount > val1;
                    case 'lt': return amount < val1;
                    case 'between': 
                        if (!vFilter.value2 && vFilter.value2 !== 0) return amount >= val1;
                        return amount >= val1 && amount <= val2;
                    default: return true;
                }
            });
        }

        return data || [];
    } catch (error) {
        console.error("[applyAdvancedFilters] Erro fatal na filtragem:", error);
        return Array.isArray(results) ? results : [];
    }
};