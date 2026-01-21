import { Transaction, FileModel } from '../../types';
import { DateResolver } from '../processors/DateResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { extractTransactionsFromComplexBlock } from '../../services/geminiService';

/**
 * 📜 CONTRACT EXECUTOR (V9 - BLINDAGEM DE CONTRATO)
 * Este motor é o funil absoluto para modelos treinados.
 * Garante que se houver um modelo aplicado, ele seja a verdade única até a UI.
 */
export const ContractExecutor = {
    async apply(model: FileModel, normalizedContent: string): Promise<Transaction[]> {
        // 1. VALIDAÇÃO DE CONTRATO (BLINDAGEM DE ENTRADA)
        // O snippet é a prova real do aprendizado. Sem ele, o modelo é considerado inválido para execução segura.
        if (!model || !model.mapping || !model.snippet) {
            console.error("[Executor:ABORT] Falha de integridade: Modelo sem snippet aprendido ou mapeamento ausente.");
            return [];
        }

        // DEFINIÇÃO DA FONTE ÚNICA
        // Em modelos treinados, o snippet aprendido TEM PRECEDÊNCIA ABSOLUTA sobre o conteúdo bruto
        // para garantir que a UI mostre exatamente o que foi validado no laboratório.
        const sourceContent = model.snippet;
        const lines = sourceContent.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        console.log(`[Executor:INPUT] Model: "${model.name}" | Snippet Lines: ${lines.length} | Mode: ${model.mapping.extractionMode || 'COLUMNS'}`);

        if (lines.length === 0) {
            console.warn("[Executor:ABORT] Snippet vazio detectado. Abortando para evitar dados falsos.");
            return [];
        }

        const extractionMode = model.mapping.extractionMode || 'COLUMNS';
        let results: Transaction[] = [];

        try {
            // 2. PROCESSAMENTO ISOLADO POR MODO
            if (extractionMode === 'BLOCK') {
                const aiResults = await extractTransactionsFromComplexBlock(sourceContent);
                results = (aiResults || []).map((tx: any, idx: number) => ({
                    id: `block-${model.id}-${idx}-${Date.now()}`,
                    date: tx.date,
                    description: tx.description,
                    rawDescription: tx.description,
                    amount: Number(tx.amount) || 0,
                    originalAmount: String(tx.amount),
                    cleanedDescription: tx.description,
                    contributionType: tx.type || 'AUTO',
                    paymentMethod: tx.paymentMethod || 'OUTROS'
                }));
            } 
            else {
                // MODO COLUNAS (MAPEAMENTO 1:1 BASEADO NO CONTRATO DO MODELO)
                const { 
                    dateColumnIndex, 
                    descriptionColumnIndex, 
                    amountColumnIndex, 
                    paymentMethodColumnIndex, 
                    typeColumnIndex,
                    skipRowsStart 
                } = model.mapping;

                const delimiter = model.fingerprint.delimiter || ';';
                const yearAnchor = DateResolver.discoverAnchorYear(sourceContent);

                results = lines.reduce((acc: Transaction[], line, index) => {
                    // Pula conforme contrato do modelo
                    if (index < (skipRowsStart || 0)) return acc;

                    const cols = line.split(delimiter);
                    
                    // Extração Bruta conforme índices salvos no treinamento
                    const rawDate = (cols[dateColumnIndex] !== undefined) ? (cols[dateColumnIndex] || '').trim() : '';
                    const rawDesc = (cols[descriptionColumnIndex] !== undefined) ? (cols[descriptionColumnIndex] || '').trim() : '';
                    const rawAmount = (cols[amountColumnIndex] !== undefined) ? (cols[amountColumnIndex] || '').trim() : '';

                    if (!rawDate && !rawDesc && !rawAmount) return acc;

                    // Normalização Técnica Interna
                    const stdAmount = AmountResolver.clean(rawAmount);
                    const numericValue = parseFloat(stdAmount);
                    const isoDate = DateResolver.resolveToISO(rawDate, yearAnchor);

                    acc.push({
                        id: `col-${model.id}-${index}-${Date.now()}`,
                        date: isoDate || rawDate,
                        description: rawDesc,
                        rawDescription: rawDesc,
                        amount: isNaN(numericValue) ? 0 : numericValue,
                        originalAmount: rawAmount,
                        cleanedDescription: rawDesc, 
                        contributionType: (typeColumnIndex !== undefined && cols[typeColumnIndex]) 
                            ? cols[typeColumnIndex].trim().toUpperCase() 
                            : 'AUTO',
                        paymentMethod: (paymentMethodColumnIndex !== undefined && cols[paymentMethodColumnIndex]) 
                            ? cols[paymentMethodColumnIndex].trim().toUpperCase() 
                            : 'OUTROS'
                    });

                    return acc;
                }, []);
            }

            // 3. RETORNO ÚNICO E DETERMINÍSTICO (BLINDAGEM DE SAÍDA)
            // Nunca permite fallback para o pipeline genérico se este ponto for atingido.
            console.log(`[Executor:OUTPUT] Final Count: ${results.length} | Origin: MODEL_CONTRACT`);
            return results;

        } catch (error) {
            console.error(`[Executor:CRITICAL_FAILURE] Model: ${model.name}`, error);
            // Em caso de erro catastrófico no motor do modelo, retorna lista vazia para impedir poluição de dados legados.
            return [];
        }
    }
};