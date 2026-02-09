import { Transaction, FileModel } from '../../types';

/**
 * 📜 CONTRACT EXECUTOR (V66 - SAFE DETERMINISTIC)
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
            const learnedRows =
                mapping.blockRows ??
                mapping.rows ??
                mapping.learnedRows ??
                adaptedInput?.__blockRows ??
                adaptedInput?.__rows ??
                adaptedInput?.__learnedRows ??
                [];

            if (!Array.isArray(learnedRows) || learnedRows.length === 0) {
                console.warn('[ContractExecutor] BLOCK sem dados aprendidos no modelo.');
                return [];
            }

            return learnedRows.map((tx: any, idx: number) => ({
                id: `viva-block-${model.id}-${idx}-${Date.now()}`,
                date: tx.date,
                description: tx.description,
                rawDescription: tx.description,
                amount: Number(tx.amount),
                originalAmount: String(tx.amount),
                cleanedDescription: tx.description,
                contributionType: tx.tipo || 'AUTO',
                paymentMethod: tx.forma || 'OUTROS',
                bank_id: model.id
            }));
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

            const cells = line.split(delimiter);

            const rawDate = cells[mapping.dateColumnIndex] || "";
            const rawDesc = cells[mapping.descriptionColumnIndex] || "";
            const rawAmount = cells[mapping.amountColumnIndex] || "";
            const rawForm =
                (mapping.paymentMethodColumnIndex !== undefined &&
                 mapping.paymentMethodColumnIndex >= 0)
                    ? cells[mapping.paymentMethodColumnIndex]
                    : "";

            if (!rawDate && !rawDesc && !rawAmount) return;

            // 🛡️ Proteção de data inválida
            if (!rawDate || rawDate.trim().length < 4) return;

            const numAmount = Number(
                String(rawAmount).replace(/\./g, '').replace(',', '.')
            );

            results.push({
                id: `viva-col-${model.id}-${idx}-${Date.now()}`,
                date: rawDate,
                description: rawDesc,
                rawDescription: rawDesc,
                amount: isNaN(numAmount) ? 0 : numAmount,
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
