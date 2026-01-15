
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction } from "../types";
import { Logger } from "./monitoringService";

const getAIClient = () => {
    const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    return new GoogleGenAI({ apiKey });
};

export const parseEmailBatch = async (emails: { id: string, snippet: string, body: string, date: string, subject: string }[]): Promise<Transaction[]> => {
    if (emails.length === 0) return [];

    try {
        const ai = getAIClient();
        
        // Prepara o prompt com lote de e-mails para economizar chamadas
        const emailData = emails.map(e => `
        --- EMAIL ID: ${e.id} ---
        DATA: ${e.date}
        ASSUNTO: ${e.subject}
        CONTEÚDO: ${e.snippet} ... ${e.body.substring(0, 500)}
        -------------------------
        `).join('\n');

        const prompt = `
        Você é um extrator financeiro especializado em e-mails bancários brasileiros (Pix, Transferências).
        Analise os e-mails abaixo e extraia as transações financeiras válidas.
        
        INPUT:
        ${emailData}

        REGRAS:
        1. Ignore e-mails de propaganda, segurança ou avisos gerais.
        2. Extraia apenas e-mails de confirmação de transação (Entrada ou Saída).
        3. Para "Entradas" (Pix Recebido), o valor deve ser POSITIVO.
        4. Para "Saídas" (Pix Enviado, Pagamento), o valor deve ser NEGATIVO.
        5. A data deve ser convertida para o formato YYYY-MM-DD.
        6. A descrição deve conter o nome do pagador/recebedor ou a descrição do Pix. Limpe textos como "Pix recebido de".
        
        Retorne um JSON Array.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                temperature: 0.1,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: "O ID original do e-mail" },
                            date: { type: Type.STRING, description: "YYYY-MM-DD" },
                            description: { type: Type.STRING },
                            amount: { type: Type.NUMBER },
                            type: { type: Type.STRING, description: "PIX, TED, BOLETO, etc" }
                        },
                        required: ["id", "date", "description", "amount"]
                    }
                }
            }
        });

        const extracted = response.text ? JSON.parse(response.text) : [];

        // Converte para o tipo Transaction interno
        // ATUALIZAÇÃO FASE 1: RawDescription populado
        return extracted.map((item: any) => ({
            id: `gmail-${item.id}`,
            date: item.date,
            description: item.description, // Descrição Limpa (sugestão da IA)
            rawDescription: `GMAIL: ${item.description}`, // Fonte de Verdade (Simplificada)
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
