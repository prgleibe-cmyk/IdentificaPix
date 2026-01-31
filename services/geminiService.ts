import { GoogleGenAI, Type } from "@google/genai";

const getAIClient = () => {
    if (!process.env.API_KEY) throw new Error("Chave de API do Gemini não configurada.");
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

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
        console.error("[GeminiService] Erro ao parsear JSON:", e);
        return fallback;
    }
};

/**
 * 🎯 MOTOR DE EXTRAÇÃO SEMÂNTICA (MODO AUDITORIA)
 * Upgrade para raciocínio profundo (Thinking v3).
 */
export const extractTransactionsWithModel = async (
    rawText: string, 
    modelContext?: string, 
    base64Data?: string,
    limit?: number
): Promise<any> => {
    if (isAIBusy) return { rows: [] };
    isAIBusy = true;

    try {
        const ai = getAIClient();
        
        const isPreview = !!limit;
        const limitInstruction = isPreview 
            ? `RESTRICAO: Apenas os primeiros ${limit} registros.`
            : `PROCESSAMENTO TOTAL: Extraia todos os dados sem exceção.`;

        const instruction = `VOCÊ É UM AUDITOR FINANCEIRO DE ELITE COM FOCO EM CONCILIAÇÃO BANCÁRIA.
           
           --- CONTRATO DE EXTRAÇÃO (DNA DO DOCUMENTO) ---
           ${modelContext}
           
           --- REGRAS DE OURO DE AUDITORIA ---
           1. MÁXIMA REFLEXÃO: Antes de extrair, analise a estrutura visual do PDF/Texto. Identifique onde estão colunas de Data, Histórico e Valor.
           2. DETECÇÃO DE SINAIS: Diferencie Créditos de Débitos. Débitos (saídas) devem SEMPRE ser números negativos no JSON. 
           3. LIMPEZA DE RUÍDO: Ignore headers, rodapés e linhas de saldo.
           4. FIDELIDADE AO ADMIN: Use o CONTRATO acima para decidir o que é uma transação válida.
           ${limitInstruction}
           
           RETORNO: JSON { "rows": [ { "date", "description", "amount", "forma", "tipo" } ] }`;

        const parts: any[] = [];
        if (base64Data) {
            parts.push({ inlineData: { data: base64Data, mimeType: 'application/pdf' } });
        } else {
            parts.push({ text: `CONTEÚDO BRUTO:\n${isPreview ? rawText.substring(0, 15000) : rawText}` });
        }
        parts.push({ text: instruction });

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', 
            contents: { parts },
            config: {
                temperature: 0,
                // UPGRADE: Máximo poder de raciocínio disponível para evitar erros em documentos densos
                thinkingConfig: { thinkingBudget: 32768 },
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
                                    forma: { type: Type.STRING },
                                    tipo: { type: Type.STRING }
                                },
                                required: ["date", "description", "amount", "forma", "tipo"]
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

export const getRawStructuralDump = async (base64Data: string): Promise<any[]> => {
    if (isAIBusy) return [];
    isAIBusy = true;
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
                    { text: "Identifique blocos de transações. Retorne array JSON 'rawLines'." }
                ]
            },
            config: {
                temperature: 0,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        rawLines: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            }
        });
        const result = JSON.parse(response.text || '{"rawLines": []}');
        return result.rawLines || [];
    } finally {
        isAIBusy = false;
    }
};

export const inferMappingFromSample = async (sampleText: string): Promise<any> => {
    if (isAIBusy) return null;
    isAIBusy = true;
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analise o padrão de colunas deste texto: ${sampleText.substring(0, 3000)}`,
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
                    }
                }
            }
        });
        return JSON.parse(response.text || "{}");
    } finally {
        isAIBusy = false;
    }
};