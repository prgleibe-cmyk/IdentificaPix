import { GoogleGenAI, Type } from "@google/genai";
import { Contributor, Transaction } from '../types';
import { Logger } from "./monitoringService";

const getAIClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("CRITICAL: Gemini API Key is missing.");
        throw new Error("Chave de API do Gemini não configurada.");
    }
    return new GoogleGenAI({ apiKey });
};

/**
 * 🛡️ JSON SHIELD (V8): Sanitiza, repara e valida a saída da IA.
 * Capaz de recuperar JSONs truncados e tratar diferentes formatos de resposta do SDK.
 */
const safeJsonParse = (input: any, fallback: any = []) => {
    if (!input) return fallback;
    
    // Se o SDK já retornou um objeto (via responseSchema), usa direto
    if (typeof input === 'object' && !Array.isArray(input)) {
        return input.rows || input.transactions || input;
    }

    let sanitized = String(input).trim();
    
    // 1. Limpeza de Markdown
    sanitized = sanitized.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');

    // 2. TENTATIVA DE REPARO DE TRUNCAMENTO (Algoritmo de Fechamento)
    try {
        return JSON.parse(sanitized);
    } catch (e) {
        console.warn("[IA:REPAIR] JSON quebrado detectado. Iniciando auto-reparo...");
        
        let repaired = sanitized;
        // Fecha aspas abertas se terminar em caractere alfanumérico
        if ((repaired.match(/"/g) || []).length % 2 !== 0) repaired += '"';
        // Fecha estruturas básicas na ordem inversa
        if (!repaired.endsWith(']') && repaired.startsWith('[')) repaired += ']';
        if (!repaired.endsWith('}') && repaired.startsWith('{')) repaired += '}';
        
        try {
            return JSON.parse(repaired);
        } catch (inner) {
            // Se o reparo estrutural falhar, tenta extrair o que for possível via Regex
            Logger.error("IA enviou JSON irreparável. Verifique limites de token.", { raw: sanitized.substring(0, 200) });
            return fallback;
        }
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

export const extractTransactionsFromComplexBlock = async (rawText: string): Promise<any[]> => {
    console.log("[IA:EXECUTE] Extraindo bloco...");
    return await callWithSimpleRetry(async () => {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Extraia transações deste extrato. Retorne APENAS o JSON Array. 
            IMPORTANTE: Identifique valores negativos baseando-se no contexto contábil (saídas, débitos, pagamentos, ou valores entre parênteses), mesmo que o sinal de menos '-' não esteja explícito no texto bruto. Se uma linha representa uma saída de dinheiro, o valor deve ser negativo.\n\n${rawText.substring(0, 10000)}`,
            config: {
                temperature: 0,
                responseMimeType: "application/json"
            }
        });
        return safeJsonParse(response.text, []);
    });
};

export const extractStructuredDataByExample = async (rawText: string, instruction: string): Promise<any> => {
    console.log("[IA:LEARN] Aprendendo novo padrão...");
    return await callWithSimpleRetry(async () => {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Você é um especialista em análise de extratos bancários. ${instruction}
            
            REGRA CRÍTICA DE NEGÓCIO: Identifique valores negativos mesmo na ausência do sinal de menos (-) explícito. Considere o contexto da transação (ex: Termos como 'DÉBITO', 'SAÍDA', 'PAGAMENTO', 'TARIFA' ou valores que no documento original estavam em vermelho/parênteses). Se o exemplo do usuário indica um valor como negativo, aplique essa lógica para todas as transações similares.
            
            TEXTO PARA ANÁLISE:
            ${rawText.substring(0, 8000)}`,
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
                                }
                            }
                        }
                    }
                }
            }
        });
        // Aqui o Gemini 3 já retorna o texto no formato JSON válido baseado no Schema
        return safeJsonParse(response.text, { rows: [] });
    });
};

export const inferMappingFromSample = async (sampleText: string): Promise<any> => {
    return await callWithSimpleRetry(async () => {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analise as colunas deste arquivo e retorne os índices (0-based). Considere que algumas colunas de valor podem conter saídas (negativos) sem sinal explícito. JSON Format:\n\n${sampleText.substring(0, 4000)}`,
            config: { 
                temperature: 0, 
                responseMimeType: "application/json"
            }
        });
        return safeJsonParse(response.text, null);
    });
};

export const getAISuggestion = async (transaction: Transaction, contributors: Contributor[]): Promise<string> => {
    return await callWithSimpleRetry(async () => {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Dada a transação "${transaction.description}", qual contribuinte melhor se encaixa? Lista: [${contributors.map(c => c.name).join(', ')}]. Responda apenas o nome.`,
            config: { temperature: 0.1 }
        });
        return response.text?.trim() || "Nenhuma sugestão";
    });
};