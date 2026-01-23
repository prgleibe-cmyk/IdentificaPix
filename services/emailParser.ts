
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction } from "../types";
import { Logger } from "./monitoringService";

const getAIClient = () => {
    // Fix: Use process.env.API_KEY directly in initialization as per guidelines
    if (!process.env.API_KEY) throw new Error("API Key missing");
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const parseEmailBatch = async (emails: { id: string, snippet: string, body: string, date: string, subject: string }[]): Promise<Transaction[]> => {
    if (emails.length === 0) return [];

    try {
        const ai = getAIClient();
        const emailData = emails.map(e => `ID: ${e.id} | ASSUNTO: ${e.subject} | CORPO: ${e.body.substring(0, 500)}`).join('\n---\n');

        const prompt = `Extraia transações bancárias (Pix, Transferências) destes e-mails. Entradas positivas, Saídas negativas. Retorne JSON Array de objetos {id, date, description, amount, type}.`;

        const response = await ai.models.generateContent({
            // Fix: Upgraded to gemini-3-pro-preview for complex multi-email transaction extraction
            model: 'gemini-3-pro-preview',
            contents: `${prompt}\n\n${emailData}`,
            config: {
                temperature: 0.1,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            date: { type: Type.STRING },
                            description: { type: Type.STRING },
                            amount: { type: Type.NUMBER },
                            type: { type: Type.STRING }
                        },
                        required: ["id", "date", "description", "amount"]
                    }
                }
            }
        });

        const extracted = response.text ? JSON.parse(response.text) : [];

        return extracted.map((item: any) => ({
            id: `gmail-${item.id}`,
            date: item.date,
            description: item.description,
            rawDescription: `GMAIL: ${item.description}`,
            cleanedDescription: item.description, 
            amount: item.amount,
            originalAmount: String(item.amount),
            contributionType: item.type || 'PIX'
        }));

    } catch (error) {
        Logger.error("Erro ao parsear e-mails com IA", error);
        return [];
    }
};