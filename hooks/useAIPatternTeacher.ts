
import { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { FileModel, Transaction } from '../types';

interface UseAIPatternTeacherProps {
    gridData: string[][];
    setGridData: (data: string[][]) => void;
    setActiveMapping: (mapping: any) => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
    fullFileText?: string;
    rawBase64?: string; 
}

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
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        try {
            const isBlockMode = extractionMode === 'BLOCK';
            
            const instruction = isBlockMode 
            ? `VOCÊ É UM ENGENHEIRO DE REPRODUÇÃO ESTRUTURAL. O Admin editou uma linha modelo para te ensinar o padrão visual de extração.
            --- PADRÃO DE REFERÊNCIA (APRENDA ESTA ESTRUTURA) ---
            Texto Bruto no Documento: "${learnedPatternSource.originalRaw.join(' | ')}"
            Extração Correta: Date:"${learnedPatternSource.corrected.date}" | Desc:"${learnedPatternSource.corrected.description}" | Amount:"${learnedPatternSource.corrected.amount}"
            
            SUA TAREFA: Analisar esta relação e gerar uma "blockRecipe" JSON que descreva como encontrar TODAS as transações similares neste documento. 
            Não extraia apenas esta linha; aprenda a lógica para extrair o documento todo.`
            
            : `VOCÊ É UM EXTRATOR DE ÍNDICES DE COLUNA. Determine os índices de 0 a N correspondentes:
            BRUTO: "${learnedPatternSource.originalRaw.join(' ; ')}"
            GABARITO: Data: "${learnedPatternSource.corrected.date}", Nome: "${learnedPatternSource.corrected.description}", Valor: "${learnedPatternSource.corrected.amount}"`;

            const contents: any = { parts: [] };

            if (isBlockMode && rawBase64) {
                contents.parts.push({
                    inlineData: {
                        data: rawBase64,
                        mimeType: 'application/pdf'
                    }
                });
            } else if (fullFileText) {
                contents.parts.push({ text: `CONTEÚDO DO DOCUMENTO (AMOSTRA):\n${fullFileText.substring(0, 5000)}` });
            }

            contents.parts.push({ text: instruction });

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview', 
                contents: contents,
                config: { 
                    temperature: 0,
                    maxOutputTokens: 800,
                    thinkingConfig: { thinkingBudget: 0 },
                    responseMimeType: "application/json",
                    responseSchema: isBlockMode ? {
                        type: Type.OBJECT,
                        properties: {
                            blockRecipe: { type: Type.STRING },
                            confidence: { type: Type.NUMBER }
                        },
                        required: ["blockRecipe"]
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
            
            // Ordem crítica: primeiro define o novo mapeamento (gatilho de simulação)
            setActiveMapping((prev: any) => {
                const base = {
                    ...prev,
                    extractionMode: isBlockMode ? 'BLOCK' : 'COLUMNS'
                };

                if (isBlockMode) {
                    return {
                        ...base,
                        blockContract: `CONTRATO RÍGIDO: [${learnedPatternSource.originalRaw.join(' | ')}] -> Date:${learnedPatternSource.corrected.date} | Desc:${learnedPatternSource.corrected.description} | Amount:${learnedPatternSource.corrected.amount}. REGRA: ${result.blockRecipe}`,
                        dateColumnIndex: -1,
                        descriptionColumnIndex: -1,
                        amountColumnIndex: -1
                    };
                }

                return {
                    ...base,
                    dateColumnIndex: result.dateColumnIndex,
                    descriptionColumnIndex: result.descriptionColumnIndex,
                    amountColumnIndex: result.amountColumnIndex,
                    ignoredKeywords: result.ignoredKeywords || []
                };
            });

            // Feedback e limpeza de fonte de ensino após a propagação do mapeamento
            showToast("Padrão aprendido!", "success");
            setLearnedPatternSource(null);
        } catch (e: any) {
            console.error("[PatternTeacher] Fail:", e);
            showToast("Erro ao aprender o padrão.", "error");
        } finally {
            setIsInferringMapping(false);
        }
    }, [learnedPatternSource, isInferringMapping, rawBase64, fullFileText, setActiveMapping, showToast]);

    return {
        isInferringMapping,
        learnedPatternSource,
        setLearnedPatternSource,
        handleApplyCorrectionPattern
    };
};
