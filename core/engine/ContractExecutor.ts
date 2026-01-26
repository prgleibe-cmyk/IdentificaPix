
import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { TypeResolver } from '../processors/TypeResolver';
import { NameResolver } from '../processors/NameResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V41 - MODO HÍBRIDO INTELIGENTE)
 * Prioriza processamento local ultra-rápido para Excel/CSV.
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        if (!rawText.trim()) return [];

        const { mapping, parsingRules } = model;
        const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        // 🧠 MODO BLOCO (APENAS PARA ARQUIVOS DESESTRUTURADOS/PDFS COMPLEXOS)
        if (mapping.extractionMode === 'BLOCK') {
            const trainingContext = `### CONTRATO DE EXTRAÇÃO:\n${model.snippet?.substring(0, 4000)}`;
            const LINES_PER_BATCH = 250;
            const batches: string[] = [];
            for (let i = 0; i < lines.length; i += LINES_PER_BATCH) {
                batches.push(lines.slice(i, i + LINES_PER_BATCH).join('\n'));
            }

            const batchPromises = batches.map(async (batchText, batchIdx) => {
                try {
                    const aiResult = await extractTransactionsWithModel(batchText, trainingContext);
                    return (aiResult || []).map((tx: any, idx: number) => ({
                        id: `exec-v41-b-${model.id}-${batchIdx}-${idx}-${Date.now()}`,
                        date: tx.date,
                        description: tx.description,
                        rawDescription: tx.description,
                        amount: tx.amount,
                        originalAmount: String(tx.amount),
                        cleanedDescription: tx.description,
                        contributionType: tx.type || 'AUTO',
                        paymentMethod: tx.paymentMethod || 'OUTROS'
                    }));
                } catch (e) { return []; }
            });

            const resultsArray = await Promise.all(batchPromises);
            return resultsArray.flat();
        }

        // 🚀 MODO COLUNAS (PADRÃO PARA EXCEL/CSV - INSTANTÂNEO)
        console.log(`[ContractExecutor] Executando extração local acelerada.`);
        const results: Transaction[] = [];
        const currentYear = new Date().getFullYear();
        const modelKeywords = parsingRules?.ignoredKeywords || [];

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
                // AQUI APLICAMOS A LIMPEZA QUE VOCÊ SUGERIU:
                // Usa os termos aprendidos no Laboratório para limpar o nome localmente.
                const cleanedName = NameResolver.clean(rawDesc, modelKeywords, globalKeywords);

                results.push({
                    id: `exec-v41-l-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: cleanedName, // Nome já limpo
                    rawDescription: rawDesc,   // Preserva o original
                    amount: numAmount,
                    originalAmount: rawAmount,
                    cleanedDescription: cleanedName,
                    contributionType: TypeResolver.resolveFromDescription(rawDesc),
                    paymentMethod: mapping.paymentMethodColumnIndex !== undefined && cells[mapping.paymentMethodColumnIndex] 
                        ? cells[mapping.paymentMethodColumnIndex] 
                        : TypeResolver.resolveFromDescription(rawDesc)
                });
            }
        });

        return results;
    }
};
