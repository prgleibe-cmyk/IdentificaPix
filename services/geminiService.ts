
import { GoogleGenAI, Type } from "@google/genai";

const getAIClient = () => {
    if (!process.env.API_KEY) throw new Error("Chave de API do Gemini não configurada.");
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

let isAIBusy = false;

/**
 * 🛡️ PARSER RESILIENTE (V4 - ULTRA RECOVERY)
 * Recupera o máximo de dados de um JSON truncado pela IA ou rede.
 */
const safeJsonParse = (input: any, fallback: any = []) => {
    if (!input) return fallback;
    let sanitized = String(input).trim();
    
    // Limpeza de Markdown
    sanitized = sanitized.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');

    const tryParse = (str: string) => {
        try {
            const parsed = JSON.parse(str);
            if (parsed.rows) return parsed.rows;
            if (parsed.transactions) return parsed.transactions;
            return Array.isArray(parsed) ? parsed : null;
        } catch { return null; }
    };

    // 1. Tentativa Direta (Standard)
    let result = tryParse(sanitized);
    if (result) return result;

    // 2. Recuperação de Truncamento (Brute-force closing)
    // Buscamos o último fechamento de objeto válido para salvar o que já foi extraído
    let lastBrace = sanitized.lastIndexOf('}');
    
    const possibleClosures = [
        '',           // Apenas o que restou
        ']',          // Se cortou num array
        ']}',         // Se cortou num objeto com array 'rows'
        '"}]}',       // Se cortou dentro de uma string de um objeto num array
        '"}',         // Se cortou dentro de uma string de um objeto
    ];

    while (lastBrace > 0) {
        const base = sanitized.substring(0, lastBrace + 1);
        for (const closure of possibleClosures) {
            const candidate = base + closure;
            result = tryParse(candidate);
            if (result) {
                console.warn("[GeminiService] JSON recuperado via truncamento na posição:", lastBrace);
                return result;
            }
        }
        // Retrocede para o fechamento de objeto anterior
        lastBrace = sanitized.lastIndexOf('}', lastBrace - 1);
    }

    console.error("[GeminiService] Falha total ao recuperar JSON corrompido.");
    return fallback;
};

/**
 * 🎯 MOTOR DE EXTRAÇÃO SEMÂNTICA (MODO PRESERVAÇÃO LITERAL)
 * Upgrade para extração 1:1, proibindo qualquer alteração textual na descrição.
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

        const instruction = `VOCÊ É UM EXECUTOR DE EXTRAÇÃO LITERAL PARA CONCILIAÇÃO BANCÁRIA.
           
           --- CONTRATO DE EXTRAÇÃO (DNA DO DOCUMENTO) ---
           ${modelContext}
           
           --- REGRAS DE OURO DE FIDELIDADE ---
           1. EXTRAÇÃO LITERAL ABSOLUTA: A 'description' deve ser copiada CARACTERE POR CARACTERE do documento visual. 
              - MANTENHA: Espaços originais (inclusive múltiplos espaços), pontuação, símbolos e a capitalização (Maiúsculas/Minúsculas) EXATAMENTE como estão. 
              - PROIBIDO: Normalizar, reescrever, remover termos, corrigir erros de digitação ou 'limpar' o texto original.
           2. DETECÇÃO DE SINAIS: Diferencie Créditos de Débitos. Débitos (saídas) devem SEMPRE ser números negativos no JSON. 
           3. FILTRAGEM DE LINHAS: Ignore headers, rodapés e linhas de saldo do documento. Extraia apenas as transações.
           4. SOBERANIA DO CONTRATO: Use o CONTRATO acima para decidir o que constitui uma transação válida.
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
                maxOutputTokens: 64000, 
                thinkingConfig: { thinkingBudget: 32000 },
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
                    { text: "Extraia cada linha de transação do documento EXATAMENTE como aparece visualmente. Mantenha espaços e capitalização. Retorne array JSON 'rawLines'." }
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
