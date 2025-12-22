
import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptAnalysisResult } from "../types";
import { Logger } from "./monitoringService";

const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeReceipt = async (file: File): Promise<ReceiptAnalysisResult> => {
  try {
    const ai = getAIClient();
    
    // Converter arquivo para base64 para o Gemini
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Data,
          },
        },
        { text: "Analise este comprovante de PIX/Transferência. Extraia o valor, data, pagador e recebedor. Verifique se parece um documento autêntico." }
      ],
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

  } catch (error) {
    Logger.error("Erro ao analisar comprovante via Gemini", error);
    return {
        isValid: false,
        reason: "Erro técnico ao processar a imagem diretamente."
    } as any;
  }
};
