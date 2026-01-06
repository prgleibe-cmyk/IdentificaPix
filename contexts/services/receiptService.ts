import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptAnalysisResult } from "../types";
import { Logger } from "./monitoringService";

const getAIClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    return new GoogleGenAI({ apiKey });
};

// Retry logic adapted for Receipt Service
async function callWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        const msg = error?.message?.toLowerCase() || "";
        const status = error?.status || error?.error?.code;

        if (msg.includes("requested entity was not found") || status === 404 || status === "NOT_FOUND") {
             if (retries <= 0) throw error; // Stop recursion if retries exhausted

             if (typeof window !== 'undefined' && (window as any).aistudio) {
                 try {
                     await (window as any).aistudio.openSelectKey();
                     // IMPORTANTE: Decrementar retries para evitar loop
                     return callWithRetry(fn, retries - 1); 
                 } catch (e) {
                     console.error("Failed to open key selector", e);
                     throw error;
                 }
             }
        }
        
        if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            return callWithRetry(fn, retries - 1);
        }
        throw error;
    }
}

export const analyzeReceipt = async (file: File): Promise<ReceiptAnalysisResult> => {
  try {
    
    // Converter arquivo para base64 para o Gemini
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });

    return await callWithRetry(async () => {
        const ai = getAIClient(); // Instantiate inside retry loop
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64Data,
                },
              },
              { text: "Analise este comprovante de PIX/Transferência. Extraia o valor, data, pagador e recebedor. Verifique se parece um documento autêntico." }
            ]
          },
          config: {
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
    return {
        isValid: false,
        reason: "Erro técnico ao processar a imagem diretamente."
    } as any;
  }
};