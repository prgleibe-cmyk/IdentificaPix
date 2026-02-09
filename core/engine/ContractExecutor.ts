import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { NameResolver } from '../processors/NameResolver';

/**
 * 📜 CONTRACT EXECUTOR (V67 - HARDENED EXECUTIVE MODE)
 * -------------------------------------------------------
 * Executa o contrato aprendido no Laboratório com rigor absoluto.
 * No modo BLOCK, ele reproduz o aprendizado fixado e protege contra falhas de tipo.
 */
export const ContractExecutor = {
    async apply(model: FileModel, adaptedInput: any, _globalKeywords: string[] = []): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        // 🛡️ ÚLTIMA LINHA DE DEFESA: Se o mapping chegar como string, tenta parsear localmente
        let mapping = model.mapping;
        if (typeof mapping === 'string') {
            try {
                mapping = JSON.parse(mapping);
            } catch (e) {
                console.error("[ContractExecutor] Falha fatal ao parsear mapping stringificado.");
                return [];
            }
        }

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        
        /**
         * 🧱 MODO BLOCO (DETERMINÍSTICO E FIXO)
         * O contrato de bloco agora retorna EXATAMENTE o que foi aprendido no laboratório.
         */
        if (mapping.extractionMode === 'BLOCK') {
            const learnedRows = mapping.blockRows || [];
            
            if (learnedRows.length === 0) {
                console.warn("[ContractExecutor] Alerta: Modelo BLOCK sem blockRows (dados aprendidos) salvo.");
                return [];
            }

            // Mapeia os dados aprendidos para o contexto atual (IDs únicos por execução)
            return learnedRows.map((tx: any, idx: number) => ({
                id: `viva-block-${model.id}-${idx}-${Date.now()}`,
                date: tx.date || "---",
                description: String(tx.description || "").toUpperCase().trim(),
                rawDescription: tx.rawDescription || tx.description,
                amount: Number(tx.amount) || 0,
                originalAmount: String(tx.originalAmount || tx.amount),
                cleanedDescription: tx.description,
                contributionType: tx.contributionType || 'AUTO',
                paymentMethod: tx.paymentMethod || 'OUTROS',
                bank_id: model.id
            }));
        }

        /**
         * 🚀 MODO COLUNAS (DETERMINÍSTICO - EXCEL/CSV)
         * Réplica exata da simulação sobre o texto bruto.
         */
        if (!rawText.trim()) return [];
        
        const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
        const results: Transaction[] = [];
        const currentYear = new Date().getFullYear();
        const modelKeywords = mapping.ignoredKeywords || [];

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
                const learnedDescription = NameResolver.clean(rawDesc, modelKeywords, []);
                
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