import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';
import * as XLSX from 'xlsx';

/**
 * 📜 CONTRACT EXECUTOR (V64 - ABSOLUTE MODEL TRUTH)
 * -------------------------------------------------------
 * O modelo aprendido é a VERDADE ABSOLUTA.
 * Nenhuma normalização, limpeza ou leitura paralela pode alterar o conteúdo.
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || "";
        const rawBase64 = adaptedInput?.__base64;

        if (!rawText.trim() && !rawBase64) return [];

        const { mapping } = model;

        /**
         * 🧱 BLOCK MODE (PDF / IA / VISUAL CONTRACT)
         */
        if (mapping.extractionMode === 'BLOCK') {
            const trainingContext = mapping.blockContract || 'Extração fiel conforme modelo aprendido.';

            try {
                const aiResult = await extractTransactionsWithModel(rawText, trainingContext, rawBase64);
                const rows = Array.isArray(aiResult) ? aiResult : (aiResult?.rows || []);

                return rows.map((tx: any, idx: number) => ({
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
            } catch (e) {
                console.error("[ContractExecutor] Erro BLOCK:", e);
                return [];
            }
        }

        /**
         * 🚀 COLUMN MODE (EXCEL / CSV / TXT)
         */
        let lines: string[][] = [];

        if (rawBase64 && rawText === '[BINARY_MODE_ACTIVE]') {
            try {
                const workbook = XLSX.read(rawBase64, { type: 'base64' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                lines = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];
            } catch (e) {
                console.error("[ContractExecutor] Erro XLSX:", e);
                return [];
            }
        } else {
            const delimiter = rawText.includes(';')
                ? ';'
                : rawText.includes('\t')
                ? '\t'
                : ',';

            lines = rawText
                .split(/\r?\n/)
                .filter(l => l.trim())
                .map(line => line.split(delimiter));
        }

        const results: Transaction[] = [];
        const currentYear = new Date().getFullYear();

        lines.forEach((cells, idx) => {
            if (idx < (mapping.skipRowsStart || 0)) return;

            const rawDate = cells[mapping.dateColumnIndex] || "";
            const rawDesc = cells[mapping.descriptionColumnIndex] || "";
            const rawAmount = cells[mapping.amountColumnIndex] || "";
            const rawForm =
                mapping.paymentMethodColumnIndex !== undefined &&
                mapping.paymentMethodColumnIndex >= 0
                    ? cells[mapping.paymentMethodColumnIndex]
                    : "";

            if (!rawDate && !rawDesc && !rawAmount) return;

            const isoDate = DateResolver.resolveToISO(String(rawDate), currentYear);
            const stdAmount = AmountResolver.clean(rawAmount);
            const numAmount = parseFloat(stdAmount);

            if (isoDate && !isNaN(numAmount)) {
                results.push({
                    id: `viva-col-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: String(rawDesc),
                    rawDescription: String(rawDesc),
                    amount: numAmount,
                    originalAmount: String(rawAmount),
                    cleanedDescription: String(rawDesc),
                    contributionType: numAmount >= 0 ? 'ENTRADA' : 'SAÍDA',
                    paymentMethod: String(rawForm) || 'OUTROS',
                    bank_id: model.id
                });
            }
        });

        return results;
    }
};
