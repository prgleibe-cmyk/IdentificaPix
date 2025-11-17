import { GoogleGenAI } from "@google/genai";
import { Contributor, Transaction } from "../types";
import { Logger, Metrics } from "./monitoringService";

// -------------------------------
// CORREÇÃO DEFINITIVA PARA VERCEL
// -------------------------------

// Em produção no Vercel o import.meta.env às vezes vem vazio
// por isso aplicamos fallback para window.__ENV__ quando existir.
const apiKey =
  import.meta.env.VITE_GEMINI_API_KEY ||
  (window as any)?.__ENV__?.VITE_GEMINI_API_KEY ||
  null;

if (!apiKey) {
  console.warn(
    "⚠ VITE_GEMINI_API_KEY não encontrada. O app carregou, mas a IA não vai funcionar."
  );
  // NOTA: aqui NÃO damos throw (para não causar tela branca)
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// -------------------------------

export const getAISuggestion = async (
  transaction: Transaction,
  contributors: Contributor[]
): Promise<string> => {
  if (!ai) {
    return "A IA não está configurada corretamente.";
  }

  const contributorNames = contributors.map((c) => c.name).join(", ");

  const prompt = `
    Você é um assistente de conciliação financeira para uma igreja.
    Dada a seguinte descrição de uma transação PIX e uma lista de contribuintes,
    identifique o contribuinte mais provável.

    Descrição da Transação: "${transaction.description}"

    Lista de Contribuintes:
    ${contributorNames}

    Responda APENAS com o nome completo do contribuinte.
    Caso não encontre correspondência, responda: "Nenhuma sugestão clara".
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    Logger.error("Error calling Gemini API", error);
    Metrics.increment("apiErrors");
    return "Erro ao contatar a IA.";
  }
};
