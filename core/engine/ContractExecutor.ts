import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';
import * as XLSX from 'xlsx';

/**
 * 📜 CONTRACT EXECUTOR (V65 - ZERO INTERPRETATION ENFORCED)
 * -------------------------------------------------------
 * O modelo é a única autoridade. Proibido interpretadores genéricos.
 * Fluxo: Entrada Bruta -> Regras do Modelo -> Resultado Final.
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || "";
        const rawBase64 = adaptedInput?.__base64;

        if (!rawText.trim() && !rawBase64) return [];

        const { mapping } = model;

        /**
         * 🧱 MODO BLOCO (IA / PDF)
         * Executa o contrato visual aprendido no laboratório.
         */
        if (mapping.extractionMode === 'BLOCK') {
            const trainingContext = mapping.blockContract || 'Extração fiel ao modelo aprendido.';

            try {
                const aiResult = await extractTransactionsWithModel(rawText, trainingContext, rawBase64);
                const rows = Array.isArray(aiResult) ? aiResult : (aiResult?.rows || []);

                return rows.map((tx: any, idx: number) => ({
                    id: `viva-block-${model.id}-${idx}-${Date.now()}`,
                    date: tx.date,
                    description: tx.description, // Sem NameResolver.clean global
                    rawDescription: tx.description,
                    amount: Number(tx.amount),
                    originalAmount: String(tx.amount),
                    cleanedDescription: tx.description,
                    contributionType: tx.tipo || 'AUTO',
                    paymentMethod: tx.forma || 'OUTROS',
                    bank_id: model.id
                }));
            } catch (e) {
                console.error("[ContractExecutor] Falha na soberania da IA:", e);
                return [];
            }
        }

        /**
         * 🚀 MODO COLUNAS (EXCEL / CSV / TXT)
         * Aplica o mapa físico de colunas definido no modelo.
         */
        let lines: string[][] = [];

        if (rawBase64 && rawText === '[BINARY_MODE_ACTIVE]') {
            try {
                const workbook = XLSX.read(rawBase64, { type: 'base64' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                lines = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];
            } catch (e) {
                console.error("[ContractExecutor] Erro no parsing binário do modelo:", e);
                return [];
            }
        } else {
            const delimiter = rawText.includes(';') ? ';' : (rawText.includes('\t') ? '\t' : ',');
            lines = rawText.split(/\r?\n/).filter(l => l.trim()).map(line => line.split(delimiter));
        }

        const results: Transaction[] = [];
        const currentYear = new Date().getFullYear();

        lines.forEach((cells, idx) => {
            if (idx < (mapping.skipRowsStart || 0)) return;

            const rawDate = cells[mapping.dateColumnIndex] || "";
            const rawDesc = cells[mapping.descriptionColumnIndex] || "";
            const rawAmount = cells[mapping.amountColumnIndex] || "";
            const rawForm = (mapping.paymentMethodColumnIndex !== undefined && mapping.paymentMethodColumnIndex >= 0)
                ? cells[mapping.paymentMethodColumnIndex]
                : "";

            if (!rawDate && !rawDesc && !rawAmount) return;

            const isoDate = DateResolver.resolveToISO(String(rawDate), currentYear);
            const stdAmount = AmountResolver.clean(rawAmount);
            const numAmount = parseFloat(stdAmount);

            if (isoDate && !isNaN(numAmount)) {
                // A descrição é mantida fiel ao arquivo/modelo, 
                // sem aplicação de palavras-chave ignoradas globais do sistema.
                results.push({
                    id: `viva-col-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: String(rawDesc).trim(),
                    rawDescription: String(rawDesc),
                    amount: numAmount,
                    originalAmount: String(rawAmount),
                    cleanedDescription: String(rawDesc).trim(),
                    contributionType: numAmount >= 0 ? 'ENTRADA' : 'SAÍDA',
                    paymentMethod: String(rawForm) || 'OUTROS',
                    bank_id: model.id
                });
            }
        });

        return results;
    }
};