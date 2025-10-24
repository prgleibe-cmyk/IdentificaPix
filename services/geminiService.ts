import { GoogleGenerativeAI } from "@google/generative-ai";
import { Contributor, Transaction } from '../types';
import { Logger, Metrics } from './monitoringService';

// Usa a variável de ambiente correta do Vite/Netlify
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ Erro: VITE_GEMINI_API_KEY não encontrada nas variáveis de ambiente.");
}

const ai = new GoogleGenerativeAI(apiKey);

export const getAISuggestion = async (
  transaction: Transaction,
  contributors: Contributor[]
): Promise<string> => {
  const contributorNames = contributors.map(c => c.name).join(', ');

  const prompt = `
    Você é um assistente de conciliação financeira para uma igreja.
    Dada a seguinte descrição de uma transação PIX e uma lista de contribuintes, identifique o contribuinte mais provável.

    Descrição da Transação: "${transaction.description}"

    Lista de Contribuintes:
    ${contributorNames}

    Analise o nome na descrição da transação e encontre a correspondência mais próxima na lista de contribuintes. 
    Responda APENAS com o nome completo do contribuinte da lista que você identificou.
    Se nenhum contribuinte parecer uma correspondência razoável, responda com "Nenhuma sugestão clara".
  `;

  try {
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);

    const output = result.response.text().trim();
    return output || "Nenhuma sugestão clara.";

  } catch (error) {
    Logger.error("Erro ao chamar a API do Gemini:", error);
    Metrics.increment('apiErrors');
    return "Erro ao contatar a IA.";
  }
};

