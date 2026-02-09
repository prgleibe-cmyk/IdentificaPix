
import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { NameResolver } from '../processors/NameResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V61 - ABSOLUTE TRUTH ENFORCEMENT)
 * -------------------------------------------------------
 * Este componente implementa a "VERDADE ABSOLUTA" do modelo.
 * O que foi aprendido no Laboratório é replicado sem NENHUMA
 * normalização adicional, reprocessamento ou ajuste automático.
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        const rawBase64 = adaptedInput?.__base64; 

        if (!rawText.trim() && !rawBase64) return [];

        const { mapping } = model;
        const modelKeywords = mapping.ignoredKeywords || [];
        
        // 🧱 MODO BLOCO (IA VISION / PDF / UNIFICADO)
        // Se houver um contrato de bloco, ele é soberano e ignoramos parsers locais.
        if (mapping.extractionMode === 'BLOCK') {
            const trainingContext = mapping.blockContract || 'Extração fiel conforme modelo estrutural aprendido no laboratório.';

            try {
                // @frozen-block: PDF_ABSOLUTE_TRUTH_V61
                // Solicita extração TOTALMENTE FIEL ao Gemini baseada no contrato.
                if (rawBase64) {
                    console.log(`[PDF:PHASE:6:CONTRACT_APPLY] MODEL:"${model.name}" -> AI_VISION`);
                }
                
                const aiResult = await extractTransactionsWithModel(rawText, trainingContext, rawBase64);
                const rows = Array.isArray(aiResult) ? aiResult : (aiResult?.rows || []);
                
                const finalRows = rows.map((tx: any, idx: number) => {
                    /**
                     * 🛡️ FONTE ÚNICA DE VERDADE: O resultado da IA é intocável.
                     * PROIBIDO: toUpperCase, clean, trim ou qualquer mutação.
                     * O texto deve ser idêntico ao extraído visualmente pelo contrato.
                     */
                    const txDescriptionLiteral = String(tx.description || "");

                    const txObj = {
                        id: `viva-block-${model.id}-${idx}-${Date.now()}`,
                        date: tx.date,
                        description: txDescriptionLiteral, 
                        rawDescription: txDescriptionLiteral, 
                        amount: tx.amount,
                        originalAmount: String(tx.amount),
                        cleanedDescription: txDescriptionLiteral,
                        contributionType: tx.tipo || 'AUTO',
                        paymentMethod: tx.forma || 'OUTROS',
                        bank_id: model.id
                    };

                    if (rawBase64 && idx === 0) {
                        console.log(`[PDF:PHASE:7:ROW_ASSEMBLY] AI_DATA -> ${JSON.stringify(tx)} | ASSEMBLED -> ${JSON.stringify(txObj)}`);
                    }

                    return txObj;
                });

                return finalRows;
            } catch (e) { 
                console.error("[ContractExecutor] Erro na leitura soberana IA:", e);
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
                    id: `viva-col-${model.id}-${idx}-${Date.now()}`,
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
