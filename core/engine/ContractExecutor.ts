import { Transaction, FileModel } from '../../types';

/**
 * 📜 CONTRACT EXECUTOR (V68 - SAFE HYDRATED BLOCK)
 * -------------------------------------------------------
 * O modelo aprendido é a VERDADE ABSOLUTA.
 * IA é proibida na execução.
 * Nenhuma inferência, OCR ou adivinhação é permitida.
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        const { mapping } = model;

        /**
         * 🧱 MODO BLOCO (PDF / VISUAL)
         * Executa apenas dados aprendidos e persistidos.
         */
        if (mapping.extractionMode === 'BLOCK') {
            const learnedRows = hydrateBlockRows(mapping);

            if (!Array.isArray(learnedRows) || learnedRows.length === 0) {
                console.warn('[ContractExecutor] BLOCK sem dados aprendidos no modelo.');
                return [];
            }

            return learnedRows
                .filter((tx: any) => tx && (tx.date || tx.description || tx.amount))
                .map((tx: any, idx: number) => {
                    const safeDate = normalizeDate(tx.date);
                    if (!safeDate) return null;

                    const numAmount = normalizeAmount(tx.amount);

                    return {
                        id: `viva-block-${model.id}-${idx}-${Date.now()}`,
                        date: safeDate,
                        description: String(tx.description || '').trim(),
                        rawDescription: String(tx.description || '').trim(),
                        amount: numAmount,
                        originalAmount: String(tx.amount || ''),
                        cleanedDescription: String(tx.description || '').trim(),
                        contributionType: tx.tipo || (numAmount >= 0 ? 'ENTRADA' : 'SAÍDA'),
                        paymentMethod: tx.forma || 'OUTROS',
                        bank_id: model.id
                    };
                })
                .filter(Boolean) as Transaction[];
        }

        /**
         * 🚀 MODO COLUNAS (EXCEL / CSV)
         * Determinístico e seguro.
         */
        if (!rawText?.trim()) return [];

        const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
        const results: Transaction[] = [];

        lines.forEach((line, idx) => {
            if (idx < (mapping.skipRowsStart || 0)) return;

            const delimiter = line.includes(';')
                ? ';'
                : (line.includes('\t') ? '\t' : ',');

            const cells = line.split(delimiter).map(c => String(c || '').trim());

            const rawDate = cells[mapping.dateColumnIndex] || "";
            const rawDesc = cells[mapping.descriptionColumnIndex] || "";
            const rawAmount = cells[mapping.amountColumnIndex] || "";
            const rawForm =
                (mapping.paymentMethodColumnIndex !== undefined &&
                 mapping.paymentMethodColumnIndex >= 0)
                    ? cells[mapping.paymentMethodColumnIndex]
                    : "";

            if (!rawDate && !rawDesc && !rawAmount) return;

            const safeDate = normalizeDate(rawDate);
            if (!safeDate) return;

            const numAmount = normalizeAmount(rawAmount);

            results.push({
                id: `viva-col-${model.id}-${idx}-${Date.now()}`,
                date: safeDate,
                description: rawDesc,
                rawDescription: rawDesc,
                amount: numAmount,
                originalAmount: rawAmount,
                cleanedDescription: rawDesc,
                contributionType: isNaN(numAmount) ? 'AUTO' : (numAmount >= 0 ? 'ENTRADA' : 'SAÍDA'),
                paymentMethod: rawForm || 'OUTROS',
                bank_id: model.id
            });
        });

        return results;
    }
};

/**
 * 🧱 Hidrata blockRows vindos do banco/build
 */
function hydrateBlockRows(mapping: any): any[] {
    let rows =
        mapping.blockRows ??
        mapping.rows ??
        mapping.learnedRows ??
        [];

    if (typeof rows === 'string') {
        try {
            rows = JSON.parse(rows);
        } catch {
            rows = [];
        }
    }

    if (!Array.isArray(rows) && typeof rows === 'object') {
        rows = Object.values(rows);
    }

    return Array.isArray(rows) ? rows : [];
}

/**
 * 🛡️ Normaliza datas e bloqueia valores inválidos
 */
function normalizeDate(input: any): string | null {
    if (!input) return null;

    const raw = String(input).trim();
    if (!raw) return null;
    if (raw === '0000-00-00') return null;

    // dd/mm/yyyy
    if (raw.includes('/')) {
        const [d, m, y] = raw.split('/');
        if (y && y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    return null;
}

/**
 * 🛡️ Normaliza valores monetários
 */
function normalizeAmount(input: any): number {
    if (input === null || input === undefined) return 0;

    const num = Number(
        String(input)
            .replace(/\s/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
    );

    return isNaN(num) ? 0 : num;
}
