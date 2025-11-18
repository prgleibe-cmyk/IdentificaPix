import { GoogleGenAI } from "@google/genai";
import { Contributor, Transaction } from '../types';
import { Logger, Metrics } from './monitoringService';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text.trim();

  } catch (error) {
    Logger.error("Error calling Gemini API", error);
    Metrics.increment('apiErrors');
    return "Erro ao contatar a IA.";
  }
};
