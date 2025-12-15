
import { ReceiptAnalysisResult } from "../types";
import { Logger } from "./monitoringService";

/**
 * Converte um objeto File para uma string Base64 limpa.
 */
const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove o prefixo (ex: "data:image/jpeg;base64,") para enviar apenas os bytes
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeReceipt = async (file: File): Promise<ReceiptAnalysisResult> => {
  try {
    const base64Data = await fileToBase64(file);

    const response = await fetch('/api/ai/analyze-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: file.type
        })
    });

    if (!response.ok) {
        throw new Error("Falha na comunicação com o servidor de IA");
    }

    const analysis: ReceiptAnalysisResult = await response.json();
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
