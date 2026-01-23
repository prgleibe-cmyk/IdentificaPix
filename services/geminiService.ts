
import { GoogleGenAI, Type } from "@google/genai";
import { Contributor, Transaction } from '../types';
import { Logger } from "./monitoringService";

const getAIClient = () => {
    if (!process.env.API_KEY) {
        console.error("CRITICAL: Gemini API Key is missing.");
        throw new Error("Chave de API do Gemini não configurada.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * 🛡️ JSON SHIELD (V12): Sanitiza, repara e valida a saída da IA.
 */
const safeJsonParse = (input: any, fallback: any = []) => {
    if (!input) return fallback;
    if (typeof input === 'object' && !Array.isArray(input)) {
        return input.rows || input.transactions || input;
    }

    let sanitized = String(input).trim();
    sanitized = sanitized.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');

    try {
        const parsed = JSON.parse(sanitized);
        return parsed.rows || parsed.transactions || parsed;
    } catch (e) {
        console.warn("[IA:REPAIR] Tentando reparar JSON...");
        if (sanitized.includes('"rows": [')) {
            let repaired = sanitized;
            if (!repaired.endsWith(']')) repaired += ']';
            if (!repaired.endsWith('}')) repaired += '}';
            try { return JSON.parse(repaired).rows; } catch (inner) {}
        }
        return fallback;
    }
};

async function callWithSimpleRetry(fn: () => Promise<any>, retries = 2): Promise<any> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0) {
            console.log(`[IA:RETRY] Falha na chamada, tentando novamente... (${retries} restantes)`);
            await new Promise(r => setTimeout(r, 2000));
            return callWithSimpleRetry(fn, retries - 1);
        }
        throw error;
    }
};

export const extractTransactionsWithModel = async (rawText: string, modelContext?: string): Promise<any> => {
    return await callWithSimpleRetry(async () => {
        const ai = getAIClient();
        
        const referencePrompt = modelContext 
            ? `USE ESTE APRENDIZADO COMO GABARITO ESTRUTURAL E DE LIMPEZA:
               --- INÍCIO DO GABARITO ---
               ${modelContext}
               --- FIM DO GABARITO ---
               
               OBSERVAÇÃO IMPORTANTE: 
               1. Uma transação pode estar dividida em várias linhas consecutivas.
               2. REGRA DE NEGATIVIDADE: Valores que no original aparecem em VERMELHO, ou que representam saídas, pagamentos, débitos ou transferências enviadas, DEVEM ser retornados como números NEGATIVOS (ex: -150.00), mesmo que o caractere "-" não esteja presente no texto.`
            : "Extraia transações deste extrato bancário. IMPORTANTE: Valores de saídas/débitos devem ser NEGATIVOS.";

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `${referencePrompt}
            
            TEXTO PARA PROCESSAR:
            ${rawText.substring(0, 18000)}`,
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
                                    amount: { type: Type.NUMBER, description: "Valor da transação. Negativo para saídas/vermelhos, positivo para entradas." },
                                    type: { type: Type.STRING },
                                    paymentMethod: { type: Type.STRING }
                                },
                                required: ["date", "description", "amount"]
                            }
                        }
                    }
                }
            }
        });
        
        return safeJsonParse(response.text, { rows: [] });
    });
};

export const extractTransactionsFromComplexBlock = async (rawText: string): Promise<any> => {
    return await callWithSimpleRetry(async () => {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Analise o texto e extraia todas as transações financeiras. 
            MUITO IMPORTANTE: 
            1. Note que em extratos como do Sicoob, a transação começa em uma linha com data e valor, mas o nome do pagador está abaixo. Agrupe-os.
            2. REGRA DE OURO: Valores que representam saídas (Pagamentos, TED Enviada, Pix Enviado, Débitos) ou que estariam em VERMELHO no papel, devem ser obrigatoriamente NEGATIVOS no seu retorno numérico.
            
            TEXTO:
            ${rawText.substring(0, 18000)}`,
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
                                    amount: { type: Type.NUMBER, description: "Número real. Saídas DEVEM ser negativas." },
                                    type: { type: Type.STRING },
                                    paymentMethod: { type: Type.STRING }
                                },
                                required: ["date", "description", "amount"]
                            }
                        }
                    }
                }
            }
        });
        
        return safeJsonParse(response.text, { rows: [] });
    });
};

export const extractStructuredDataByExample = async (rawText: string, instruction: string): Promise<any> => {
    return await callWithSimpleRetry(async () => {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Você é um motor de IA ultra-inteligente especializado em aprender padrões de transformação de dados.
            O usuário forneceu um exemplo de como uma linha bruta deve ser limpa e estruturada.
            
            SUA TAREFA:
            1. Analise o exemplo do usuário e entenda a 'Função de Transformação'.
            2. REGRA CRÍTICA: Se o contexto da linha indicar uma saída/despesa (ou cor vermelha no documento implícita), converta o valor para NEGATIVO.
            
            ${instruction}

            TEXTO COMPLETO PARA PROCESSAR (SNIPPET):
            ${rawText.substring(0, 15000)}`,
            config: {
                temperature: 0,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        inferredMapping: {
                            type: Type.OBJECT,
                            properties: {
                                dateColumnIndex: { type: Type.NUMBER },
                                descriptionColumnIndex: { type: Type.NUMBER },
                                amountColumnIndex: { type: Type.NUMBER },
                                typeColumnIndex: { type: Type.NUMBER },
                                paymentMethodColumnIndex: { type: Type.NUMBER },
                                transformationRegex: { type: Type.STRING, description: "Regex ou regra lógica deduzida para limpar o nome" }
                            }
                        },
                        rows: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    date: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    amount: { type: Type.NUMBER, description: "Valores negativos para saídas." },
                                    type: { type: Type.STRING },
                                    paymentMethod: { type: Type.STRING }
                                },
                                required: ["date", "description", "amount"]
                            }
                        }
                    }
                }
            }
        });
        return safeJsonParse(response.text, { rows: [] });
    });
};

export const inferMappingFromSample = async (sampleText: string): Promise<any> => {
    return await callWithSimpleRetry(async () => {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Analise as colunas e o formato visual. Detecte se é um extrato de colunas fixas ou blocos multi-linha.
            Identifique também qual coluna ou padrão indica saídas (negativos/vermelhos).
            
            AMOSTRA:
            ${sampleText.substring(0, 5000)}`,
            config: { 
                temperature: 0, 
                responseMimeType: "application/json"
            }
        });
        return safeJsonParse(response.text, null);
    });
};
