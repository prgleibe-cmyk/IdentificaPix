
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
 * Fatiado para enviar apenas os primeiros 4000 caracteres para identificação de padrão.
 */
export const getRawStructuralDump = async (base64Data: string): Promise<any[]> => {
    if (isAIBusy) return [];
    isAIBusy = true;

    try {
        const ai = getAIClient();
        const instruction = `TRANSCRITOR LITERAL. Liste fragmentos de texto do documento num array JSON "rawLines". Sem colunas, sem interpretação.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Flash para tarefas simples de dump
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
                    { text: instruction }
                ]
            },
            config: {
                temperature: 0,
                maxOutputTokens: 1000,
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
 * INFRE MAPPING FROM SAMPLE
 * Limita a amostra de texto para economizar tokens.
 */
export const inferMappingFromSample = async (sampleText: string): Promise<any> => {
    if (isAIBusy) return null;
    isAIBusy = true;

    try {
        const ai = getAIClient();
        // Fatiamento: Envia apenas os primeiros 3000 caracteres para análise de estrutura
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

/**
 * 🎯 MOTOR DE EXTRAÇÃO RÍGIDO (Fidelidade Cega ao Contrato)
 * Implementa fatiamento de texto e limites estritos de saída.
 */
export const extractTransactionsWithModel = async (rawText: string, modelContext?: string, base64Data?: string): Promise<any> => {
    if (isAIBusy) return { rows: [] };
    isAIBusy = true;

    try {
        const ai = getAIClient();
        
        const instruction = `VOCÊ É UM ALGORITMO DE BUSCA DE PADRÕES. PROIBIDO SER INTELIGENTE.
           SUA ÚNICA TAREFA: Varrer o documento e encontrar TODAS as ocorrências que sigam EXATAMENTE este contrato:
           --- CONTRATO APRENDIDO ---
           ${modelContext}
           --------------------------
           FORMATO OBRIGATÓRIO: JSON com chave "rows" contendo array de {date, description, amount}.`;

        const contents: any = { parts: [] };
        
        if (base64Data) {
            // No modo visão (PDF/Img), o Gemini processa o contexto visual de uma vez, 
            // mas limitamos a saída para evitar tokens fantasmas.
            contents.parts.push({ inlineData: { data: base64Data, mimeType: 'application/pdf' } });
        } else if (rawText && rawText !== '[DOCUMENTO_VISUAL]' && rawText !== '[DOCUMENTO_PDF_VISUAL]') {
            // Fatiamento: Se o texto for muito grande, pegamos apenas um bloco processável (aprox 8000 chars por chamada)
            const slicedText = rawText.substring(0, 8000);
            contents.parts.push({ text: `TEXTO DO DOCUMENTO (BLOCO):\n${slicedText}` });
        }
        
        contents.parts.push({ text: instruction });

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Flash é 10x mais barato e rápido para extração padrão
            contents: contents,
            config: {
                temperature: 0,
                maxOutputTokens: 2000, // Teto controlado para o array JSON
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
