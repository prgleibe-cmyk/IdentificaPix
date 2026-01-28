
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
 * Realiza o fatiamento semântico inicial do documento sem classificar dados.
 * @frozen-block: STRUCTURAL_DUMP_LIMITER_V1
 * PROIBIDO ALTERAR: Este bloco garante a economia de tokens limitando a análise inicial a 50 chunks.
 */
export const getRawStructuralDump = async (base64Data: string): Promise<any[]> => {
    if (isAIBusy) return [];
    isAIBusy = true;

    try {
        const ai = getAIClient();
        
        const instruction = `VOCÊ É UM ANALISADOR DE CHUNKS. Leia este documento e quebre-o em fragmentos semânticos (blocos de texto que representam registros lógicos). 
        RESTRICAO: Retorne no máximo os primeiros 50 fragmentos encontrados.
        Retorne apenas o array JSON "rawLines".`;

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
 * @frozen-block: EXTRACTION_TOKEN_ECONOMY_V2 (Refatorado para suportar Lista Viva Integral)
 * AJUSTE: O limite de registros e a truncagem de texto agora dependem da presença do parâmetro 'limit'.
 * - Laboratório (Simulation): 'limit' é passado, restringindo o volume.
 * - Lista Viva (Execution): 'limit' é undefined, processando o documento integralmente.
 */
export const extractTransactionsWithModel = async (
    rawText: string, 
    modelContext?: string, 
    base64Data?: string,
    blocks?: string[],
    limit?: number
): Promise<any> => {
    if (isAIBusy) return { rows: [] };
    isAIBusy = true;

    try {
        const ai = getAIClient();
        
        // Identifica se estamos em modo Preview (Simulação) ou Real (Lista Viva)
        const isPreview = !!limit;
        
        const dataSource = blocks && blocks.length > 0 
            ? `FONTE DE DADOS (BLOCOS SEMÂNTICOS PARA PROCESSAR):\n${JSON.stringify(blocks)}`
            : `TEXTO DO DOCUMENTO:\n${isPreview ? rawText.substring(0, 15000) : rawText}`;

        const limitInstruction = isPreview 
            ? `6. RESTRICAO DE VOLUME (MODO PREVIEW): Retorne no máximo os primeiros ${limit} registros encontrados.`
            : `6. PROCESSAMENTO INTEGRAL (MODO PRODUÇÃO): Extraia TODAS as transações válidas encontradas no documento. NÃO se limite aos primeiros registros.`;

        const instruction = `VOCÊ É UM SCANNER DE BLOCOS COM OBEDIÊNCIA CEGA AO CONTRATO.
           
           --- CONTRATO OBRIGATÓRIO (ÚNICA VERDADE ABSOLUTA DO ADMIN) ---
           ${modelContext}
           
           --- TAREFA CRÍTICA E INVIOLÁVEL ---
           1. Use o CONTRATO acima como ÚNICO guia de extração. O Admin definiu este padrão manualmente.
           2. DETECÇÃO DE DÉBITOS: Valores com sufixo "D", "DEBITO" ou destacados em vermelho DEVEM ser convertidos para números NEGATIVOS no campo "amount".
           3. FORMA DE PAGAMENTO: Extraia o campo "paymentMethod" rigorosamente conforme ensinado no contrato.
           4. NÃO TENTE CORRIGIR o Admin. Se o contrato diz para extrair X, extraia X exatamente.
           5. Analise cada fragmento da fonte de dados e aplique a regra do contrato.
           ${limitInstruction}
           
           FORMATO OBRIGATÓRIO: JSON { "rows": [ { "date", "description", "amount", "paymentMethod" } ] }`;

        const parts: any[] = [];
        
        if (base64Data) {
            parts.push({ inlineData: { data: base64Data, mimeType: 'application/pdf' } });
        }
        
        parts.push({ text: dataSource });
        parts.push({ text: instruction });

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', 
            contents: { parts },
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
                                    paymentMethod: { type: Type.STRING }
                                },
                                required: ["date", "description", "amount", "paymentMethod"]
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
 * INFER MAPPING FROM SAMPLE (MODO RESTRITO)
 */
export const inferMappingFromSample = async (sampleText: string): Promise<any> => {
    if (isAIBusy) return null;
    isAIBusy = true;

    try {
        const ai = getAIClient();
        const slicedText = sampleText.substring(0, 3000);
        const prompt = `Identifique apenas a TOPOLOGIA ESTRUTURAL física deste texto. NÃO ADIVINHE nomes de colunas, apenas sugira índices funcionais. TEXTO: ${slicedText}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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
    } finally {
        isAIBusy = false;
    }
};
