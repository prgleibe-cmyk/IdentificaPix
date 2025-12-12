import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptAnalysisResult } from "../types";
import { Logger } from "./monitoringService";

// Safe API Key retrieval for both Vite and Standard environments
const getApiKey = () => {
  let key = '';
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
      // @ts-ignore
      key = import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {}

  if (!key) {
    try {
      key = process.env.API_KEY || '';
    } catch (e) {}
  }
  return key;
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

/**
 * Converte um objeto File para uma string Base64 limpa (sem o prefixo data:image/...).
 */
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove o prefixo (ex: "data:image/jpeg;base64,") para enviar apenas os bytes
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeReceipt = async (file: File): Promise<ReceiptAnalysisResult> => {
  try {
    const filePart = await fileToGenerativePart(file);

    const prompt = `
      Você é um auditor financeiro rigoroso. Analise a imagem fornecida.
      
      Sua tarefa é verificar se este arquivo é um Comprovante de Pagamento Bancário Brasileiro (PIX, TED, DOC ou Boleto) VÁLIDO e LEGÍTIMO.
      
      Regras de Validação:
      1. Se a imagem for de uma pessoa, animal, objeto aleatório ou algo que claramente NÃO é um documento financeiro, defina "isValid" como false e "reason" como "A imagem não parece ser um documento financeiro.".
      2. Se for um documento financeiro, extraia o valor (amount), a data (date no formato YYYY-MM-DD), o destinatário (recipient) e o remetente (sender).
      3. Se o valor estiver ilegível ou ausente, considere inválido.
      
      Retorne APENAS um JSON seguindo este schema exato:
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
            filePart,
            { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                isValid: { type: Type.BOOLEAN },
                amount: { type: Type.NUMBER, description: "Valor numérico da transação. Ex: 29.90" },
                date: { type: Type.STRING, description: "Data da transação no formato YYYY-MM-DD" },
                recipient: { type: Type.STRING, description: "Nome de quem recebeu o pagamento" },
                sender: { type: Type.STRING, description: "Nome de quem enviou o pagamento" },
                reason: { type: Type.STRING, description: "Se inválido, explique o motivo em português. Se válido, pode deixar vazio ou 'ok'." }
            },
            required: ["isValid"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
        throw new Error("Resposta vazia da IA");
    }

    const analysis: ReceiptAnalysisResult = JSON.parse(resultText);
    return analysis;

  } catch (error) {
    Logger.error("Erro ao analisar comprovante", error);
    return {
        isValid: false,
        confidence: 0,
        reason: "Erro técnico ao processar a imagem. Tente novamente."
    } as any;
  }
};