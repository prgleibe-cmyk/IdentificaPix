
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

    const handleApplyCorrectionPattern = useCallback(async () => {
        if (!learnedPatternSource) return;
        
        setIsInferringMapping(true);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        try {
            // Prompts mais rígidos e explicativos para evitar alucinações da IA
            const prompt = `Você é um Engenheiro de Dados especialista em extratos bancários.
            O Usuário Admin está te ENSINANDO um padrão fixo de extração através de um EXEMPLO REAL (Modelo de Ouro).
            
            DADOS DO EXEMPLO:
            - Linha Bruta (colunas separadas por ';'): "${learnedPatternSource.originalRaw.join(' ; ')}"
            - Como deve ficar o Nome/Descrição final: "${learnedPatternSource.corrected.description}"
            - Como deve ficar o Valor final: "${learnedPatternSource.corrected.amount}"
            - Como deve ficar a Data final: "${learnedPatternSource.corrected.date}"
            
            SUA TAREFA:
            1. Identifique os índices exatos (base zero) das colunas de Data, Descrição e Valor na linha bruta.
            2. Analise a coluna de descrição bruta e identifique quais partes o admin removeu para chegar no "Nome Corrigido". 
               Essas partes são "Palavras de Ruído" (ex: "PIX RECEBIDO", "TRANSF", "DOCTO").
            3. Crie uma regra de extração DETERMINÍSTICA baseada APENAS nestas posições. 
            
            REGRAS CRÍTICAS:
            - NUNCA tente adivinhar dados que não existem.
            - NUNCA sugira palavras de ruído que não apareçam claramente na linha bruta.
            - Seja extremamente conservador: o objetivo é fidelidade absoluta ao que o Admin ensinou.`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
                config: { 
                    temperature: 0,
                    thinkingConfig: { thinkingBudget: 4000 },
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            dateColumnIndex: { type: Type.INTEGER, description: "Índice da coluna de data" },
                            descriptionColumnIndex: { type: Type.INTEGER, description: "Índice da coluna de descrição/nome" },
                            amountColumnIndex: { type: Type.INTEGER, description: "Índice da coluna de valor monetário" },
                            ignoredKeywords: { 
                                type: Type.ARRAY, 
                                items: { type: Type.STRING },
                                description: "Lista de termos fixos identificados como ruído na descrição" 
                            }
                        },
                        required: ["dateColumnIndex", "descriptionColumnIndex", "amountColumnIndex", "ignoredKeywords"]
                    }
                }
            });

            const result = JSON.parse(response.text || "{}");
            
            if (result && typeof result.dateColumnIndex === 'number') {
                setActiveMapping((prev: any) => ({
                    ...prev,
                    extractionMode: 'COLUMNS', // Força modo determinístico após aprendizado
                    dateColumnIndex: result.dateColumnIndex,
                    descriptionColumnIndex: result.descriptionColumnIndex,
                    amountColumnIndex: result.amountColumnIndex,
                    // Une as palavras aprendidas agora com as que o modelo já tinha, sem duplicar
                    ignoredKeywords: Array.from(new Set([
                        ...(prev.ignoredKeywords || []), 
                        ...(result.ignoredKeywords || [])
                    ].map(k => k.trim().toUpperCase()))).filter(k => k.length > 2)
                }));
                showToast("Padrão aprendido com sucesso! Aplicando regra rígida.", "success");
            }
        } catch (e: any) {
            console.error("[Teacher] Fail:", e);
            showToast("IA não conseguiu processar o padrão deste exemplo.", "error");
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
