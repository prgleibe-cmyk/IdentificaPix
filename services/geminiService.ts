
import { GoogleGenAI, Type } from "@google/genai";

const getAIClient = () => {
    if (!process.env.API_KEY) throw new Error("Chave de API do Gemini não configurada.");
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Trava Global de Processamento para evitar chamadas duplicadas/concorrentes
let isAIBusy = false;

const safeJsonParse = (input: any, fallback: any = []) => {
    if (!input) return fallback;
    let sanitized = String(input).trim();
    sanitized = sanitized.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');

    try {
        const parsed = JSON.parse(sanitized);
        if (parsed.rows) return parsed.rows;
        if (parsed.transactions) return parsed.transactions;
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
        console.error("[GeminiService] Erro ao parsear JSON da IA:", e, sanitized);
        return fallback;
    }
};

/**
 * 🛠️ DUMP ESTRUTURAL (MODO LABORATÓRIO)
 * Realiza o fatiamento semântico inicial do documento.
 */
export const getRawStructuralDump = async (base64Data: string): Promise<any[]> => {
    if (isAIBusy) return [];
    isAIBusy = true;

    try {
        const ai = getAIClient();
        const instruction = `VOCÊ É UM ANALISADOR DE CHUNKS. Leia este documento e quebre-o em fragmentos semânticos (blocos de texto que representam linhas ou registros lógicos). Retorne um array JSON "rawLines".`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
                    { text: instruction }
                ]
            },
            config: {
                temperature: 0,
                maxOutputTokens: 2000,
                thinkingConfig: { thinkingBudget: 0 },
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        rawLines: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["rawLines"]
                }
            }
        });

        const result = JSON.parse(response.text || '{"rawLines": []}');
        return result.rawLines || [];
    } finally {
        isAIBusy = false;
    }
};

/**
 * 🎯 MOTOR DE EXTRAÇÃO SEMÂNTICA (MODO BLOCO)
 * Consome os blocos identificados e aplica o contrato aprendido em todo o conjunto.
 */
export const extractTransactionsWithModel = async (
    rawText: string, 
    modelContext?: string, 
    base64Data?: string,
    blocks?: string[]
): Promise<any> => {
    if (isAIBusy) return { rows: [] };
    isAIBusy = true;

    try {
        const ai = getAIClient();
        
        const dataSource = blocks && blocks.length > 0 
            ? `FONTE DE DADOS (BLOCOS SEMÂNTICOS PARA PROCESSAR):\n${JSON.stringify(blocks)}`
            : `TEXTO DO DOCUMENTO:\n${rawText.substring(0, 10000)}`;

        const instruction = `VOCÊ É UM SCANNER DE BLOCOS SEMÂNTICOS COM APRENDIZADO REFORÇADO.
           
           --- CONTRATO DE EXTRAÇÃO OBRIGATÓRIO (GABARITO) ---
           ${modelContext}
           
           --- TAREFA CRÍTICA ---
           1. Use o CONTRATO acima como único guia de estrutura. 
           2. O usuário corrigiu uma linha para te ensinar que, naquele padrão visual, os dados corretos são os que ele definiu.
           3. Analise cada fragmento da fonte de dados e extraia transações que sigam EXATAMENTE a lógica do contrato.
           4. Se o contrato mostra uma limpeza de nome específica (ex: remover "PIX RECEB" e manter o nome da pessoa), você DEVE replicar isso para todas as outras linhas.
           
           FORMATO OBRIGATÓRIO: JSON { "rows": [ { "date", "description", "amount" } ] }`;

        const contents: any = { parts: [] };
        
        if (base64Data) {
            contents.parts.push({ inlineData: { data: base64Data, mimeType: 'application/pdf' } });
        }
        
        contents.parts.push({ text: dataSource });
        contents.parts.push({ text: instruction });

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', // Upgrade para Pro durante refinamento para maior precisão lógica
            contents: contents,
            config: {
                temperature: 0,
                maxOutputTokens: 4000,
                thinkingConfig: { thinkingBudget: 0 },
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
    } finally {
        isAIBusy = false;
    }
};

/**
 * INFRE MAPPING FROM SAMPLE
 */
export const inferMappingFromSample = async (sampleText: string): Promise<any> => {
    if (isAIBusy) return null;
    isAIBusy = true;

    try {
        const ai = getAIClient();
        const slicedText = sampleText.substring(0, 3000);
        const prompt = `Analise a estrutura física deste documento financeiro. TEXTO: ${slicedText}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
                temperature: 0, 
                maxOutputTokens: 500,
                thinkingConfig: { thinkingBudget: 0 },
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
    } finally {
        isAIBusy = false;
    }
};
