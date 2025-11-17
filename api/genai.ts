import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

// A chave fica somente no ambiente do Vercel (Environment Variables)
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("⚠ GEMINI_API_KEY não configurada no ambiente do Vercel");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!ai) {
    return res.status(500).json({ error: "IA não configurada" });
  }

  const { transactionDescription, contributorNames } = req.body;

  if (!transactionDescription || !contributorNames) {
    return res.status(400).json({ error: "Dados insuficientes" });
  }

  const prompt = `
    Você é um assistente de conciliação financeira para uma igreja.
    Dada a seguinte descrição de uma transação PIX e uma lista de contribuintes,
    identifique o contribuinte mais provável.

    Descrição da Transação: "${transactionDescription}"

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

    return res.status(200).json({ text: response.text.trim() });
  } catch (error) {
    console.error("Erro ao chamar Gemini API", error);
    return res.status(500).json({ error: "Erro ao contatar a IA" });
  }
}
