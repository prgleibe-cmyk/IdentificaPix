
import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { NameResolver } from '../processors/NameResolver';
import { extractTransactionsWithModel } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V63 - KEYWORD CLEANING RESTORED)
 * -------------------------------------------------------
 * Implementa a regra de extração com limpeza seletiva.
 * Preserva o texto original no rawDescription, mas limpa
 * a descrição visual baseada nas keywords do Admin.
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        const rawBase64 = adaptedInput?.__base64; 

        if (!rawText.trim() && !rawBase64) return [];

        const { mapping } = model;
        const modelKeywords = mapping.ignoredKeywords || [];
        
        // 🧱 MODO BLOCO (PDF / VISÃO IA)
        if (mapping.extractionMode === 'BLOCK') {
            const trainingContext = mapping.blockContract || 'Extração fiel conforme modelo.';

            try {
                if (rawBase64) {
                    console.log(`[PDF:PHASE:6:CONTRACT_APPLY] MODEL:"${model.name}" -> CLEANING_ACTIVE`);
                }
                
                const aiResult = await extractTransactionsWithModel(rawText, trainingContext, rawBase64);
                const rows = Array.isArray(aiResult) ? aiResult : (aiResult?.rows || []);
                
                const finalRows = rows.map((tx: any, idx: number) => {
                    const aiLiteralDesc = String(tx.description || "");
                    
                    // Para PDF/IA, tentamos compor uma "identidade bruta" única se houver metadados extras
                    const rawIdentity = tx.raw_line || aiLiteralDesc;

                    /**
                     * 🎯 REATIVAÇÃO DA LIMPEZA:
                     * Aplicamos o NameResolver.clean para remover termos como PIX, TED, etc.
                     * definidos globalmente no Admin ou especificamente no Modelo.
                     */
                    const cleanedDescription = NameResolver.clean(aiLiteralDesc, modelKeywords, globalKeywords);

                    const txObj = {
                        id: `viva-block-${model.id}-${idx}-${Date.now()}`,
                        date: tx.date,
                        description: cleanedDescription, // Descrição Limpa (Visual)
                        rawDescription: rawIdentity,     // Identidade Completa (Deduplicação)
                        amount: tx.amount,
                        originalAmount: String(tx.amount),
                        cleanedDescription: cleanedDescription, 
                        contributionType: tx.tipo || 'AUTO',
                        paymentMethod: tx.forma || 'OUTROS',
                        bank_id: model.id
                    };

                    if (rawBase64 && idx === 0) {
                        console.log(`[PDF:PHASE:7:CLEANED_ROW] RAW -> ${aiLiteralDesc} | CLEAN -> ${cleanedDescription}`);
                    }

                    return txObj;
                });

                return finalRows;
            } catch (e) { 
                console.error("[ContractExecutor] Erro na leitura IA:", e);
                return []; 
            }
        }

        // 🚀 MODO COLUNAS (DETERMINÍSTICO - EXCEL/CSV)
        const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);

        // 🛡️ DETECÇÃO ÚNICA DE DELIMITADOR (V100)
        const firstLine = lines[0] || "";
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const tabCount = (firstLine.match(/\t/g) || []).length;

        let delimiter = ',';
        if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t';
        else if (semicolonCount >= commaCount && semicolonCount > 0) delimiter = ';';
        else delimiter = ',';

        // 🛡️ PARSER ROBUSTO DE CÉLULAS (V100 - SUPORTE A ASPAS)
        const parseCSVLine = (text: string, delim: string): string[] => {
            const columns: string[] = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === delim && !inQuotes) {
                    columns.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            columns.push(current.trim());
            return columns;
        };

        const results: Transaction[] = [];
        const currentYear = new Date().getFullYear();

        lines.forEach((line, idx) => {
            if (idx < (mapping.skipRowsStart || 0)) return;

            const cells = parseCSVLine(line, delimiter);
            
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

            if ((rawDate || rawDesc) && !isNaN(numAmount)) {
                // Aplica a limpeza de palavras-chave ignoradas
                const learnedDescription = NameResolver.clean(rawDesc, modelKeywords, globalKeywords);
                
                // Captura a linha completa para garantir deduplicação sensível a todas as colunas (ex: Saldo)
                const fullRawLine = line.trim();

                results.push({
                    id: `viva-col-${model.id}-${idx}-${Date.now()}`,
                    date: isoDate,
                    description: learnedDescription, 
                    rawDescription: fullRawLine, 
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
