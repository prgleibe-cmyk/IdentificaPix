
import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { TypeResolver } from '../processors/TypeResolver';
import { NameResolver } from '../processors/NameResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V48 - FIDELIDADE TOTAL E SEPARAÇÃO DE CAMPOS)
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
                // Garante compatibilidade com diferentes formatos de retorno da IA
                const rows = Array.isArray(aiResult) ? aiResult : (aiResult?.rows || []);
                
                return rows.map((tx: any, idx: number) => ({
                    id: `exec-v48-block-${model.id}-${idx}-${Date.now()}`,
                    date: tx.date || "",
                    description: String(tx.description || "").toUpperCase(),
                    rawDescription: tx.description || "",
                    amount: tx.amount || 0,
                    originalAmount: String(tx.amount || 0),
                    cleanedDescription: tx.description || "",
                    contributionType: 'AUTO',
                    paymentMethod: tx.paymentMethod || 'OUTROS', // RECUPERAÇÃO DO CAMPO APRENDIDO
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
                // RIGOR ABSOLUTO: Aplica APENAS a limpeza de termos aprendidos no modelo.
                // Ignora globalKeywords para manter o output centralizado no Laboratório.
                const cleanedName = NameResolver.clean(
                    rawDesc, 
                    mapping.ignoredKeywords || model.parsingRules?.ignoredKeywords || [], 
                    [] // Neutraliza globalKeywords
                );

                results.push({
                    id: `exec-v48-col-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: cleanedName,
                    rawDescription: rawDesc,
                    amount: numAmount,
                    originalAmount: rawAmount,
                    cleanedDescription: cleanedName,
                    contributionType: TypeResolver.resolveFromDescription(rawDesc),
                    paymentMethod: (mapping.paymentMethodColumnIndex !== undefined && mapping.paymentMethodColumnIndex >= 0 && cells[mapping.paymentMethodColumnIndex]) 
                        ? cells[mapping.paymentMethodColumnIndex].trim() 
                        : TypeResolver.resolveFromDescription(rawDesc),
                    bank_id: model.id
                });
            }
        });

        return results;
    }
};
