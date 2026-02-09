
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
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        try {
            const isBlockMode = extractionMode === 'BLOCK';
            
            // @frozen-block-start: TEACHER_RIGID_PROMPT
            // ESTA INSTRUÇÃO NÃO DEVE SER ALTERADA. ELA É O ALICERCE DO CONTRATO DE VERDADE ÚNICA.
            const instruction = isBlockMode 
            ? `VOCÊ É UM EXECUTOR DE CONTRATOS RÍGIDOS. O Admin editou uma linha modelo que é sua ÚNICA VERDADE ABSOLUTA.
            
            --- LINHA MESTRA (GABARITO DO ADMIN) ---
            Texto Bruto no Documento: "${learnedPatternSource.originalRaw.join(' | ')}"
            Extração Correta Definida pelo Admin: 
            - Data: "${learnedPatternSource.corrected.date}" 
            - Descrição: "${learnedPatternSource.corrected.description}" 
            - Valor: "${learnedPatternSource.corrected.amount}" (Observe rigorosamente o sinal)
            - Forma: "${learnedPatternSource.corrected.paymentMethod}"
            
            --- TAREFA E REGRAS CRÍTICAS (BLINDADAS) ---
            1. PROIBIDO ADIVINHAR OU MELHORAR: Sua inteligência deve se limitar a replicar a relação física entre o Bruto e o Gabarito.
            2. CONVENÇÃO BANCÁRIA (DÉBITO): Se o Admin definiu um valor como NEGATIVO e no Bruto ele possui o sufixo "D" ou "DEBITO", aprenda que esse padrão significa multiplicação por -1.
            3. FORMA DE PAGAMENTO: ExtraIA a coluna "Forma" seguindo EXATAMENTE a lógica que o Admin aplicou na Linha Mestra.
            4. FIDELIDADE TOTAL: Gere uma "blockRecipe" JSON técnica que permita encontrar TODAS as linhas similares a esta no documento e transformá-las EXATAMENTE como no gabarito sem alterar um único caractere ou símbolo do texto original.`
            
            : `VOCÊ É UM IDENTIFICADOR DE POSIÇÕES FIXAS PARA DOCUMENTOS ESTRUTURADOS. 
            Exemplo Bruto: "${learnedPatternSource.originalRaw.join(' ; ')}"
            GABARITO ABSOLUTO: Data: "${learnedPatternSource.corrected.date}", Nome: "${learnedPatternSource.corrected.description}", Valor: "${learnedPatternSource.corrected.amount}", Forma: "${learnedPatternSource.corrected.paymentMethod}"
            
            TAREFA:
            1. Determine os índices de 0 a N correspondentes ao GABARITO.
            2. Não tente normalizar, corrigir ou reescrever o texto agora. 
            3. Identifique palavras que devem ser removidas (ignoredKeywords) apenas se for estritamente necessário para que o texto bruto resulte na Descrição do Gabarito.
            4. Se o Gabarito for identico ao Bruto em determinada coluna, não sugira nenhuma limpeza.`;
            // @frozen-block-end: TEACHER_RIGID_PROMPT

            const parts: any[] = [];

            /**
             * 🛡️ AJUSTE DE ECONOMIA DE TOKENS (JANELA ESQUERDA APENAS)
             * Empregamos apenas o contexto necessário da grid para orientar o aprendizado.
             */
            const visibleContext = gridData.map(row => row.join(';')).join('\n');
            parts.push({ text: `AMOSTRA DO DOCUMENTO (CONTEÚDO DA JANELA ESQUERDA):\n${visibleContext}` });

            parts.push({ text: instruction });

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview', 
                contents: { parts },
                config: { 
                    temperature: 0,
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
                            paymentMethodColumnIndex: { type: Type.INTEGER },
                            ignoredKeywords: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["dateColumnIndex", "descriptionColumnIndex", "amountColumnIndex", "ignoredKeywords"]
                    }
                }
            });

            const result = JSON.parse(response.text || "{}");
            
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
