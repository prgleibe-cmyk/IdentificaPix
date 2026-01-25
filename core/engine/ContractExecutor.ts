
import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { NameResolver } from '../processors/NameResolver';
import { TypeResolver } from '../processors/TypeResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V25)
 * --------------------------------------------------------------------------
 * Executa modelos salvos utilizando ou o motor determinístico (colunas)
 * ou o motor cognitivo (aprendizado por blocos/exemplo).
 */

export const ContractExecutor = {
    /**
     * Aplica as coordenadas do contrato ao conteúdo bruto.
     */
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");

        // 🧠 EXECUÇÃO COGNITIVA (MODO BLOCO)
        if (model.mapping.extractionMode === 'BLOCK') {
            console.log(`[Executor:BLOCK] Delegando extração para IA baseada em exemplo: "${model.name}"`);
            
            const snippet = model.snippet || "";
            const context = `EXEMPLOS DE TREINO:\n${snippet.substring(0, 1500)}`;
            
            const aiResult = await extractTransactionsWithModel(rawText, context);
            
            if (aiResult && aiResult.length > 0) {
                return aiResult.map((tx: any, i: number) => {
                    const originalDesc = tx.description?.trim();
                    return {
                        id: `exec-block-${model.id}-${i}`,
                        date: tx.date,
                        description: originalDesc,
                        rawDescription: tx.description,
                        amount: tx.amount,
                        originalAmount: String(tx.amount),
                        cleanedDescription: originalDesc,
                        contributionType: tx.type || 'AUTO',
                        paymentMethod: tx.paymentMethod || 'OUTROS'
                    };
                });
            }
            return [];
        }

        // 🚀 EXECUÇÃO DETERMINÍSTICA (MODO COLUNAS CLÁSSICO)
        const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
        const { mapping } = model;
        const yearAnchor = DateResolver.discoverAnchorYear(rawText);
        const results: Transaction[] = [];

        lines.forEach((line, idx) => {
            if (idx < (mapping.skipRowsStart || 0)) return;

            const cells = line.split(';'); 
            const rawDate = cells[mapping.dateColumnIndex] || "";
            const rawDesc = cells[mapping.descriptionColumnIndex] || "";
            const rawAmount = cells[mapping.amountColumnIndex] || "";

            if (!rawDate && !rawDesc && !rawAmount) return;

            const isoDate = DateResolver.resolveToISO(rawDate, yearAnchor);
            const stdAmount = AmountResolver.clean(rawAmount);
            const numAmount = parseFloat(stdAmount);

            if (isoDate && !isNaN(numAmount)) {
                const finalDesc = rawDesc.trim();
                results.push({
                    id: `exec-${model.id}-${idx}`,
                    date: isoDate,
                    description: finalDesc,
                    rawDescription: line,
                    amount: numAmount,
                    originalAmount: rawAmount,
                    cleanedDescription: finalDesc, 
                    contributionType: TypeResolver.resolveFromDescription(rawDesc),
                    paymentMethod: mapping.paymentMethodColumnIndex !== undefined ? cells[mapping.paymentMethodColumnIndex] : 'OUTROS'
                });
            }
        });

        console.log(`[Executor:COL] ${results.length} registros extraídos.`);
        return results;
    }
};
