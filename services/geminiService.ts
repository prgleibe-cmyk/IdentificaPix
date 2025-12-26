

import { GoogleGenAI, Type } from "@google/genai";
import { Contributor, Transaction } from '../types';


const getAIClient = () => {
    // Tenta obter a chave de todas as formas possíveis para garantir compatibilidade Docker/Coolify
    const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.API_KEY;
    
    if (!apiKey) {
        console.error("CRITICAL: Gemini API Key is missing.");
        throw new Error("Chave de API do Gemini não configurada.");
    }
    return new GoogleGenAI({ apiKey });
};

// Retry simplificado com backoff exponencial
async function callWithSimpleRetry(fn: () => Promise<any>, retries = 3, delay = 4000): Promise<any> {
    try {
        return await fn();
    } catch (error: any) {
        const msg = error?.message?.toLowerCase() || "";
        // Se for erro de cota (429), tenta esperar mais tempo antes de desistir
        if (msg.includes("429") || msg.includes("quota") || msg.includes("limit") || msg.includes("exceeded")) {
            console.warn("Quota exceeded, retrying with longer delay...", delay);
            if (retries > 0) {
                await new Promise(r => setTimeout(r, delay * 2)); // Dobra o tempo de espera
                return callWithSimpleRetry(fn, retries - 1, delay * 2);
            }
            throw error;
        }
        
        if (retries > 0) {
            await new Promise(r => setTimeout(r, delay));
            return callWithSimpleRetry(fn, retries - 1, delay);
        }
        throw error;
    }
};

export const performInitialInference = async (rawRows: string[][]): Promise<any[]> => {
    const ai = getAIClient();
    
    // Otimização: Reduzir payload removendo células vazias
    const optimizedRows = rawRows.map((row, index) => ({ 
        idx: index, 
        d: row.filter(c => c && c.trim().length > 0).join(' | ')
    }));

    const instructions = `
        Atue como um extrator de dados bancários (OCR lógico).
        Entrada: { idx: indice_original, d: linha_concatenada }
        Saída: Array JSON com objetos contendo: date (DD/MM/AAAA), name (Descrição limpa), amount (decimal string), originalIndex.
        Regras:
        1. Ignore linhas de cabeçalho, saldo ou totais.
        2. Converta datas para DD/MM/AAAA.
        3. Converta valores para string numérica padrão americano (ex: "1250.50"). Saídas devem ser negativas.
    `;

    return callWithSimpleRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash', 
            contents: `Processar este lote CSV: ${JSON.stringify(optimizedRows)}`, // Conteúdo como string
            config: {
                systemInstruction: instructions,
                temperature: 0.1,
                responseMimeType: "application/json",
                responseSchema: { // Schema correto para transações
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            date: { type: Type.STRING },
                            name: { type: Type.STRING },
                            amount: { type: Type.STRING },
                            originalIndex: { type: Type.INTEGER }
                        },
                        required: ["date", "name", "amount", "originalIndex"]
                    }
                }
            }
        });
        return response.text ? JSON.parse(response.text) : [];
    });
};

export const learnAndTransformFile = async (
    rawRows: string[][],
    manualCorrections: Array<{ originalRow: string[], corrected: { date: string, name: string, amount: string } }>
): Promise<any[]> => {
    const ai = getAIClient();
    
    const optimizedRows = rawRows.map((row, index) => ({ 
        idx: index, 
        d: row.join('|') 
    }));

    const examples = manualCorrections.map(ex => 
        `Exemplo de Aprendizado -> Entrada: "${ex.originalRow.join('|')}" | Saída Esperada: D=${ex.corrected.date}, N=${ex.corrected.name}, V=${ex.corrected.amount}`
    ).join('\n');

    const instructions = `
        Você é um motor de inferência de padrões. Analise os exemplos fornecidos e aplique a MESMA lógica de extração para as novas linhas.
        ${examples}
        Retorne um JSON Array.
    `;

    return callWithSimpleRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash', // Modelo estável
            contents: `Aplicar padrão aprendido nestas linhas: ${JSON.stringify(optimizedRows)}`, // Conteúdo como string
            config: {
                systemInstruction: instructions,
                temperature: 0,
                responseMimeType: "application/json",
                responseSchema: { // Schema correto para transações
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            date: { type: Type.STRING },
                            name: { type: Type.STRING },
                            amount: { type: Type.STRING },
                            originalIndex: { type: Type.INTEGER }
                        },
                        required: ["date", "name", "amount", "originalIndex"]
                    }
                }
            }
        });
        return response.text ? JSON.parse(response.text) : [];
    });
};

export const getAISuggestion = async (
  transaction: Transaction,
  contributors: Contributor[]
): Promise<string> => {
  return "Consulte o suporte.";
};