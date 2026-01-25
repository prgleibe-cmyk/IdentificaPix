
import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { NameResolver } from '../processors/NameResolver';
import { TypeResolver } from '../processors/TypeResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V26 - MOTOR DE FATIAMENTO PARA GRANDES ARQUIVOS)
 * --------------------------------------------------------------------------
 * Divide arquivos gigantes em partes menores para garantir processamento 100% fiel.
 */

export const ContractExecutor = {
    /**
     * Aplica as coordenadas do contrato ao conteúdo bruto.
     */
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        if (!rawText.trim()) return [];

        // 🧠 EXECUÇÃO COGNITIVA COM FATIAMENTO (MODO BLOCO)
        if (model.mapping.extractionMode === 'BLOCK') {
            console.log(`[Executor:CHUNKED] Iniciando processamento em fatias para: "${model.name}"`);
            
            const snippet = model.snippet || "";
            const trainingContext = `EXEMPLOS DE TREINO:\n${snippet.substring(0, 1500)}`;
            
            // Divide o texto em linhas para evitar cortar uma transação no meio
            const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
            const CHUNK_CHAR_LIMIT = 10000; // Limite seguro de caracteres por chamada de IA
            
            let currentChunkLines: string[] = [];
            let currentChunkSize = 0;
            const chunks: string[] = [];

            for (const line of lines) {
                if (currentChunkSize + line.length > CHUNK_CHAR_LIMIT && currentChunkLines.length > 0) {
                    chunks.push(currentChunkLines.join('\n'));
                    currentChunkLines = [];
                    currentChunkSize = 0;
                }
                currentChunkLines.push(line);
                currentChunkSize += line.length;
            }
            if (currentChunkLines.length > 0) {
                chunks.push(currentChunkLines.join('\n'));
            }

            console.log(`[Executor:CHUNKED] Arquivo dividido em ${chunks.length} partes.`);

            const allResults: Transaction[] = [];

            for (let i = 0; i < chunks.length; i++) {
                console.log(`[Executor:CHUNKED] Processando parte ${i + 1} de ${chunks.length}...`);
                const aiResult = await extractTransactionsWithModel(chunks[i], trainingContext);
                
                if (aiResult && aiResult.length > 0) {
                    const mapped = aiResult.map((tx: any, idx: number) => {
                        const originalDesc = tx.description?.trim();
                        return {
                            id: `exec-chunk-${model.id}-${i}-${idx}-${Date.now()}`,
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
                    allResults.push(...mapped);
                }
            }

            console.log(`[Executor:CHUNKED] Concluído! Total extraído: ${allResults.length} registros.`);
            return allResults;
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
                    id: `exec-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: finalDesc,
                    rawDescription: line,
                    amount: numAmount,
                    originalAmount: rawAmount,
                    cleanedDescription: finalDesc, 
                    contributionType: TypeResolver.resolveFromDescription(rawDesc),
                    paymentMethod: mapping.paymentMethodColumnIndex !== undefined && cells[mapping.paymentMethodColumnIndex] 
                        ? cells[mapping.paymentMethodColumnIndex] 
                        : 'OUTROS'
                });
            }
        });

        console.log(`[Executor:COL] ${results.length} registros extraídos.`);
        return results;
    }
};
