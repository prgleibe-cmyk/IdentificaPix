
import { useState, useCallback } from 'react';
import { extractStructuredDataByExample } from '../services/geminiService';
import { FileModel, Transaction } from '../types';

export interface LearningPackage {
    model: Partial<FileModel>;
    sampleTransactions: Transaction[];
    confidence: number;
}

interface UseAIPatternTeacherProps {
    gridData: string[][];
    setGridData: (data: string[][]) => void;
    setActiveMapping: (mapping: any) => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
}

export const useAIPatternTeacher = ({
    gridData,
    setGridData,
    setActiveMapping,
    showToast
}: UseAIPatternTeacherProps) => {
    const [isInferringMapping, setIsInferringMapping] = useState(false);
    const [learnedPatternSource, setLearnedPatternSource] = useState<{ originalRaw: string[], corrected: any } | null>(null);

    /**
     * APLICAR PADRÃO (Fluxo Blindado UI -> Learn -> UI)
     * Garante resolução explícita e retorno de controle para a interface.
     */
    const handleApplyCorrectionPattern = useCallback(async (): Promise<LearningPackage | null> => {
        if (!learnedPatternSource || gridData.length === 0) return null;
        
        console.log("[Learn:START] Iniciando re-análise estrutural via IA...");
        setIsInferringMapping(true);

        try {
            const { originalRaw, corrected } = learnedPatternSource;
            // Pega uma amostra significativa para o aprendizado contextual
            const rawSnippet = gridData.slice(0, 300).map(row => row.join(';')).join('\n');
            
            const userExample = `O usuário corrigiu uma linha manualmente. Aprenda este padrão estrutural:
               LINHA ORIGINAL: [${originalRaw.join(' | ')}] 
               CORREÇÃO DESEJADA: 
               - Data: ${corrected.date}
               - Descrição: ${corrected.cleanedDescription}
               - Valor: ${corrected.amount}
               - Tipo: ${corrected.contributionType}
               - Forma (Pagamento): ${corrected.paymentMethod}
               
               Instrução: Re-analise o snippet de dados e extraia TODAS as linhas seguindo este padrão de colunas.`;
            
            const result = await extractStructuredDataByExample(rawSnippet, userExample);
            
            if (result?.rows?.length > 0) {
                // 1. Converte retorno da IA para grade estruturada
                const reStructuredGrid = result.rows.map((r: any) => [
                    String(r.date || ''), 
                    String(r.description || ''), 
                    String(r.amount || '0'),
                    String(r.type || 'AUTO'),
                    String(r.paymentMethod || 'OUTROS')
                ]);

                // 2. Atualiza a grade visual imediatamente (Bypass Pipeline)
                setGridData(reStructuredGrid);
                
                // 3. Define novo contrato de mapeamento baseado na nova grade
                const refinedMapping = { 
                    dateColumnIndex: 0, 
                    descriptionColumnIndex: 1, 
                    amountColumnIndex: 2, 
                    paymentMethodColumnIndex: 4,
                    typeColumnIndex: 3,
                    skipRowsStart: 0,
                    skipRowsEnd: 0,
                    decimalSeparator: '.' as const,
                    thousandsSeparator: '' as const,
                    extractionMode: 'COLUMNS' as const
                };

                setActiveMapping(refinedMapping);
                
                // 4. Limpeza de estado e resolução
                setLearnedPatternSource(null); 
                console.log("[Learn:DONE] Padrão aplicado e grade reconstruída.");
                showToast("Inteligência aplicada! Verifique os resultados na grade.", "success");

                return {
                    model: { mapping: refinedMapping },
                    sampleTransactions: [], 
                    confidence: 0.99
                };
            }
            
            console.warn("[Learn:ERROR] IA retornou conjunto vazio.");
            return null;

        } catch (e: any) { 
            console.error("[Learn:CRITICAL]", e);
            showToast("Erro ao processar padrão estrutural.", "error"); 
            return null;
        } finally { 
            setIsInferringMapping(false); 
        }
    }, [learnedPatternSource, gridData, setGridData, setActiveMapping, showToast]);

    return {
        isInferringMapping,
        learnedPatternSource,
        setLearnedPatternSource,
        handleApplyCorrectionPattern
    };
};
