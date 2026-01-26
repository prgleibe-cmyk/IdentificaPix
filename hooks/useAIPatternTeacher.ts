
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

    const handleApplyCorrectionPattern = useCallback(async (): Promise<LearningPackage | null> => {
        if (gridData.length === 0) return null;
        
        setIsInferringMapping(true);

        try {
            const rawSnippet = gridData.slice(0, 150).map((row, i) => `[ID:${i}]: ${row.join(' ; ')}`).join('\n');
            
            let instruction = "ConverTA o texto bruto em JSON seguindo este exemplo exato:\n";
            
            if (learnedPatternSource) {
                instruction += `LINHA DE REFERÊNCIA: "${learnedPatternSource.originalRaw.join(' ; ')}"\n`;
                instruction += `RESULTADO ESPERADO: ${JSON.stringify({
                    date: learnedPatternSource.corrected.date,
                    description: learnedPatternSource.corrected.description,
                    amount: learnedPatternSource.corrected.amount
                })}\n`;
                instruction += "Não tente adivinhar outros campos ou regras. Use este mapeamento para processar o restante.";
            }

            const result = await extractTransactionsWithModel(rawSnippet, instruction);
            
            if (result && result.length > 0) {
                const reStructuredGrid = result.map((r: any) => [
                    String(r.date || ''), 
                    String(r.description || ''), 
                    String(r.amount || '0'),
                    String(r.type || 'AUTO'),
                    String(r.paymentMethod || 'OUTROS')
                ]);

                setGridData(reStructuredGrid);
                
                // FIX: Added missing required properties 'skipRowsEnd' and 'thousandsSeparator' to satisfy the FileModel mapping type.
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
                showToast("Padrão aplicado com base no seu exemplo.", "success");
                return { model: { mapping }, sampleTransactions: [], confidence: 1.0 };
            }
            
            return null;
        } catch (e: any) { 
            showToast("Falha na IA ao aplicar exemplo.", "error"); 
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
