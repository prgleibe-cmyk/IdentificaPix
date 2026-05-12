
import { useState, useCallback } from 'react';
import { learnPattern } from '../services/geminiService';
import { FileModel, Transaction } from '../types';

interface UseAIPatternTeacherProps {
    gridData: string[][];
    setGridData: (data: string[][]) => void;
    setActiveMapping: (mapping: any) => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
    fullFileText?: string;
    rawBase64?: string; 
}

/**
 * @frozen-block: PATTERN_TEACHER_ENGINE
 * PROIBIDO REFATORAR ESTE HOOK SEM AUTORIZAÇÃO EXPLÍCITA.
 * Este bloco garante a integridade do aprendizado de modelos, protegendo as regras de 
 * negatividade (débitos bancários) e extração de Forma de Pagamento.
 */
export const useAIPatternTeacher = ({
    gridData,
    setGridData,
    setActiveMapping,
    showToast,
    fullFileText,
    rawBase64
}: UseAIPatternTeacherProps) => {
    const [isInferringMapping, setIsInferringMapping] = useState(false);
    const [learnedPatternSource, setLearnedPatternSource] = useState<{ originalRaw: string[], corrected: any } | null>(null);

    const handleApplyCorrectionPattern = useCallback(async (extractionMode: 'COLUMNS' | 'BLOCK' = 'COLUMNS') => {
        if (!learnedPatternSource || isInferringMapping) return;
        
        setIsInferringMapping(true);
        const isBlockMode = extractionMode === 'BLOCK';

        try {
            /**
             * 🛡️ AJUSTE DE ECONOMIA DE TOKENS (JANELA ESQUERDA APENAS)
             * Empregamos apenas o contexto necessário da grid para orientar o aprendizado.
             */
            const visibleContext = gridData.map(row => row.join(';')).join('\n');
            
            const result = await learnPattern(
                extractionMode,
                learnedPatternSource,
                visibleContext
            );
            
            setActiveMapping((prev: any) => {
                console.log("[TRAIN:SNAPSHOT] Linha modelo salva literal");
                
                const base = {
                    ...prev,
                    extractionMode: isBlockMode ? 'BLOCK' : 'COLUMNS',
                    learnedSnapshot: { ...learnedPatternSource.corrected } // Preservação literal do gabarito como contrato
                };

                if (isBlockMode) {
                    return {
                        ...base,
                        blockContract: `CONTRATO RIGOROSO (VERDADE DO ADMIN): [${learnedPatternSource.originalRaw.join(' | ')}] -> Data:${learnedPatternSource.corrected.date} | Desc:${learnedPatternSource.corrected.description} | Valor:${learnedPatternSource.corrected.amount} | Forma:${learnedPatternSource.corrected.paymentMethod}. REGRA TÉCNICA: ${result.blockRecipe}`,
                        dateColumnIndex: -1,
                        descriptionColumnIndex: -1,
                        amountColumnIndex: -1,
                        paymentMethodColumnIndex: -1
                    };
                }

                return {
                    ...base,
                    dateColumnIndex: result.dateColumnIndex,
                    descriptionColumnIndex: result.descriptionColumnIndex,
                    amountColumnIndex: result.amountColumnIndex,
                    paymentMethodColumnIndex: result.paymentMethodColumnIndex ?? -1,
                    ignoredKeywords: result.ignoredKeywords || []
                };
            });

            showToast("Padrão aprendido com rigor!", "success");
            setLearnedPatternSource(null);
        } catch (e: any) {
            console.error("[PatternTeacher] Fail:", e);
            showToast("Erro ao aprender o padrão.", "error");
        } finally {
            setIsInferringMapping(false);
        }
    }, [learnedPatternSource, isInferringMapping, gridData, setActiveMapping, showToast]);

    return {
        isInferringMapping,
        learnedPatternSource,
        setLearnedPatternSource,
        handleApplyCorrectionPattern
    };
};
