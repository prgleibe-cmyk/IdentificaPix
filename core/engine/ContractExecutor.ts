
import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V50 - FIDELIDADE ABSOLUTA)
 * -------------------------------------------------------
 * Este componente é o executor final do DNA aprendido no Laboratório.
 * GARANTIA: O que é visto na simulação é o que é gerado aqui.
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        const rawBase64 = adaptedInput?.__base64; 

        if (!rawText.trim() && !rawBase64) return [];

        const { mapping } = model;
        
        // 🧱 MODO BLOCO (IA VISION)
        if (mapping.extractionMode === 'BLOCK') {
            const trainingContext = mapping.blockContract || 'Extração fiel conforme modelo estrutural.';

            try {
                const aiResult = await extractTransactionsWithModel(rawText, trainingContext, rawBase64);
                const rows = Array.isArray(aiResult) ? aiResult : (aiResult?.rows || []);
                
                return rows.map((tx: any, idx: number) => ({
                    id: `exec-v50-block-${model.id}-${idx}-${Date.now()}`,
                    date: tx.date || "",
                    description: String(tx.description || "").trim(), // VERDADE DO LABORATÓRIO
                    rawDescription: tx.description || "",
                    amount: tx.amount || 0,
                    originalAmount: String(tx.amount || 0),
                    cleanedDescription: tx.description || "",
                    contributionType: 'AUTO',
                    paymentMethod: tx.paymentMethod || 'OUTROS',
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

            const delimiter = line.includes(';') ? ';' : (line.includes('\t') ? '\t' : ',');
            const cells = line.split(delimiter).map(c => c.trim());
            
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
                // RIGOR ABSOLUTO: Descrição e Forma vêm direto dos índices mapeados.
                results.push({
                    id: `exec-v50-col-${model.id}-${idx}-${Date.now()}`,
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
