
import { useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
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

    const handleApplyCorrectionPattern = useCallback(async () => {
        if (!learnedPatternSource) return;
        
        setIsInferringMapping(true);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

        try {
            const prompt = `Compare a linha bruta com a correção do usuário.
            Linha Bruta: "${learnedPatternSource.originalRaw.join(' ; ')}"
            Nome Corrigido: "${learnedPatternSource.corrected.description}"
            
            Identifique quais palavras da linha bruta são RUÍDO (não fazem parte do nome real) e devem ser ignoradas no futuro.
            Retorne um JSON com:
            - ignoredKeywords: string[] (ex: ["RECEBIMENTO", "PIX"])
            - dateColumnIndex, descriptionColumnIndex, amountColumnIndex (índices base zero)`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { temperature: 0, responseMimeType: "application/json" }
            });

            const result = JSON.parse(response.text || "{}");
            
            if (result) {
                setActiveMapping((prev: any) => ({
                    ...prev,
                    dateColumnIndex: result.dateColumnIndex ?? prev.dateColumnIndex,
                    descriptionColumnIndex: result.descriptionColumnIndex ?? prev.descriptionColumnIndex,
                    amountColumnIndex: result.amountColumnIndex ?? prev.amountColumnIndex,
                    // Armazena as palavras aprendidas no mapeamento para persistência
                    ignoredKeywords: Array.from(new Set([...(prev.ignoredKeywords || []), ...(result.ignoredKeywords || [])]))
                }));
                showToast("IA aprendeu as palavras de ruído e o mapeamento.", "success");
            }
        } catch (e) {
            showToast("Falha ao aprender com o exemplo.", "error");
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
