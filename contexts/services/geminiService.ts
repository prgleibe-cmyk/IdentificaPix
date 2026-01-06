
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

export const performInitialInference = async (rawRows: string[][]): Promise<any[]> => {
    // Otimização: Reduzir payload removendo células vazias, mas mantendo a estrutura de array
    // para a IA entender colunas
    const optimizedRows = rawRows.map((row, index) => ({ 
        idx: index, 
        d: row // Envia o array original para manter a estrutura de colunas visível
    }));

    const instructions = `
        Atue como um extrator de dados bancários (OCR lógico e Estrutural).
        Entrada: { idx: indice_original, d: [coluna1, coluna2, ...] }
        
        CONTEXTO: Os dados de entrada são provenientes de arquivos (PDF/Excel) que foram pré-processados em um grid.
        Células vazias ou deslocadas podem ocorrer. Sua tarefa é encontrar o padrão das colunas.

        Saída: Array JSON com objetos contendo: date (DD/MM/AAAA), name (Descrição limpa), amount (decimal string), originalIndex.
        
        Regras:
        1. Analise o array 'd'. Identifique qual índice parece ser Data, qual é Descrição e qual é Valor.
        2. Ignore linhas que pareçam ser cabeçalhos (ex: "Data", "Histórico") ou rodapés.
        3. Converta datas para DD/MM/AAAA. Se o ano não estiver explícito, use o ano corrente ou o contexto do arquivo.
        4. Converta valores para string numérica padrão americano (ex: "1250.50"). 
        5. IMPORTANTE: Se identificar saídas/débitos/pagamentos, o valor DEVE ser negativo (ex: "-100.00"). Entradas são positivas.
    `;

    return callWithSimpleRetry(async () => {
        // Instantiate client inside the retry loop to capture fresh API key if changed
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: `Processar este lote estruturado: ${JSON.stringify(optimizedRows)}`, 
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
    
    // Envia o array cru para que a IA possa mapear por índice (posição) e não apenas por texto
    const optimizedRows = rawRows.map((row, index) => ({ 
        idx: index, 
        d: row 
    }));

    // Cria exemplos explícitos de mapeamento Input -> Output
    const examples = manualCorrections.map(ex => 
        `EXEMPLO DE REGRA (SIGA RIGOROSAMENTE):
         Entrada (Array Original): ${JSON.stringify(ex.originalRow)}
         Saída Correta: { "date": "${ex.corrected.date}", "name": "${ex.corrected.name}", "amount": "${ex.corrected.amount}" }`
    ).join('\n\n');

    const instructions = `
        Você é um motor de EXTRAÇÃO DE DADOS ESTRITAMENTE POSICIONAL E PADRONIZADO.
        
        O usuário forneceu exemplos manuais de como ele quer que os dados sejam extraídos.
        ${examples}
        
        SUA MISSÃO CRÍTICA:
        1. Analise os exemplos acima. Descubra EXATAMENTE de qual índice do array de entrada (0, 1, 2...) veio a Data, de qual veio o Nome e de qual veio o Valor.
        2. Aplique essa MESMA LÓGICA DE ÍNDICES para todas as novas linhas.
        3. NÃO TENTE "ADIVINHAR". Se no exemplo a data está na coluna 0, ela DEVE estar na coluna 0 em todas as linhas, mesmo que pareça estranho.
        4. NÃO TROQUE COLUNAS. Fidelidade posicional é a prioridade absoluta.
        5. Se o usuário limpou o nome no exemplo (removeu prefixos como "PIX"), faça o mesmo.
        
        Retorne um JSON Array. Se uma linha não tiver dados suficientes para preencher o padrão, retorne valores vazios ou pule-a se for cabeçalho.
    `;

    return callWithSimpleRetry(async () => {
        // Instantiate client inside the retry loop to capture fresh API key if changed
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: `Aplicar padrão aprendido (Mapeamento Posicional Rígido) nestas linhas: ${JSON.stringify(optimizedRows)}`, 
            config: {
                systemInstruction: instructions,
                temperature: 0, // Temperatura zero para máxima determinística
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
