
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
        // Fix: Upgraded to gemini-3-pro-preview for complex transaction extraction from email bodies
        model: 'gemini-3-pro-preview',
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
        // Fix: Upgraded to gemini-3-pro-preview for higher accuracy in matching descriptions to contributor names
        model: 'gemini-3-pro-preview', 
        contents: `Descrição: "${transactionDescription}". Qual destes é o melhor match? [${contributorNames.join(', ')}]. Responda apenas o nome.`,
        config: { temperature: 0.1 }
    });
    return response.text ? response.text.trim() : "Nenhuma sugestão clara";
}

export async function createAsaasPayment(data) {
    const apiKey = process.env.ASAAS_API_KEY;
    const apiUrl = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';

    if (!apiKey) {
        console.warn("[Asaas] API Key não configurada. Usando Mock.");
        return {
            id: `mock-${Date.now()}`,
            status: 'PENDING',
            value: data.amount,
            method: data.method,
            pixCopiaECola: "00020126...mock",
            pixQrCodeImage: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        };
    }

    try {
        // 1. Criar ou Buscar Cliente
        const customerRes = await fetch(`${apiUrl}/customers?email=${encodeURIComponent(data.email || '')}&cpfCnpj=${data.cpfCnpj || ''}`, {
            headers: { 'access_token': apiKey }
        });
        const customers = await customerRes.json();
        let customerId = customers.data?.[0]?.id;

        if (!customerId) {
            const newCustomerRes = await fetch(`${apiUrl}/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
                body: JSON.stringify({
                    name: data.name || 'Cliente IdentificaPix',
                    email: data.email,
                    cpfCnpj: data.cpfCnpj,
                    notificationDisabled: true
                })
            });
            const newCustomer = await newCustomerRes.json();
            customerId = newCustomer.id;
        }

        if (!customerId) throw new Error("Falha ao identificar/criar cliente no Asaas.");

        // 2. Criar Cobrança
        const paymentPayload = {
            customer: customerId,
            billingType: data.method === 'PIX' ? 'PIX' : (data.method === 'BOLETO' ? 'BOLETO' : 'CREDIT_CARD'),
            value: data.amount,
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Amanhã
            description: data.description || 'Assinatura IdentificaPix',
            externalReference: data.userId
        };

        const paymentRes = await fetch(`${apiUrl}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
            body: JSON.stringify(paymentPayload)
        });
        const payment = await paymentRes.json();

        if (payment.errors) throw new Error(payment.errors[0].description);

        const result = {
            id: payment.id,
            status: payment.status,
            value: payment.value,
            method: data.method
        };

        // 3. Se for PIX, buscar QR Code
        if (data.method === 'PIX') {
            const qrCodeRes = await fetch(`${apiUrl}/payments/${payment.id}/pixQrCode`, {
                headers: { 'access_token': apiKey }
            });
            const qrCodeData = await qrCodeRes.json();
            result.pixCopiaECola = qrCodeData.payload;
            result.pixQrCodeImage = qrCodeData.encodedImage;
        } else if (data.method === 'BOLETO') {
            result.bankSlipUrl = payment.bankSlipUrl;
        }

        return result;
    } catch (error) {
        console.error("[Asaas Service] Erro:", error.message);
        throw error;
    }
}

export async function getAsaasPaymentStatus(id) {
    const apiKey = process.env.ASAAS_API_KEY;
    const apiUrl = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';

    if (!apiKey || id.startsWith('mock-')) {
        return { id, status: Math.random() > 0.8 ? 'CONFIRMED' : 'PENDING' };
    }

    try {
        const response = await fetch(`${apiUrl}/payments/${id}`, {
            headers: { 'access_token': apiKey }
        });
        const data = await response.json();
        return { id: data.id, status: data.status };
    } catch (error) {
        console.error("[Asaas Status] Erro:", error.message);
        return { id, status: 'ERROR' };
    }
}
