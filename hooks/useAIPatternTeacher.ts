
import { useState, useCallback } from 'react';
import { extractTransactionsWithModel } from '../services/geminiService';
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
    fullFileText?: string;
}

export const useAIPatternTeacher = ({
    gridData,
    setGridData,
    setActiveMapping,
    showToast,
    fullFileText
}: UseAIPatternTeacherProps) => {
    const [isInferringMapping, setIsInferringMapping] = useState(false);
    const [learnedPatternSource, setLearnedPatternSource] = useState<{ originalRaw: string[], corrected: any, context?: string[][] } | null>(null);

    /**
     * APLICAR PADRÃO (V29 - ENSINO POR GABARITO RÍGIDO)
     */
    const handleApplyCorrectionPattern = useCallback(async (): Promise<LearningPackage | null> => {
        if (gridData.length === 0) return null;
        
        setIsInferringMapping(true);

        try {
            // Contexto das linhas brutas do laboratório
            const rawSnippet = gridData.slice(0, 150).map((row, i) => `[ID:${i}]: ${row.join(' ; ')}`).join('\n');
            const globalHeaderContext = fullFileText ? `### CONTEXTO DO ARQUIVO (REFERÊNCIA DE ANO/BANCO):\n${fullFileText.substring(0, 2000)}\n\n` : "";

            let contractContext = globalHeaderContext;
            
            if (learnedPatternSource) {
                contractContext += `### GABARITO DE REGRA (O MODELO A SEGUIR) ###\n`;
                contractContext += `LINHA BRUTA ORIGINAL: "${learnedPatternSource.originalRaw.join(' | ')}"\n`;
                contractContext += `COMO DEVE FICAR (ALGORITMO): ${JSON.stringify({
                    data: learnedPatternSource.corrected.date,
                    descricao_limpa: learnedPatternSource.corrected.description,
                    valor_final: learnedPatternSource.corrected.amount,
                    forma: learnedPatternSource.corrected.paymentMethod
                })}\n`;
                contractContext += `\nREPLIQUE A LÓGICA DESTE GABARITO PARA TODO O RESTO DO TEXTO.\n`;
            }

            const result = await extractTransactionsWithModel(rawSnippet, contractContext);
            
            if (result && result.length > 0) {
                const reStructuredGrid = result.map((r: any) => [
                    String(r.date || ''), 
                    String(r.description || ''), 
                    String(r.amount || '0'),
                    String(r.type || 'AUTO'),
                    String(r.paymentMethod || 'OUTROS')
                ]);

                setGridData(reStructuredGrid);
                
                const mapping = { 
                    extractionMode: 'BLOCK' as const,
                    dateColumnIndex: 0, 
                    descriptionColumnIndex: 1, 
                    amountColumnIndex: 2, 
                    typeColumnIndex: 3,
                    paymentMethodColumnIndex: 4,
                    skipRowsStart: 0,
                    skipRowsEnd: 0,
                    decimalSeparator: ',' as const,
                    thousandsSeparator: '.' as const
                };

                setActiveMapping(mapping);
                showToast("Inteligência de linha-modelo aplicada!", "success");
                return { model: { mapping }, sampleTransactions: [], confidence: 1.0 };
            }
            
            showToast("IA não conseguiu identificar a regra através do seu exemplo.", "error");
            return null;

        } catch (e: any) { 
            showToast("Erro na IA: " + (e.message || "Indisponível"), "error"); 
            return null;
        } finally { 
            setIsInferringMapping(false); 
        }
    }, [learnedPatternSource, gridData, fullFileText, setGridData, setActiveMapping, showToast]);

    return {
        isInferringMapping,
        learnedPatternSource,
        setLearnedPatternSource,
        handleApplyCorrectionPattern
    };
};
