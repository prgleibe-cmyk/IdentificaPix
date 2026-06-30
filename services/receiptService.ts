
import { ReceiptAnalysisResult } from "../types";
import { Logger } from "./monitoringService";

export const analyzeReceipt = async (file: File): Promise<ReceiptAnalysisResult> => {
  try {
    Logger.info("Análise determinística local iniciada para o arquivo:", { filename: file.name });
    // Retorna um fallback determinístico local amigável já que o processamento agora é 100% local.
    return { 
      isValid: false, 
      reason: "O processamento de comprovantes via IA foi totalmente desativado em favor da arquitetura local determinística e segura do sistema." 
    } as any;
  } catch (error) {
    Logger.error("Erro na análise local de comprovante", error);
    return { isValid: false, reason: "Erro técnico no processamento local." } as any;
  }
};
