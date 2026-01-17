
import { LancamentoItem, SugestaoLancamento } from './types';
import { GoogleGenAI, Type } from "@google/genai";

export interface DecisionContext {
    item: LancamentoItem;
    instruction?: string;
    history: any[];
    bankMemory?: any;
}

export interface DecisionResult {
    caixa: string;
    categoria: string;
    observacao: string;
    confianca: number;
}

/**
 * MOTOR DE DECISÃO DETERMINÍSTICO E SEMÂNTICO (DecisionEngine v1)
 * Centraliza a inteligência para propor destinos de lançamentos.
 */
export async function decisionEngine(context: DecisionContext): Promise<DecisionResult> {
    const { item, instruction, history } = context;
    
    // 1. ANÁLISE DE HISTÓRICO (Memória de Curto/Médio Prazo)
    let historySuggestion = { categoria: '', confianca: 0 };
    if (history && history.length > 0) {
        const freq: Record<string, number> = {};
        history.forEach(h => {
            if (h.categoria_escolhida) {
                freq[h.categoria_escolhida] = (freq[h.categoria_escolhida] || 0) + 1;
            }
        });
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
            historySuggestion = {
                categoria: sorted[0][0],
                confianca: Math.min(90, 50 + (sorted[0][1] * 10))
            };
        }
    }

    // 2. CONSULTA AO TUTOR IA (Regras Semânticas Dinâmicas)
    if (instruction && instruction.trim() && process.env.API_KEY) {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
            Aja como um contador especialista. Analise a transação abaixo e decida o destino com base na Instrução do Usuário.
            
            TRANSAÇÃO: "${item.nome}"
            VALOR: ${item.valor}
            BANCO: ${item.bankName}
            
            INSTRUÇÃO DO USUÁRIO: "${instruction}"
            
            SUGESTÃO DO HISTÓRICO: "${historySuggestion.categoria}" (Confiança: ${historySuggestion.confianca}%)

            REGRAS:
            1. Se a instrução do usuário for clara para este caso, ela tem prioridade total.
            2. Se a instrução for genérica, use o histórico como apoio.
            3. Identifique o "Caixa/Conta" (origem) e a "Categoria/Igreja" (destino).
            `;

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
            console.warn("[DecisionEngine] Falha na chamada da IA, usando fallback de histórico.");
        }
    }

    // 3. FALLBACK (Histórico Puro)
    return {
        caixa: item.bankName,
        categoria: historySuggestion.categoria || 'Não identificada',
        observacao: historySuggestion.categoria ? 'Baseado no seu histórico de lançamentos.' : 'Nenhum padrão encontrado.',
        confianca: historySuggestion.confianca
    };
}
