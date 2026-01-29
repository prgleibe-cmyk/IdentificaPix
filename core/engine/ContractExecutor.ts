import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { NameResolver } from '../processors/NameResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V59 - PDF PURITY FIXED)
 * -------------------------------------------------------
 * Este componente garante que a Lista Viva reflita exatamente
 * o que foi aprendido e simulado no Laboratório, impedindo 
 * a contaminação por texto bruto do parser de PDF.
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        const rawBase64 = adaptedInput?.__base64; 

        if (!rawText.trim() && !rawBase64) return [];

        const { mapping } = model;
        const modelKeywords = mapping.ignoredKeywords || [];
        
        // 🧱 MODO BLOCO (IA VISION / PDF)
        if (mapping.extractionMode === 'BLOCK') {
            const trainingContext = mapping.blockContract || 'Extração fiel conforme modelo estrutural.';

            try {
                // @frozen-block: PDF_PARITY_V59 (PROTEGIDO)
                const aiResult = await extractTransactionsWithModel(rawText, trainingContext, rawBase64);
                const rows = Array.isArray(aiResult) ? aiResult : (aiResult?.rows || []);
                
                return rows.map((tx: any, idx: number) => {
                    /**
                     * 🛡️ FONTE ÚNICA DE VERDADE: O mapeamento vindo da IA (tx)
                     * Aplicando a regra final.description = modelResult.description
                     * Proibido cleanups, toUpperCase, trim ou fallbacks pós-modelo.
                     */
                    return {
                        id: `exec-v59-block-${model.id}-${idx}-${Date.now()}`,
                        date: tx.date,
                        description: tx.description, 
                        rawDescription: tx.description, 
                        amount: tx.amount,
                        originalAmount: String(tx.amount),
                        cleanedDescription: tx.description,
                        contributionType: tx.tipo,
                        paymentMethod: tx.forma,
                        bank_id: model.id
                    };
                });
            } catch (e) { 
                console.error("[ContractExecutor] Erro na leitura IA:", e);
                return []; 
            }
        }

        // 🚀 MODO COLUNAS (DETERMINÍSTICO - EXCEL/CSV)
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
                const learnedDescription = NameResolver.clean(rawDesc, modelKeywords, globalKeywords);
                
                results.push({
                    id: `exec-v59-col-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: learnedDescription, 
                    rawDescription: rawDesc, 
                    amount: numAmount,
                    originalAmount: rawAmount,
                    cleanedDescription: learnedDescription,
                    contributionType: numAmount >= 0 ? 'ENTRADA' : 'SAÍDA',
                    paymentMethod: rawForm || 'OUTROS',
                    bank_id: model.id
                });
            }
        });

        return results;
    }
};