
import { GoogleGenAI, Type } from "@google/genai";
import { Contributor, Transaction } from '../types';
import { Logger, Metrics } from './monitoringService';

const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Revertendo retry complexo no serviço para permitir que a UI controle o "Backpressure" visualmente
async function callWithSimpleRetry(fn: () => Promise<any>, retries = 3, delay = 2000): Promise<any> {
    try {
        return await fn();
    } catch (error: any) {
        // Se for erro de cota, repassa imediatamente para a UI tratar com a pausa visual
        const msg = error?.message?.toLowerCase() || "";
        if (msg.includes("429") || msg.includes("quota") || msg.includes("limit") || msg.includes("exceeded")) {
            throw error; 
        }
        
        // Se for outro erro (network, etc), tenta mais algumas vezes
        if (retries > 0) {
            await new Promise(r => setTimeout(r, delay));
            return callWithSimpleRetry(fn, retries - 1, delay * 2);
        }
        throw error;
    }
}

export const performInitialInference = async (rawRows: string[][]): Promise<any[]> => {
    const ai = getAIClient();
    // Otimização de Payload: Enviar apenas colunas não-vazias para economizar tokens
    const optimizedRows = rawRows.map((row, index) => ({ 
        idx: index, 
        d: row.filter(c => c && c.trim().length > 0).join(' | ') // Join para reduzir JSON overhead
    }));

    const instructions = `
        EXTRATOR FINANCEIRO. JSON Array.
        Entrada: { idx: number, d: string (colunas unidas por |) }
        Saída: { date: "DD/MM/AAAA", name: "Texto Limpo", amount: "0.00", originalIndex: number }
        
        REGRAS:
        1. Ignore saldos/totais.
        2. Valor negativo para saídas.
    `;

    return callWithSimpleRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // OTIMIZAÇÃO: Modelo Standard Flash para contas pagas
            contents: `Processar: ${JSON.stringify(optimizedRows)}`,
            config: {
                systemInstruction: instructions,
                temperature: 0.1,
                responseMimeType: "application/json",
                responseSchema: {
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
    
    // Otimização de Payload
    const optimizedRows = rawRows.map((row, index) => ({ 
        idx: index, 
        d: row.join('|') 
    }));

    const examples = manualCorrections.map(ex => 
        `Ex: "${ex.originalRow.join('|')}" -> D:${ex.corrected.date}, N:${ex.corrected.name}, V:${ex.corrected.amount}`
    ).join('\n');

    const instructions = `
        APRENDA O PADRÃO E APLIQUE.
        Entrada: { idx, d }
        ${examples}
    `;

    return callWithSimpleRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // OTIMIZAÇÃO: Modelo Standard Flash
            contents: `Aplicar padrão: ${JSON.stringify(optimizedRows)}`,
            config: {
                systemInstruction: instructions,
                temperature: 0,
                responseMimeType: "application/json",
                responseSchema: {
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
