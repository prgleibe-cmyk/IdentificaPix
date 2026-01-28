import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { NameResolver } from '../processors/NameResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V53 - PARIDADE ABSOLUTA)
 * -------------------------------------------------------
 * Este componente garante que a Lista Viva reflita exatamente
 * o que foi aprendido e simulado no Laboratório.
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        const rawBase64 = adaptedInput?.__base64; 

        if (!rawText.trim() && !rawBase64) return [];

        const { mapping } = model;
        const modelKeywords = mapping.ignoredKeywords || [];
        
        // 🧱 MODO BLOCO (IA VISION)
        if (mapping.extractionMode === 'BLOCK') {
            const trainingContext = mapping.blockContract || 'Extração fiel conforme modelo estrutural.';

            try {
                // @frozen-block-start: BLOCK_PARITY
                // Em modo BLOCO, a IA já entrega a descrição conforme o contrato aprendido.
                // Não aplicamos limpeza adicional para manter paridade com a Simulação do Lab.
                const aiResult = await extractTransactionsWithModel(rawText, trainingContext, rawBase64);
                const rows = Array.isArray(aiResult) ? aiResult : (aiResult?.rows || []);
                
                return rows.map((tx: any, idx: number) => {
                    const modelDescription = String(tx.description || "").toUpperCase().trim();
                    
                    return {
                        id: `exec-v53-block-${model.id}-${idx}-${Date.now()}`,
                        date: tx.date || "",
                        description: modelDescription, 
                        rawDescription: modelDescription, // A verdade é o output do modelo
                        amount: tx.amount || 0,
                        originalAmount: String(tx.amount || 0),
                        cleanedDescription: modelDescription,
                        contributionType: 'AUTO',
                        paymentMethod: tx.paymentMethod || 'OUTROS',
                        bank_id: model.id
                    };
                });
                // @frozen-block-end: BLOCK_PARITY
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
                // @frozen-block-start: COLUMNS_PARITY
                // No modo colunas, a verdade é a descrição da coluna mapeada passada pelo NameResolver.
                // Sincronizado com o Lab: usa keywords do modelo E globais.
                const learnedDescription = NameResolver.clean(rawDesc, modelKeywords, globalKeywords);
                
                results.push({
                    id: `exec-v53-col-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: learnedDescription, 
                    rawDescription: learnedDescription, // Vedado o uso de rawDesc bruto
                    amount: numAmount,
                    originalAmount: rawAmount,
                    cleanedDescription: learnedDescription,
                    contributionType: numAmount >= 0 ? 'ENTRADA' : 'SAÍDA',
                    paymentMethod: rawForm || 'OUTROS',
                    bank_id: model.id
                });
                // @frozen-block-end: COLUMNS_PARITY
            }
        });

        return results;
    }
};