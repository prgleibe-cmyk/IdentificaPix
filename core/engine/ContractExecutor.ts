
import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { TypeResolver } from '../processors/TypeResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V38 - VELOCIDADE FLASH + FIDELIDADE TOTAL)
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        if (!rawText.trim()) return [];

        const { mapping } = model;
        const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);

        // 🧠 MODO BLOCO (IA FLASH PARALELA - VELOCIDADE + FIDELIDADE)
        // Se o modelo foi treinado no Laboratório, usamos a IA para garantir que a limpeza (Ex: remover RECEBIMENTO PIX) seja executada.
        if (mapping.extractionMode === 'BLOCK') {
            const trainingContext = `### CONTRATO DE LIMPEZA E EXTRAÇÃO (GABARITO):\n${model.snippet?.substring(0, 3000)}\n\nIMPORTANTE: Siga o exemplo acima. Se o exemplo remove 'RECEBIMENTO PIX', você DEVE remover.`;
            
            // Lotes de 150 linhas para o Gemini 3 Flash processar com máxima eficiência
            const LINES_PER_BATCH = 150;
            const batches: string[] = [];
            for (let i = 0; i < lines.length; i += LINES_PER_BATCH) {
                batches.push(lines.slice(i, i + LINES_PER_BATCH).join('\n'));
            }

            console.log(`[ContractExecutor] Iniciando processamento paralelo de ${batches.length} blocos via Flash...`);

            // Execução paralela real para matar a lentidão
            const batchPromises = batches.map(async (batchText, batchIdx) => {
                try {
                    const aiResult = await extractTransactionsWithModel(batchText, trainingContext);
                    if (aiResult && aiResult.length > 0) {
                        return aiResult.map((tx: any, idx: number) => ({
                            id: `exec-f-${model.id}-${batchIdx}-${idx}-${Date.now()}`,
                            date: tx.date,
                            description: tx.description,
                            rawDescription: tx.description,
                            amount: tx.amount,
                            originalAmount: String(tx.amount),
                            cleanedDescription: tx.description,
                            contributionType: tx.type || 'AUTO',
                            paymentMethod: tx.paymentMethod || 'OUTROS'
                        }));
                    }
                    return [];
                } catch (e) {
                    console.error(`[ContractExecutor] Erro no bloco ${batchIdx}:`, e);
                    return [];
                }
            });

            const resultsArray = await Promise.all(batchPromises);
            const allResults = resultsArray.flat();
            
            console.log(`[ContractExecutor] Concluído! ${allResults.length} linhas processadas com fidelidade.`);
            return allResults;
        }

        // 🚀 MODO COLUNAS (DETERMINÍSTICO - INSTANTÂNEO)
        // Usado apenas se não houver necessidade de limpeza complexa por IA.
        console.log(`[ContractExecutor] Executando extração local (Modo Colunas).`);
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
                results.push({
                    id: `exec-l-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: rawDesc.trim(),
                    rawDescription: line,
                    amount: numAmount,
                    originalAmount: rawAmount,
                    cleanedDescription: rawDesc.trim(),
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
