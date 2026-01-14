import { GoogleGenAI, Type } from "@google/genai";
import { Contributor, Transaction } from '../types';
import { Logger } from "./monitoringService";


const getAIClient = () => {
    // Tenta obter a chave de todas as formas possíveis para garantir compatibilidade Docker/Coolify
    const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.API_KEY;
    
    if (!apiKey) {
        console.error("CRITICAL: Gemini API Key is missing.");
        throw new Error("Chave de API do Gemini não configurada.");
    }
    return new GoogleGenAI({ apiKey });
};

// Retry simplificado com backoff exponencial e tratamento de chave
async function callWithSimpleRetry(fn: () => Promise<any>, retries = 3, delay = 4000): Promise<any> {
    try {
        return await fn();
    } catch (error: any) {
        const msg = error?.message?.toLowerCase() || "";
        const status = error?.status || error?.error?.code;

        // Handle Project IDX / AI Studio specific 404 (Key/Project not selected or invalid)
        if (msg.includes("requested entity was not found") || status === 404 || status === "NOT_FOUND") {
             // Se já esgotamos as tentativas, lança o erro para não travar a tela em loop
             if (retries <= 0) throw error;

             console.warn("API Entity not found (404). Triggering key selection...");
             if (typeof window !== 'undefined' && (window as any).aistudio) {
                 try {
                     await (window as any).aistudio.openSelectKey();
                     // IMPORTANTE: Decrementar retries para evitar loop infinito se a chave continuar falhando
                     return callWithSimpleRetry(fn, retries - 1, delay); 
                 } catch (e) {
                     console.error("Failed to open key selector", e);
                     throw error;
                 }
             }
        }

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

/**
 * FEATURE ATIVA: Leitura Inteligente de Documentos (OCR Semântico)
 * Utiliza o Gemini Vision para extrair texto de imagens ou PDFs escaneados.
 * FORÇADO: Retorno JSON Estruturado.
 */
export const extractDataFromVisual = async (file: File): Promise<string> => {
    try {
        const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                // Remove prefixo data:image/png;base64, se existir
                const base64 = result.split(',')[1]; 
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        return await callWithSimpleRetry(async () => {
            const ai = getAIClient();
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image', // Modelo otimizado para visão
                contents: {
                    parts: [
                        {
                            inlineData: {
                                mimeType: file.type,
                                data: base64Data
                            }
                        },
                        {
                            text: `
                            Atue como um motor de OCR financeiro de alta precisão.
                            Analise este documento visualmente e extraia as transações financeiras.
                            
                            REGRAS ESTRITAS DE SAÍDA (CONTRATO JSON):
                            Você deve retornar EXCLUSIVAMENTE um JSON com o seguinte formato:
                            {
                              "rows": [
                                {
                                  "date": "YYYY-MM-DD",
                                  "description": "Texto completo da descrição",
                                  "amount": 123.45 (number, negativo para saídas),
                                  "reference": "Texto auxiliar se houver"
                                }
                              ]
                            }

                            REGRAS DE EXTRAÇÃO:
                            1. Converta datas para YYYY-MM-DD.
                            2. Converta valores para number (float). Use sinal negativo para débitos/saídas.
                            3. Capture a descrição completa.
                            4. NÃO invente dados. Se não houver transações, retorne { "rows": [] }.
                            5. NÃO adicione markdown, \`\`\`json ou explicações. Apenas o JSON cru.
                            `
                        }
                    ]
                },
                config: {
                    temperature: 0.1, // Baixa criatividade, alta fidelidade
                }
            });

            const text = response.text || "";
            // Limpeza básica caso o modelo ainda mande markdown
            return text.replace(/```json/g, '').replace(/```/g, '').trim();
        });

    } catch (error) {
        Logger.error("Erro na leitura visual Gemini:", error);
        throw new Error("Não foi possível interpretar o documento visualmente.");
    }
};

/**
 * FEATURE ATIVA: Extração Estruturada por Exemplo (Strict Mode)
 * Substitui a inferência de colunas por extração direta baseada em exemplo.
 */
export const extractStructuredDataByExample = async (
    rawSnippet: string, 
    userExample: string
): Promise<{ rows: any[] }> => {
    try {
        const ai = getAIClient();
        
        const prompt = `
        Você é um extrator de dados financeiros STRICT MODE.
        
        CONTEXTO:
        O documento bruto (PDF/OCR/TEXTO/PLANILHA) está abaixo em "SOURCE_DOCUMENT".
        As linhas editadas pelo usuário estão em "MODEL_EXAMPLES".
        
        REGRA EXPLÍCITA:
        MODEL_EXAMPLES não representam os dados finais.
        Eles definem APENAS o formato e as regras.
        Aplique este padrão a TODO o SOURCE_DOCUMENT, sem exceções.
        
        MODEL_EXAMPLES (O Padrão a Seguir):
        "${userExample}"

        SOURCE_DOCUMENT (Os Dados a Processar):
        ---
        ${rawSnippet.substring(0, 30000)}
        ---

        REGRAS DE EXECUÇÃO:
        1. Percorra TODO o conteúdo do SOURCE_DOCUMENT.
        2. Localize padrões semelhantes ao MODEL_EXAMPLES no SOURCE_DOCUMENT.
        3. Ignore cabeçalhos, rodapés ou linhas de saldo que não sigam o padrão de transação do exemplo.
        4. Formate datas para YYYY-MM-DD.
        5. Converta valores para float (negativo para saídas).
        6. Nenhuma linha válida pode ser descartada.
        
        CONTRATO DE SAÍDA (OBRIGATÓRIO):
        Retorne EXCLUSIVAMENTE este JSON:
        {
          "rows": [
            {
              "date": "YYYY-MM-DD" | null,
              "description": string,
              "amount": number | null,
              "reference": string | null
            }
          ]
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
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
                                    date: { type: Type.STRING, nullable: true },
                                    description: { type: Type.STRING },
                                    amount: { type: Type.NUMBER, nullable: true },
                                    reference: { type: Type.STRING, nullable: true }
                                },
                                required: ["description"]
                            }
                        }
                    },
                    required: ["rows"]
                }
            }
        });

        const data = response.text ? JSON.parse(response.text) : { rows: [] };
        return data;

    } catch (error) {
        console.error("Erro na extração estruturada:", error);
        throw new Error("Não foi possível extrair dados com base no exemplo.");
    }
};

/**
 * MANTIDO PARA RETROCOMPATIBILIDADE (Mas não usado no fluxo de ensino novo)
 * Inferência de mapeamento de colunas.
 */
export const inferMappingFromExample = async (
    rawSnippet: string, 
    userExample: string
): Promise<{
    dateColumnIndex: number;
    descriptionColumnIndex: number;
    amountColumnIndex: number;
    typeColumnIndex?: number;
    skipRowsStart: number;
}> => {
    try {
        const ai = getAIClient();
        // ... (Lógica antiga mantida se necessária para outros fluxos)
        const prompt = `
        Analise o snippet e o exemplo para deduzir índices de colunas (0-based).
        Snippet: ${rawSnippet.substring(0, 1000)}
        Exemplo: ${userExample}
        Retorne JSON: { dateColumnIndex, descriptionColumnIndex, amountColumnIndex, skipRowsStart }
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                temperature: 0,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        dateColumnIndex: { type: Type.INTEGER },
                        descriptionColumnIndex: { type: Type.INTEGER },
                        amountColumnIndex: { type: Type.INTEGER },
                        skipRowsStart: { type: Type.INTEGER },
                    }
                }
            }
        });
        return response.text ? JSON.parse(response.text) : null;
    } catch (e) {
        return { dateColumnIndex: 0, descriptionColumnIndex: 1, amountColumnIndex: 2, skipRowsStart: 0 };
    }
};

/**
 * FEATURE ATIVA: Sugestão de Contribuintes (Smart Edit)
 * Esta função continua válida pois auxilia na identificação manual, não na estrutura do arquivo.
 */
export const getAISuggestion = async (
  transaction: Transaction,
  contributors: Contributor[]
): Promise<string> => {
  try {
      const ai = getAIClient();
      const prompt = `
        Analise a descrição da transação: "${transaction.description}".
        Qual nome de contribuinte da lista abaixo se encaixa melhor?
        Lista: [${contributors.map(c => c.name).join(', ')}].
        Responda APENAS o nome exato do contribuinte ou "Nenhuma sugestão clara".
      `;
      
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: { temperature: 0.1 }
      });
      
      return response.text ? response.text.trim() : "Nenhuma sugestão clara";
  } catch (e) {
      console.error("Erro na sugestão IA:", e);
      return "Erro ao consultar IA.";
  }
};