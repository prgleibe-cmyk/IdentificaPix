import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { NameResolver } from '../processors/NameResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V60 - ABSOLUTE TRUTH ENFORCEMENT)
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
        // RIGOR V60: As palavras do modelo são a verdade. Global keywords são usadas apenas se o modelo permitir.
        const modelKeywords = mapping.ignoredKeywords || [];
        
        // 🧱 MODO BLOCO (IA VISION / PDF / UNIFICADO)
        // Se houver um contrato de bloco, ele é soberano e ignoramos parsers locais.
        if (mapping.extractionMode === 'BLOCK') {
            const trainingContext = mapping.blockContract || 'Extração fiel conforme modelo estrutural aprendido no laboratório.';

            try {
                // @frozen-block: PDF_ABSOLUTE_TRUTH_V60
                // Solicita extração TOTALMENTE FIEL ao Gemini baseada no contrato.
                const aiResult = await extractTransactionsWithModel(rawText, trainingContext, rawBase64);
                const rows = Array.isArray(aiResult) ? aiResult : (aiResult?.rows || []);
                
                return rows.map((tx: any, idx: number) => {
                    /**
                     * 🛡️ FONTE ÚNICA DE VERDADE: O resultado da IA é intocável.
                     * Não aplicamos toUpperCase, não limpamos strings, não mudamos sinais.
                     * O Gemini entrega o que aprendeu na Simulação do Laboratório.
                     */
                    console.log("[BLOCK:FIDELITY] Snapshot aplicado sem mutação");
                    return {
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
                    };
                });
            } catch (e) { 
                console.error("[ContractExecutor] Erro na leitura soberana IA:", e);
                return []; 
            }
        }

        // 🚀 MODO COLUNAS (DETERMINÍSTICO - EXCEL/CSV)
        // Replicamos a lógica exata do Laboratório sem ajustes extras.
        const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
        const results: Transaction[] = [];
        const currentYear = new Date().getFullYear();

        lines.forEach((line, idx) => {
            // Pula linhas conforme definido no modelo aprendido
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

            // Normalização MÍNIMA para garantir tipos válidos (Data e Número)
            const isoDate = DateResolver.resolveToISO(rawDate, currentYear);
            const stdAmount = AmountResolver.clean(rawAmount);
            const numAmount = parseFloat(stdAmount);

            if (isoDate && !isNaN(numAmount)) {
                // A limpeza de descrição segue EXATAMENTE o que foi definido no modelo
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