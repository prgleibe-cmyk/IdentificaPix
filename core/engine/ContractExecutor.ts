
import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { TypeResolver } from '../processors/TypeResolver';
import { NameResolver } from '../processors/NameResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V47 - FIDELIDADE TOTAL AO MODELO)
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        // Extraímos os dados brutos do input adaptado
        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        const rawBase64 = adaptedInput?.__base64; 

        if (!rawText.trim() && !rawBase64) return [];

        const { mapping } = model;
        
        // 🧱 MODO BLOCO (IA)
        if (mapping.extractionMode === 'BLOCK') {
            const trainingContext = mapping.blockContract || 'Extração fiel conforme modelo estrutural.';

            try {
                // Passamos o binário para que a IA possa "olhar" o arquivo original
                const aiResult = await extractTransactionsWithModel(rawText, trainingContext, rawBase64);
                
                return (aiResult || []).map((tx: any, idx: number) => ({
                    id: `exec-v47-block-${model.id}-${idx}-${Date.now()}`,
                    date: tx.date,
                    description: tx.description,
                    rawDescription: tx.description,
                    amount: tx.amount,
                    originalAmount: String(tx.amount),
                    cleanedDescription: tx.description,
                    contributionType: 'AUTO',
                    paymentMethod: 'OUTROS',
                    bank_id: model.id
                }));
            } catch (e) { 
                console.error("[ContractExecutor] Erro na leitura IA:", e);
                return []; 
            }
        }

        // 🚀 MODO COLUNAS (DETERMINÍSTICO)
        const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
        const results: Transaction[] = [];
        const currentYear = new Date().getFullYear();

        lines.forEach((line, idx) => {
            if (idx < (mapping.skipRowsStart || 0)) return;

            const cells = line.split(';'); 
            const rawDate = cells[mapping.dateColumnIndex] || "";
            const rawDesc = cells[mapping.descriptionColumnIndex] || "";
            const rawAmount = cells[mapping.amountColumnIndex] || "";

            if (!rawDate && !rawDesc && !rawAmount) return;

            const isoDate = DateResolver.resolveToISO(rawDate, currentYear);
            const stdAmount = AmountResolver.clean(rawAmount);
            const numAmount = parseFloat(stdAmount);

            if (isoDate && !isNaN(numAmount)) {
                const finalDescription = rawDesc.trim();

                results.push({
                    id: `exec-v47-col-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: finalDescription,
                    rawDescription: rawDesc,
                    amount: numAmount,
                    originalAmount: rawAmount,
                    cleanedDescription: finalDescription,
                    contributionType: TypeResolver.resolveFromDescription(rawDesc),
                    paymentMethod: mapping.paymentMethodColumnIndex !== undefined && cells[mapping.paymentMethodColumnIndex] 
                        ? cells[mapping.paymentMethodColumnIndex] 
                        : TypeResolver.resolveFromDescription(rawDesc),
                    bank_id: model.id
                });
            }
        });

        return results;
    }
};
