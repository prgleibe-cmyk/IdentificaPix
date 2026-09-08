
import { Language } from '../types';
import { 
    isChurchPeriodClosedSync, 
    isAnyChurchPeriodClosedSync, 
    getClosedPeriodsSetFromCache 
} from '../services/monthClosingService';

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
 * 🛡️ Retorna o conjunto de períodos (YYYY-MM) autoritativamente fechados.
 * Consulta o estado real dos fechamentos sem heurísticas frágeis baseadas em palavras em descrições.
 */
export const getClosedPeriodsSet = (matchResults?: any[], churchId?: string): Set<string> => {
    return getClosedPeriodsSetFromCache(churchId);
};

export const isDateInClosedPeriods = (dateStr: string, closedPeriodsSet: Set<string>): boolean => {
    if (!dateStr || !closedPeriodsSet || closedPeriodsSet.size === 0) return false;
    const cleanDate = dateStr.split(/[T ]/)[0];
    const parts = cleanDate.split('-');
    if (parts.length < 2) return false;
    return closedPeriodsSet.has(`${parts[0]}-${parts[1].padStart(2, '0')}`);
};

/**
 * 🛡️ Verifica de forma autoritativa se o período está fechado.
 * Respeita estritamente o estado real do fechamento (aberto vs reaberto vs fechado).
 * Quando o Usuário Principal desfaz o fechamento, o período é imediatamente liberado sem ressurreição.
 */
export const isPeriodClosed = (dateStr: string, matchResults?: any[], churchId?: string): boolean => {
    if (!dateStr) return false;

    // 1. Verificação autoritativa por Congregação + Período (Mês/Ano)
    if (churchId && churchId !== 'unidentified' && churchId !== 'geral') {
        return isChurchPeriodClosedSync(churchId, dateStr);
    }

    // 2. Se nenhuma congregação específica foi informada, checa se qualquer congregação possui fechamento ativo
    return isAnyChurchPeriodClosedSync(dateStr);
};

/**
 * Resolves a human-friendly Payment Method name (e.g., "PIX", "DINHEIRO", "BOLETO", "TRANSFERÊNCIA").
 * Cleans up internal technical tags like 'AUTO_SMS', 'AUTO', 'PIX_KEY', 'OUTROS' by inferring from transaction description or defaults.
 */
export const resolvePaymentMethod = (
    rawMethod?: string | null,
    description?: string | null,
    systemPaymentMethods?: string[]
): string => {
    const raw = (rawMethod || '').trim().toUpperCase();

    // Map internal inbox / SMS / notification tags directly to PIX
    if (['AUTO_SMS', 'AUTO', 'SMS', 'PIX_KEY', 'PIX_AUTO', 'PIX_NOTIF', 'NOTIFICACAO_SMS', 'NOTIF_SMS'].includes(raw)) {
        return 'PIX';
    }

    if (raw && !['OUTROS', 'OTHER', 'OUTRO', 'DESCONHECIDO', 'NÃO INFORMADO', '---', 'NULL', 'UNDEFINED'].includes(raw)) {
        return raw;
    }

    // Inspect description for payment method keywords
    const desc = (description || '').toUpperCase();
    if (desc.includes('PIX')) return 'PIX';
    if (desc.includes('TED')) return 'TED';
    if (desc.includes('DOC')) return 'DOC';
    if (desc.includes('BOLETO')) return 'BOLETO';
    if (desc.includes('DINHEIRO') || desc.includes('ESPECIE') || desc.includes('ESPÉCIE')) return 'DINHEIRO';
    if (desc.includes('CARTAO') || desc.includes('CARTÃO') || desc.includes('DEBITO') || desc.includes('CREDITO') || desc.includes('MASTERCARD') || desc.includes('VISA') || desc.includes('COMPRA')) return 'CARTÃO';
    if (desc.includes('TRANSF') || desc.includes('TRANSFERENCIA') || desc.includes('TRANSFERÊNCIA')) return 'TRANSFERÊNCIA';

    // If registered payment methods exist in system and include PIX, use PIX
    if (systemPaymentMethods && Array.isArray(systemPaymentMethods) && systemPaymentMethods.length > 0) {
        if (systemPaymentMethods.map(m => String(m).toUpperCase()).includes('PIX')) return 'PIX';
        return String(systemPaymentMethods[0]).toUpperCase();
    }

    return 'PIX';
};

/**
 * Resolves a specific Contribution Type (e.g., "DÍZIMO", "OFERTA", "MISSÕES", "CONSTRUÇÃO").
 * Replaces generic structural fallbacks like "ENTRADA" or "SAÍDA" with registered contribution types or inferred categories.
 */
export const resolveContributionType = (
    row: any,
    systemContributionTypes?: any[],
    systemKeywords?: string[]
): string => {
    if (!row) return 'DÍZIMO';

    if (row.splits && Array.isArray(row.splits) && row.splits.length > 0) {
        return 'RATEADO';
    }

    // Check raw contribution types in order of specificity
    const candidateValues = [
        row.contributor?.contributionType,
        row.contributionType,
        row.transaction?.contributionType,
        row.transaction?.category,
        row.transaction?.categoria,
        row.purpose,
        row.proposito
    ];

    for (const val of candidateValues) {
        if (val && typeof val === 'string') {
            const clean = val.trim().toUpperCase();
            if (clean && !['ENTRADA', 'SAÍDA', 'SAIDA', 'ENTRADAS', 'SAIDAS', 'INCOME', 'EXPENSE', '---', 'NONE', 'NULL', 'UNDEFINED'].includes(clean)) {
                return val.trim();
            }
        }
    }

    // If candidates were generic ('ENTRADA', etc.) or missing, analyze text content
    const textToSearch = [
        row.transaction?.description,
        row.transaction?.cleanedDescription,
        row.description,
        row.contributor?.name,
        row.contributor?.cleanedName
    ].filter(Boolean).join(' ').toUpperCase();

    // 1. Try matching registered contributionTypes
    if (systemContributionTypes && Array.isArray(systemContributionTypes) && systemContributionTypes.length > 0) {
        for (const ct of systemContributionTypes) {
            if (ct && ct.name) {
                const nameUpper = String(ct.name).toUpperCase();
                const normName = nameUpper.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const normText = textToSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (normText.includes(normName)) {
                    return ct.name;
                }
            }
        }
    }

    // 2. Fallback heuristic keyword checks
    const normSearch = textToSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normSearch.includes('DIZIMO') || normSearch.includes('TITHE')) return 'DÍZIMO';
    if (normSearch.includes('OFERTA') || normSearch.includes('OFFERING')) return 'OFERTA';
    if (normSearch.includes('MISSAO') || normSearch.includes('MISSOES')) return 'MISSÕES';
    if (normSearch.includes('CONSTRUCAO') || normSearch.includes('OBRA')) return 'CONSTRUÇÃO';
    if (normSearch.includes('CARNE') || normSearch.includes('PROPOSITO')) return 'CARNÊ & PROPÓSITO';

    // 3. Fallback for Expense vs Income
    const amount = row.transaction?.amount ?? row.amount ?? 0;
    const isExpense = amount < 0 || 
                      row.transaction?.type?.toLowerCase() === 'expense' || 
                      row.transaction?.type?.toLowerCase() === 'saida' ||
                      row.type === 'expense' ||
                      row.type === 'saida';

    if (isExpense) {
        return 'DESPESA GERAL';
    }

    // For Income, look for first registered 'entrada' type or default to 'DÍZIMO'
    if (systemContributionTypes && Array.isArray(systemContributionTypes) && systemContributionTypes.length > 0) {
        const entradaType = systemContributionTypes.find((ct: any) => ct.type === 'entrada' || !ct.type);
        if (entradaType && entradaType.name) {
            return entradaType.name;
        }
    }

    return 'DÍZIMO';
};

/**
 * Resolves the source of a transaction (e.g. 'Manual', 'SMS / Notif' vs 'Arquivo').
 */
export const resolveTransactionSource = (
    transaction?: any,
    parentRow?: any
): { label: string; isSms: boolean; isManual: boolean } => {
    if (!transaction && !parentRow) return { label: 'Arquivo', isSms: false, isManual: false };

    const tx = transaction || parentRow?.transaction || parentRow || {};
    const row = parentRow || {};

    const src = (tx.source || tx.origin || tx.__source || row.source || row.origin || '').toString().toLowerCase();
    const pixKey = (tx.pix_key || tx.pixKey || row.pix_key || row.pixKey || '').toString().toUpperCase();
    const desc = (tx.description || tx.rawDescription || tx.cleanedDescription || row.description || '').toString().toLowerCase();
    const rowHash = (tx.row_hash || tx.rowHash || row.row_hash || row.rowHash || '').toString().toLowerCase();
    const txId = (tx.id || row.id || '').toString();

    const isManualSource = 
        src === 'manual' || 
        src === 'manual_entry' || 
        src === 'lancamento_manual' ||
        tx.isManual === true || 
        tx.is_manual === true || 
        row.isManual === true || 
        row.is_manual === true ||
        txId.startsWith('ghost-manual-') ||
        rowHash.startsWith('manual_') ||
        rowHash.includes('|bmanual|');

    if (isManualSource) {
        return { label: 'Manual', isSms: false, isManual: true };
    }

    const isSmsSource = 
        src === 'sms' || src === 'inbox' || src === 'auto_sms' || src === 'notification' || src === 'push' || src === 'extensão' || src === 'extension' || src === 'android' ||
        pixKey === 'AUTO_SMS' || pixKey === 'SMS' || pixKey.includes('AUTO_SMS') || pixKey.includes('SMS') ||
        Boolean(tx.isSms || tx.is_sms || row.isSms || row.is_sms) ||
        rowHash.startsWith('sms_') || rowHash.includes('sms') ||
        desc.includes('notificacao sms') || desc.includes('notificação sms') || desc.includes('sms_') || desc.includes('auto_sms');

    if (isSmsSource) {
        return { label: 'SMS / Notif', isSms: true, isManual: false };
    }
    return { label: 'Arquivo', isSms: false, isManual: false };
};

