
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
        const arrayMatch = sanitized.match(/\[\s*\{.*\}\s*\]/s);
        if (arrayMatch) {
            try { return JSON.parse(arrayMatch[0]); } catch (inner) {}
        }
        return fallback;
    }
};

async function callWithSimpleRetry(fn: () => Promise<any>, retries = 2): Promise<any> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, 2000));
            return callWithSimpleRetry(fn, retries - 1);
        }
        throw error;
    }
};

/**
 * MOTOR DE EXTRAÇÃO POR CONTRATO (V24 - OBEDIÊNCIA MÁXIMA)
 * Este motor é otimizado para NÃO adivinhar. Ele replica a lógica do exemplo.
 */
export const extractTransactionsWithModel = async (rawText: string, modelContext?: string): Promise<any> => {
    return await callWithSimpleRetry(async () => {
        const ai = getAIClient();
        
        const finalPrompt = `VOCÊ É UM PARSER LÓGICO DE DADOS BRUTOS. 
            NÃO TENTE ADIVINHAR OU USAR CONHECIMENTO PRÉVIO.
            
            USE O "CONTRATO DE EXEMPLO" ABAIXO COMO REGRA ABSOLUTA DE FATIAMENTO:
            ${modelContext ? `\n--- CONTRATO (REGRA DE TRANSFORMAÇÃO) ---\n${modelContext}\n` : ''}

            SUA TAREFA:
            1. Analise como a linha bruta do exemplo foi transformada na linha corrigida.
            2. Identifique o padrão de fatiamento (delimitadores, posições, remoção de ruídos).
            3. Aplique essa EXATA REGRA para extrair as transações do novo texto.
            4. Se o exemplo remover o ano ou converter termos (ex: 'Recebimento Pix' -> 'Pix'), faça o mesmo.
            
            Retorne apenas JSON seguindo o esquema.

            NOVO TEXTO PARA PROCESSAR:
            ${rawText.substring(0, 25000)}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', // Uso do modelo PRO para garantir execução por regra
            contents: finalPrompt,
            config: {
                temperature: 0, // Temperatura zero = Sem criatividade, apenas regra
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
    });
};

export const extractTransactionsFromComplexBlock = async (rawText: string, globalContext?: string): Promise<any> => {
    return await extractTransactionsWithModel(rawText, globalContext);
};

export const extractStructuredDataByExample = async (rawText: string, globalContext?: string): Promise<any> => {
    return await extractTransactionsWithModel(rawText, globalContext);
};

export const inferMappingFromSample = async (sampleText: string): Promise<any> => {
    return { extractionMode: 'BLOCK', dateColumnIndex: -1, descriptionColumnIndex: -1, amountColumnIndex: -1 };
};
