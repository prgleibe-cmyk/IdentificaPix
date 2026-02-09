import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V62 - ABSOLUTE TRUTH ENFORCEMENT)
 * -------------------------------------------------------
 * O modelo aprendido é a VERDADE ABSOLUTA.
 * Nenhuma limpeza, reescrita, normalização ou IA pode alterar o conteúdo.
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        const rawBase64 = adaptedInput?.__base64;

        if (!rawText.trim() && !rawBase64) return [];

        const { mapping } = model;

        /**
         * 🧱 MODO BLOCO (PDF / IA VISION)
         * O contrato aprendido é soberano.
         * Nenhuma reinterpretação é permitida.
         */
        if (mapping.extractionMode === 'BLOCK') {
            try {
                // Apenas executa o contrato, sem pós-processamento
                const aiResult = await extractTransactionsWithModel(
                    rawText,
                    mapping.blockContract || '',
                    rawBase64
                );

                const rows = Array.isArray(aiResult)
                    ? aiResult
                    : (aiResult?.rows || []);

                return rows.map((tx: any, idx: number) => ({
                    id: `viva-block-${model.id}-${idx}-${Date.now()}`,
                    date: tx.date,
                    description: tx.description,
                    rawDescription: tx.description,
                    amount: tx.amount,
                    originalAmount: String(tx.amount),
                    cleanedDescription: tx.description,
                    contributionType: tx.tipo || 'AUTO',
                    paymentMethod: tx.forma || 'OUTROS',
                    bank_id: model.id
                }));
            } catch (e) {
                console.error("[ContractExecutor] Falha na extração soberana:", e);
                return [];
            }
        }

        /**
         * 🚀 MODO COLUNAS (EXCEL / CSV)
         * Replica exatamente o modelo aprendido.
         */
        const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
        const results: Transaction[] = [];
        const currentYear = new Date().getFullYear();

        lines.forEach((line, idx) => {
            if (idx < (mapping.skipRowsStart || 0)) return;

            const delimiter = line.includes(';') ? ';' : (line.includes('\t') ? '\t' : ',');
            const cells = line.split(delimiter);

            const rawDate = cells[mapping.dateColumnIndex] || "";
            const rawDesc = cells[mapping.descriptionColumnIndex] || "";
            const rawAmount = cells[mapping.amountColumnIndex] || "";
            const rawForm = (mapping.paymentMethodColumnIndex !== undefined && mapping.paymentMethodColumnIndex >= 0)
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
