
import { Type } from "@google/genai";

export async function fetchGmailMessages(accessToken, query, maxResults = 400) {
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    
    if (!listRes.ok) throw new Error(`Gmail API Error: ${listRes.status}`);
    
    const listData = await listRes.json();
    if (!listData.messages || listData.messages.length === 0) return [];

    const details = await Promise.all(listData.messages.map(async (msg) => {
        try {
            const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
            const res = await fetch(detailUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
            return res.ok ? res.json() : null;
        } catch (e) { return null; }
    }));

    return details
        .filter(msg => msg?.payload?.headers)
        .map(msg => {
            const headers = msg.payload.headers;
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const date = headers.find(h => h.name === 'Date')?.value || '';
            let body = '';
            if (msg.payload.parts) {
                const part = msg.payload.parts.find(p => p.mimeType === 'text/plain');
                if (part?.body?.data) body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            } else if (msg.payload.body?.data) {
                body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
            }
            return { id: msg.id, subject, date, body: body.substring(0, 1000) };
        });
}

export async function extractTransactionsFromEmails(ai, emails) {
    if (!ai) throw new Error("AI Client missing");
    const emailContext = emails.map(e => `ID: ${e.id}\nDATA: ${e.date}\nCORPO: ${e.body}`).join('\n---\n');

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extraia transações financeiras destes e-mails para um JSON array:\n\n${emailContext}`,
        config: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        description: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        type: { type: Type.STRING }
                    },
                    required: ["date", "description", "amount"]
                }
            }
        }
    });

    return response.text ? JSON.parse(response.text) : [];
}

export function convertToCsv(transactions) {
    if (!transactions?.length) return "";
    const header = "Data;Descrição;Valor;Tipo";
    const rows = transactions.map(t => {
        const parts = t.date.split('-');
        const brDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : t.date;
        return `${brDate};${t.description.replace(/;/g, ' ')};${Number(t.amount).toFixed(2)};${(t.type || 'GMAIL').replace(/;/g, ' ')}`;
    });
    return [header, ...rows].join('\n');
}

export async function generateAiSuggestion(ai, transactionDescription, contributorNames) {
    if (!ai) throw new Error("AI Client missing");
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: `Descrição: "${transactionDescription}". Qual destes é o melhor match? [${contributorNames.join(', ')}]. Responda apenas o nome.`,
        config: { temperature: 0.1 }
    });
    return response.text ? response.text.trim() : "Nenhuma sugestão clara";
}

export async function createMockPayment(data) {
    return {
        id: `pay-${Date.now()}`,
        status: data.method === 'CREDIT_CARD' ? 'CONFIRMED' : 'PENDING',
        value: data.amount,
        method: data.method,
        pixCopiaECola: data.method === 'PIX' ? "00020126...identificapix-mock" : null,
        pixQrCodeImage: data.method === 'PIX' ? "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" : null
    };
}

export async function getMockPaymentStatus(id) {
    return { id, status: Math.random() > 0.5 ? 'CONFIRMED' : 'PENDING' };
}
