
import { LancamentoItem } from './types';
import { GoogleGenAI, Type } from "@google/genai";

export interface DecisionContext {
    item: LancamentoItem;
    instruction?: string;
    history: any[];
}

export interface DecisionResult {
    caixa: string;
    categoria: string;
    observacao: string;
    confianca: number;
}

export async function decisionEngine(context: DecisionContext): Promise<DecisionResult> {
    const { item, instruction, history } = context;
    const apiKey = process.env.API_KEY;
    
    // 1. ANÁLISE DE HISTÓRICO (Offline/Fast)
    let historySuggestion = { categoria: '', confianca: 0 };
    if (history?.length > 0) {
        const freq: Record<string, number> = {};
        history.forEach(h => { if (h.categoria_escolhida) freq[h.categoria_escolhida] = (freq[h.categoria_escolhida] || 0) + 1; });
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
            historySuggestion = { categoria: sorted[0][0], confianca: Math.min(90, 50 + (sorted[0][1] * 10)) };
        }
    }

    // 2. CONSULTA AO CÉREBRO GEMINI (Inteligência Semântica)
    if (apiKey) {
        try {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `Analise a transação "${item.nome}" de valor ${item.valor}. Instrução: "${instruction || 'Nenhuma'}". Histórico: "${historySuggestion.categoria}". Decida o Caixa e a Categoria.`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    temperature: 0.1,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            caixa: { type: Type.STRING },
                            categoria: { type: Type.STRING },
                            observacao: { type: Type.STRING },
                            confianca: { type: Type.NUMBER }
                        },
                        required: ["caixa", "categoria", "confianca"]
                    }
                }
            });

            const aiRes = response.text ? JSON.parse(response.text) : null;
            if (aiRes) return aiRes;
        } catch (e) {
            console.warn("[DecisionEngine] Falha Gemini:", e);
        }
    }

    return {
        caixa: item.bankName,
        categoria: historySuggestion.categoria || 'Não identificada',
        observacao: historySuggestion.categoria ? 'Baseado no seu histórico.' : 'Nenhum padrão encontrado.',
        confianca: historySuggestion.confianca
    };
}
