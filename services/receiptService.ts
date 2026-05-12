
import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptAnalysisResult } from "../types";
import { Logger } from "./monitoringService";

const getAIClient = () => {
    if (!process.env.API_KEY) throw new Error("API Key missing");
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

async function callWithRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            return callWithRetry(fn, retries - 1);
        }
        throw error;
    }
}

export const analyzeReceipt = async (file: File): Promise<ReceiptAnalysisResult> => {
  try {
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });

    return await callWithRetry(async () => {
        const ai = getAIClient();
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview', // Flash para análise rápida de comprovantes
          contents: {
            parts: [
              { inlineData: { mimeType: file.type, data: base64Data } },
              { text: "Extraia valor, data, pagador e recebedor deste comprovante financeiro." }
            ]
          },
          config: {
            temperature: 0,
            maxOutputTokens: 600,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isValid: { type: Type.BOOLEAN },
                amount: { type: Type.NUMBER },
                date: { type: Type.STRING },
                recipient: { type: Type.STRING },
                sender: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["isValid"]
            }
          }
        });

        const text = response.text;
        return text ? JSON.parse(text) : { isValid: false, reason: "Falha na interpretação da IA" };
    });

  } catch (error) {
    Logger.error("Erro ao analisar comprovante via Gemini", error);
    return { isValid: false, reason: "Erro técnico no processamento." } as any;
  }
};
