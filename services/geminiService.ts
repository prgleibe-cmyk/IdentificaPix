
import { GoogleGenAI, Type } from "@google/genai";
import { Contributor, Transaction } from '../types';
import { Logger, Metrics } from './monitoringService';

const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAISuggestion = async (
  transaction: Transaction,
  contributors: Contributor[]
): Promise<string> => {
  const ai = getAIClient();
  const contributorNames = contributors.map(c => c.name).join(', ');
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analise a transação: "${transaction.description}" contra esta lista de contribuintes: [${contributorNames}]. Responda APENAS o nome exato do contribuinte que mais se assemelha ou "Nenhuma sugestão clara".`,
      config: {
          temperature: 0.1,
          topP: 0.95,
      }
    });

    return response.text?.trim() || "Nenhuma sugestão clara";

  } catch (error) {
    Logger.error("Error calling Gemini directly", error);
    Metrics.increment('apiErrors');
    return "Erro ao contatar a IA.";
  }
};

const chunkText = (text: string, size: number = 12000): string[] => {
    const chunks: string[] = [];
    let index = 0;
    while (index < text.length) {
        chunks.push(text.substring(index, index + size));
        index += size;
    }
    return chunks;
};

export const extractDataFromText = async (
    text: string, 
    example: any, 
    onProgress?: (current: number, total: number) => void
): Promise<any[]> => {
  const ai = getAIClient();
  const chunks = chunkText(text);
  const totalChunks = chunks.length;
  
  const instructions = `
    Você deve atuar como um extrator de dados financeiro profissional e cirúrgico.
    O usuário forneceu um exemplo na PRIMEIRA LINHA.
    
    REGRA MANDATÓRIA DE VALIDADE:
    Ignore e descarte completamente qualquer linha que NÃO possua uma DATA VÁLIDA e um VALOR NUMÉRICO. 
    Se faltar data ou valor, o registro é INVÁLIDO e não deve constar no JSON de resposta.

    USE ESTE PADRÃO PARA OS REGISTROS VÁLIDOS:
    - Data exemplo: "${example.date}"
    - Descrição limpa exemplo: "${example.description}"
    - Valor exemplo: "${example.amount}"
    
    REGRAS ADICIONAIS:
    1. Remova prefixos irrelevantes (TED, DOC, PIX) e códigos numéricos longos.
    2. Ignore linhas de SALDO, TOTAIS, RESUMOS ou cabeçalhos de tabela.
    3. Retorne a data SEMPRE no formato DD/MM/AAAA.
  `;

  let processedCount = 0;

  try {
    const extractionPromises = chunks.map(async (chunk) => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Extraia APENAS as transações válidas (com data e valor) deste documento:\n\n${chunk}`,
            config: {
                systemInstruction: instructions,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            date: { type: Type.STRING },
                            description: { type: Type.STRING },
                            amount: { type: Type.STRING },
                        },
                        required: ["date", "description", "amount"]
                    }
                }
            }
        });

        processedCount++;
        if (onProgress) onProgress(processedCount, totalChunks);
        
        const resultText = response.text;
        return resultText ? JSON.parse(resultText) : [];
    });

    const resultsArray = await Promise.all(extractionPromises);
    return resultsArray.flat();

  } catch (error) {
    Logger.error("AI Extraction failed", error);
    throw error;
  }
};
