
import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { NameResolver } from '../processors/NameResolver';
import { TypeResolver } from '../processors/TypeResolver';

/**
 * 📜 CONTRACT EXECUTOR (V20 - FIDELIDADE DETERMINÍSTICA)
 * --------------------------------------------------------------------------
 * Este componente ignora interpretações de IA e executa exatamente o 
 * que foi gravado no mapeamento do modelo.
 */

export const ContractExecutor = {
    /**
     * Aplica as coordenadas do contrato ao conteúdo bruto.
     */
    async apply(model: FileModel, adaptedInput: any): Promise<Transaction[]> {
        if (!model || !model.mapping) return [];

        const rawText = adaptedInput?.__rawText || (typeof adaptedInput === 'string' ? adaptedInput : "");
        const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        const { mapping } = model;
        const yearAnchor = DateResolver.discoverAnchorYear(rawText);
        const results: Transaction[] = [];

        // 🚀 EXECUÇÃO RÁPIDA E FIEL
        lines.forEach((line, idx) => {
            // Ignora linhas conforme o contrato (Skip Rows)
            if (idx < (mapping.skipRowsStart || 0)) return;

            const cells = line.split(';'); // O Orchestrator garante que o input venha como CSV virtual
            
            const rawDate = cells[mapping.dateColumnIndex] || "";
            const rawDesc = cells[mapping.descriptionColumnIndex] || "";
            const rawAmount = cells[mapping.amountColumnIndex] || "";

            if (!rawDate && !rawDesc && !rawAmount) return;

            const isoDate = DateResolver.resolveToISO(rawDate, yearAnchor);
            const stdAmount = AmountResolver.clean(rawAmount);
            const numAmount = parseFloat(stdAmount);

            // Validação mínima de contrato: deve ter data e valor para ser transação
            if (isoDate && !isNaN(numAmount)) {
                results.push({
                    id: `exec-${model.id}-${idx}`,
                    date: isoDate,
                    description: rawDesc.trim(),
                    rawDescription: line,
                    amount: numAmount,
                    originalAmount: rawAmount,
                    // BLINDAGEM: O nome é retornado conforme o contrato, sem limpeza extra
                    cleanedDescription: rawDesc.trim(), 
                    contributionType: TypeResolver.resolveFromDescription(rawDesc),
                    paymentMethod: mapping.paymentMethodColumnIndex !== undefined ? cells[mapping.paymentMethodColumnIndex] : 'OUTROS'
                });
            }
        });

        console.log(`[Executor] ${results.length} registros extraídos fielmente via contrato "${model.name}"`);
        return results;
    }
};
