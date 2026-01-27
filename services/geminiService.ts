
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction } from '../types';
import { Logger } from "./monitoringService";

const getAIClient = () => {
    if (!process.env.API_KEY) throw new Error("Chave de API do Gemini não configurada.");
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const safeJsonParse = (input: any, fallback: any = []) => {
    if (!input) return fallback;
    let sanitized = String(input).trim();
    sanitized = sanitized.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');

    try {
        const parsed = JSON.parse(sanitized);
        if (parsed.rows) return parsed.rows;
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
        return fallback;
    }
};

export const inferMappingFromSample = async (sampleText: string): Promise<any> => {
    const ai = getAIClient();
    const prompt = `Analise a estrutura física e topologia deste arquivo bancário.
    TEXTO:
    ${sampleText}`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            temperature: 0, 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    extractionMode: { type: Type.STRING },
                    dateColumnIndex: { type: Type.INTEGER },
                    descriptionColumnIndex: { type: Type.INTEGER },
                    amountColumnIndex: { type: Type.INTEGER },
                    skipRowsStart: { type: Type.INTEGER }
                },
                required: ["extractionMode", "dateColumnIndex", "descriptionColumnIndex", "amountColumnIndex", "skipRowsStart"]
            }
        }
    });
    return JSON.parse(response.text || "{}");
};

export const extractTransactionsWithModel = async (rawText: string, modelContext?: string): Promise<any> => {
    const ai = getAIClient();
    
    // SISTEMA DE REPLICAÇÃO RÍGIDA (V7 - BLINDAGEM DE BLOCO)
    const isBlockPattern = modelContext?.includes("RITMO");

    const finalPrompt = isBlockPattern 
    ? `VOCÊ É UM MOTOR DE EXTRAÇÃO DE BLOCOS RÍGIDOS.
       PROIBIDO: Não trate cada linha de texto como um registro.
       PROIBIDO: Não invente dados.
       
       CONTRATO DE AGRUPAMENTO (RECEITA):
       ${modelContext}
       
       TEXTO BRUTO PARA PROCESSAR:
       ${rawText}

       INSTRUÇÕES DE EXECUÇÃO:
       1. Identifique o início de uma transação (geralmente uma linha com data).
       2. Use a RECEITA acima para saltar o número exato de linhas e capturar o Nome e o Valor.
       3. Combine as informações capturadas em várias linhas em um único objeto JSON por transação.
       4. Avance para o próximo bloco somente após processar todas as linhas do bloco atual.`
    
    : `REPLIQUE O PADRÃO DE COLUNAS:
       ${modelContext}
       TEXTO:
       ${rawText}`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: finalPrompt,
        config: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    rows: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                date: { type: Type.STRING },
                                description: { type: Type.STRING },
                                amount: { type: Type.NUMBER }
                            },
                            required: ["date", "description", "amount"]
                        }
                    }
                },
                required: ["rows"]
            }
        }
    });
    return safeJsonParse(response.text);
};

export const extractTransactionsFromComplexBlock = async (rawText: string, globalContext?: string): Promise<any> => {
    return await extractTransactionsWithModel(rawText, globalContext);
};

export const extractStructuredDataByExample = async (rawText: string, globalContext?: string): Promise<any> => {
    return await extractTransactionsWithModel(rawText, globalContext);
};
