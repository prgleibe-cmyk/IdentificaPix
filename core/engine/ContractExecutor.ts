
import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { TypeResolver } from '../processors/TypeResolver';
import { NameResolver } from '../processors/NameResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V44 - REPLICAÇÃO TÉCNICA)
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        if (!rawText.trim()) return [];

        const { mapping, parsingRules } = model;
        
        // 🧱 MODO BLOCO (MAPIAMENTO RELATIVO)
        if (mapping.extractionMode === 'BLOCK') {
            console.log(`[ContractExecutor] 🧱 Aplicando Receita Técnica de Bloco: ${model.name}`);
            
            const trainingContext = mapping.blockContract || 'Extração por blocos de texto lineares.';

            // Chunking maior para garantir que blocos inteiros caibam na mesma janela de contexto
            const lines = rawText.split(/\r?\n/);
            const CHUNK_SIZE = 250; 
            const chunks: string[] = [];
            for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
                chunks.push(lines.slice(i, i + CHUNK_SIZE).join('\n'));
            }

            const batchPromises = chunks.map(async (textChunk, chunkIdx) => {
                try {
                    const aiResult = await extractTransactionsWithModel(textChunk, trainingContext);
                    return (aiResult || []).map((tx: any, idx: number) => ({
                        id: `exec-v44-block-${model.id}-${chunkIdx}-${idx}-${Date.now()}`,
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
                } catch (e) { return []; }
            });

            const resultsArray = await Promise.all(batchPromises);
            return resultsArray.flat();
        }

        // 🚀 MODO COLUNAS (DETERMINÍSTICO)
        const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
        const results: Transaction[] = [];
        const currentYear = new Date().getFullYear();
        const modelKeywords = parsingRules?.ignoredKeywords || (mapping as any).ignoredKeywords || [];

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
                const cleanedName = NameResolver.clean(rawDesc, modelKeywords, globalKeywords);

                results.push({
                    id: `exec-v44-col-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: cleanedName,
                    rawDescription: rawDesc,
                    amount: numAmount,
                    originalAmount: rawAmount,
                    cleanedDescription: cleanedName,
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
