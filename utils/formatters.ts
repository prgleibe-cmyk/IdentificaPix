import { Language } from '../types';
import { GroupedReportData, SavedReportRow, Church } from '../types'; // Ajuste os caminhos se necessário

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
 * Rehydrates report data from the saved format, replacing churchId with full church objects.
 * @param data The saved report data grouped by churchId.
 * @param churches The list of all available churches.
 * @returns GroupedReportData with full church objects.
 */
export const rehydrateReportData = (data: Record<string, SavedReportRow[]>, churches: Church[]): GroupedReportData => {
    const rehydrated: GroupedReportData = {};

    for (const churchId in data) {
        const church = churches.find(c => c.id === churchId);
        if (!church) continue;

        rehydrated[churchId] = data[churchId].map(row => ({
            ...row,
            church,
        }));
    }

    return rehydrated;
};
