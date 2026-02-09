import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';

/**
 * 📜 CONTRACT EXECUTOR (V64 - DETERMINISTIC BLOCK)
 * -------------------------------------------------------
 * O modelo aprendido é a VERDADE ABSOLUTA.
 * IA é proibida na execução.
 * Nenhuma limpeza, inferência ou reinterpretação é permitida.
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        if (!rawText?.trim() && model.mapping.extractionMode !== 'BLOCK') return [];

        const { mapping } = model;

        /**
         * 🧱 MODO BLOCO (PDF / VISUAL)
         * EXECUÇÃO DETERMINÍSTICA.
         * Usa exclusivamente o que foi aprendido e salvo no modelo.
         */
        if (mapping.extractionMode === 'BLOCK') {
            const learnedRows =
                mapping.blockRows ||
                mapping.rows ||
                mapping.learnedRows ||
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
         * Também determinístico: replica o modelo, sem IA.
         */
        const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
        const results: Transaction[] = [];
        const currentYear = new Date().getFullYear();

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

            const isoDate = DateResolver.resolveToISO(rawDate, currentYear);
            const stdAmount = AmountResolver.clean(rawAmount);
            const numAmount = parseFloat(stdAmount);

            if (isoDate && !isNaN(numAmount)) {
                results.push({
                    id: `viva-col-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: rawDesc,
                    rawDescription: rawDesc,
                    amount: numAmount,
                    originalAmount: rawAmount,
                    cleanedDescription: rawDesc,
                    contributionType: numAmount >= 0 ? 'ENTRADA' : 'SAÍDA',
                    paymentMethod: rawForm || 'OUTROS',
                    bank_id: model.id
                });
            }
        });

        return results;
    }
};
