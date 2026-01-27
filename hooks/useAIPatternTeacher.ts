
import { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { FileModel, Transaction } from '../types';

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
    showToast
}: UseAIPatternTeacherProps) => {
    const [isInferringMapping, setIsInferringMapping] = useState(false);
    const [learnedPatternSource, setLearnedPatternSource] = useState<{ originalRaw: string[], corrected: any } | null>(null);

    const handleApplyCorrectionPattern = useCallback(async (extractionMode: 'COLUMNS' | 'BLOCK' = 'COLUMNS') => {
        if (!learnedPatternSource) return;
        
        setIsInferringMapping(true);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        try {
            const isBlockMode = extractionMode === 'BLOCK';
            
            const prompt = isBlockMode 
            ? `VOCÊ É UM PROGRAMADOR DE EXTRATORES DE TEXTO. 
            O administrador corrigiu uma linha que eu extraí errado. Eu li apenas uma linha, mas ele preencheu dados que estão espalhados em várias linhas seguintes.

            TEXTO BRUTO DE ORIGEM (Janela de 12 linhas):
            ${learnedPatternSource.originalRaw.map((l, i) => `[LINHA ${i}]: "${l}"`).join('\n')}

            O QUE O HUMANO PREENCHEU (GABARITO):
            - Data: "${learnedPatternSource.corrected.date}"
            - Nome/Descrição: "${learnedPatternSource.corrected.description}"
            - Valor: "${learnedPatternSource.corrected.amount}"

            SUA MISSÃO:
            1. Encontre em quais índices de [LINHA X] estão cada um dos dados acima.
            2. Calcule o "TAMANHO DO BLOCO": Quantas linhas (do [LINHA 0] até o final do registro) compõem uma transação completa?
            3. Gere uma "RECEITA" descrevendo os saltos. Ex: "A transação começa na linha que tem uma data. O nome está 2 linhas abaixo. O registro termina após 5 linhas."

            IMPORTANTE: Responda no formato JSON solicitado.`
            
            : `VOCÊ É UM EXTRATOR DE PADRÕES ESTRUTURAIS LATERAIS.
            Mapeie os índices de colunas (0 a N) baseando-se na correção:
            BRUTO: "${learnedPatternSource.originalRaw.join(' ; ')}"
            GABARITO: Data: "${learnedPatternSource.corrected.date}", Nome: "${learnedPatternSource.corrected.description}", Valor: "${learnedPatternSource.corrected.amount}"`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
                config: { 
                    temperature: 0,
                    responseMimeType: "application/json",
                    responseSchema: isBlockMode ? {
                        type: Type.OBJECT,
                        properties: {
                            blockRecipe: { type: Type.STRING, description: "Instrução técnica detalhada de como agrupar as linhas" },
                            linesPerRecord: { type: Type.INTEGER, description: "Número exato de linhas físicas por transação" }
                        },
                        required: ["blockRecipe", "linesPerRecord"]
                    } : {
                        type: Type.OBJECT,
                        properties: {
                            dateColumnIndex: { type: Type.INTEGER },
                            descriptionColumnIndex: { type: Type.INTEGER },
                            amountColumnIndex: { type: Type.INTEGER },
                            ignoredKeywords: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["dateColumnIndex", "descriptionColumnIndex", "amountColumnIndex", "ignoredKeywords"]
                    }
                }
            });

            const result = JSON.parse(response.text || "{}");
            
            setActiveMapping((prev: any) => {
                if (isBlockMode) {
                    return {
                        ...prev,
                        extractionMode: 'BLOCK',
                        blockContract: `MAPA POSICIONAL: ${result.blockRecipe} | RITMO: ${result.linesPerRecord} linhas por registro.`,
                        dateColumnIndex: -1,
                        descriptionColumnIndex: -1,
                        amountColumnIndex: -1
                    };
                }

                const newIgnored = Array.from(new Set([
                    ...(prev.ignoredKeywords || []), 
                    ...(result.ignoredKeywords || [])
                ].map(k => k.trim().toUpperCase()))).filter(k => k.length >= 2);

                return {
                    ...prev,
                    extractionMode: 'COLUMNS',
                    dateColumnIndex: result.dateColumnIndex,
                    descriptionColumnIndex: result.descriptionColumnIndex,
                    amountColumnIndex: result.amountColumnIndex,
                    ignoredKeywords: newIgnored
                };
            });
            showToast("Padrão de bloco aprendido.", "success");
        } catch (e: any) {
            console.error("[PatternTeacher] Fail:", e);
            showToast("IA não conseguiu identificar o padrão de agrupamento.", "error");
        } finally {
            setIsInferringMapping(false);
            setLearnedPatternSource(null);
        }
    }, [learnedPatternSource, setActiveMapping, showToast]);

    return {
        isInferringMapping,
        learnedPatternSource,
        setLearnedPatternSource,
        handleApplyCorrectionPattern
    };
};
