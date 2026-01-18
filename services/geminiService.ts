
import { GoogleGenAI, Type } from "@google/genai";
import { Contributor, Transaction } from '../types';
import { Logger } from "./monitoringService";

/**
 * Inicialização centralizada seguindo as diretrizes de "new GoogleGenAI({apiKey: process.env.API_KEY})"
 */
const getAIClient = () => {
    // A chave é obtida exclusivamente da variável de ambiente injetada
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
        console.error("CRITICAL: Gemini API Key is missing.");
        throw new Error("Chave de API do Gemini não configurada no ambiente.");
    }
    return new GoogleGenAI({ apiKey });
};

// Retry simplificado com backoff exponencial e tratamento de chave
async function callWithSimpleRetry(fn: () => Promise<any>, retries = 3, delay = 4000): Promise<any> {
    try {
        return await fn();
    } catch (error: any) {
        const msg = error?.message?.toLowerCase() || "";
        
        // Tratamento de 404 (Entidade não encontrada) para Project IDX / AI Studio
        if (msg.includes("requested entity was not found")) {
             if (retries <= 0) throw error;

             console.warn("API Entity not found. Triggering key selection...");
             if (typeof window !== 'undefined' && (window as any).aistudio) {
                 try {
                     await (window as any).aistudio.openSelectKey();
                     return callWithSimpleRetry(fn, retries - 1, delay); 
                 } catch (e) {
                     throw error;
                 }
             }
        }

        if (msg.includes("429") || msg.includes("quota")) {
            if (retries > 0) {
                await new Promise(r => setTimeout(r, delay * 2));
                return callWithSimpleRetry(fn, retries - 1, delay * 2);
            }
        }
        
        if (retries > 0) {
            await new Promise(r => setTimeout(r, delay));
            return callWithSimpleRetry(fn, retries - 1, delay);
        }
        throw error;
    }
};

/**
 * Extração visual utilizando gemini-2.5-flash-image
 */
export const extractDataFromVisual = async (file: File): Promise<string> => {
    const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    return await callWithSimpleRetry(async () => {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: file.type, data: base64Data } },
                    { text: "Atue como um motor de OCR financeiro. Extraia as transações para um JSON no formato: { \"rows\": [ { \"date\": \"YYYY-MM-DD\", \"description\": \"string\", \"amount\": number } ] }" }
                ]
            },
            config: { temperature: 0.1 }
        });

        // Acessando .text diretamente conforme as novas regras
        return response.text || "{\"rows\": []}";
    });
};

/**
 * Extração estruturada por exemplo utilizando gemini-3-flash-preview
 */
export const extractStructuredDataByExample = async (rawSnippet: string, userExample: string): Promise<{ rows: any[] }> => {
    return await callWithSimpleRetry(async () => {
        const ai = getAIClient();
        const prompt = `Extraia dados financeiros deste documento seguindo o exemplo fornecido.\nEXEMPLO: ${userExample}\nDOCUMENTO: ${rawSnippet.substring(0, 20000)}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
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
                                    date: { type: Type.STRING, nullable: true },
                                    description: { type: Type.STRING },
                                    amount: { type: Type.NUMBER, nullable: true }
                                },
                                required: ["description"]
                            }
                        }
                    },
                    required: ["rows"]
                }
            }
        });

        const data = response.text ? JSON.parse(response.text) : { rows: [] };
        return data;
    });
};

/**
 * Sugestão de Contribuintes utilizando gemini-3-flash-preview
 */
export const getAISuggestion = async (transaction: Transaction, contributors: Contributor[]): Promise<string> => {
    return await callWithSimpleRetry(async () => {
        const ai = getAIClient();
        const prompt = `Analise: "${transaction.description}". Qual contribuinte melhor se encaixa? Lista: [${contributors.map(c => c.name).join(', ')}]. Responda apenas o nome ou "Nenhuma sugestão clara".`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { temperature: 0.1 }
        });
        
        return response.text ? response.text.trim() : "Nenhuma sugestão clara";
    });
};
