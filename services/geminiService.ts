
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
        return parsed.rows || parsed.transactions || (Array.isArray(parsed) ? parsed : fallback);
    } catch (e) {
        return fallback;
    }
};

/**
 * INFERÊNCIA DE MAPEAMENTO (V42 - RIGOR ESTRUTURAL)
 */
export const inferMappingFromSample = async (sampleText: string): Promise<any> => {
    const ai = getAIClient();
    const prompt = `Analise este extrato bancário e identifique a estrutura de colunas e padrões de limpeza.
    Amostra do Extrato:
    ${sampleText}`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            temperature: 0, 
            thinkingConfig: { thinkingBudget: 2000 },
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    extractionMode: { type: Type.STRING, description: "'COLUMNS' para arquivos tabulares (Excel/CSV) ou 'BLOCK' para texto corrido/PDFs complexos" },
                    dateColumnIndex: { type: Type.INTEGER },
                    descriptionColumnIndex: { type: Type.INTEGER },
                    amountColumnIndex: { type: Type.INTEGER },
                    suggestedIgnoredKeywords: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING },
                        description: "Termos repetitivos que não fazem parte do nome do pagador/recebedor"
                    },
                    skipRowsStart: { type: Type.INTEGER, description: "Número de linhas de cabeçalho a pular" }
                },
                required: ["extractionMode", "dateColumnIndex", "descriptionColumnIndex", "amountColumnIndex", "skipRowsStart"]
            }
        }
    });

    try {
        return JSON.parse(response.text || "{}");
    } catch (e) {
        return null;
    }
};

export const extractTransactionsWithModel = async (rawText: string, modelContext?: string): Promise<any> => {
    const ai = getAIClient();
    const finalPrompt = `Transforme o TEXTO em JSON seguindo o CONTRATO fornecido.
        ${modelContext ? `CONTRATO:\n${modelContext}\n` : ''}
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
                                amount: { type: Type.NUMBER },
                                type: { type: Type.STRING },
                                paymentMethod: { type: Type.STRING }
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
