import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { NameResolver } from '../processors/NameResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V57 - VERDADE ÚNICA PDF)
 * -------------------------------------------------------
 * Este componente garante que a Lista Viva reflita exatamente
 * o que foi aprendido e simulado no Laboratório, impedindo 
 * a contaminação por texto bruto do parser de PDF.
 * 
 * @critical_fix: Removida dependência de texto bruto no mapeamento final.
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
                // @frozen-block: PDF_PARITY_V57 (PROTEGIDO)
                const aiResult = await extractTransactionsWithModel(rawText, trainingContext, rawBase64);
                const rows = Array.isArray(aiResult) ? aiResult : (aiResult?.rows || []);
                
                return rows.map((tx: any, idx: number) => {
                    /**
                     * 🛡️ FONTE ÚNICA DE VERDADE: O mapeamento vindo da IA (tx)
                     * PROIBIDO: Usar rawText, segments, original ou pdfLine aqui.
                     */
                    const txDescription = String(tx.description || "").toUpperCase().trim();
                    const txDate = String(tx.date || "").trim();
                    const txAmount = tx.amount;
                    const txForma = String(tx.forma || "").toUpperCase().trim();
                    const txTipo = String(tx.tipo || "").toUpperCase().trim();

                    return {
                        id: `exec-v57-block-${model.id}-${idx}-${Date.now()}`,
                        date: txDate,
                        description: txDescription, 
                        rawDescription: txDescription, // RIGOR: Não reinjeta o texto bruto do PDF
                        amount: txAmount || 0,
                        originalAmount: String(txAmount || 0),
                        cleanedDescription: txDescription,
                        contributionType: txTipo,
                        paymentMethod: txForma,
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
                    id: `exec-v57-col-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: learnedDescription, 
                    rawDescription: learnedDescription, 
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