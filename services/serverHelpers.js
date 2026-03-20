
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
        model: 'gemini-3-pro-preview', 
        contents: `Descrição: "${transactionDescription}". Qual destes é o melhor match? [${contributorNames.join(', ')}]. Responda apenas o nome.`,
        config: { temperature: 0.1 }
    });
    return response.text ? response.text.trim() : "Nenhuma sugestão clara";
}

// --- INTEGRAÇÃO ASAAS ---

function sanitizeKey(key) {
    if (!key) return '';
    let clean = key.trim();
    // Remove prefixos comuns se o usuário colou a linha inteira do .env
    if (clean.includes('=')) clean = clean.split('=').pop().trim();
    // Remove aspas
    clean = clean.replace(/^['"]|['"]$/g, '');
    // Remove caracteres não-imprimíveis/invisíveis
    clean = clean.replace(/[^\x21-\x7E]/g, '');
    return clean;
}

export async function createAsaasPayment(data) {
    let apiKey = '';
    
    // PRIORIDADE ABSOLUTA: Base64 (Blindada contra Coolify/Linux)
    if (process.env.ASAAS_API_KEY_B64) {
        try {
            apiKey = Buffer.from(process.env.ASAAS_API_KEY_B64.trim(), 'base64').toString('utf-8').trim();
            console.log("[Asaas] Usando chave blindada via Base64.");
        } catch (e) {
            console.error("[Asaas] Erro fatal ao decodificar Base64:", e.message);
        }
    } 
    // FALLBACK: Chave em texto puro (apenas se não houver Base64)
    else if (process.env.ASAAS_API_KEY) {
        apiKey = process.env.ASAAS_API_KEY.trim();
        // Limpeza mínima apenas para texto puro
        apiKey = apiKey.replace(/^['"]|['"]$/g, '');
        if (apiKey.includes('=') && !apiKey.startsWith('$')) {
            apiKey = apiKey.split('=').pop().trim();
        }
        console.log("[Asaas] Usando chave em texto puro (Atenção: Risco de corrupção pelo shell).");
    }

    // Suporte para ASAAS_URL ou ASAAS_API_URL
    const rawUrl = process.env.ASAAS_URL || process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';
    let apiUrl = rawUrl.trim().replace(/\/$/, '');

    // --- VALIDAÇÃO DE INTEGRIDADE ---
    if (apiKey) {
        const dollarCount = (apiKey.match(/\$/g) || []).length;
        console.log(`[Asaas Debug] Chave carregada. Tamanho: ${apiKey.length} | Símbolos '$': ${dollarCount}`);
        
        if (dollarCount < 2 && apiKey.startsWith('$aact_prod_')) {
            console.error("--- ERRO CRÍTICO ---");
            console.error("[Asaas] A chave está incompleta! Faltam símbolos '$'.");
            console.error("[Asaas] Certifique-se de que o Base64 foi gerado da chave COMPLETA.");
            console.error("--------------------");
        }
    }

    // Forçar produção se a chave for de produção
    if (apiKey.startsWith('$aact_prod_')) {
        apiUrl = 'https://www.asaas.com/api/v3';
    }

    // Fallback para Mock se não houver chave
    if (!apiKey) {
        console.warn("[Asaas] Nenhuma chave configurada. Usando Mock.");
        return {
            id: `mock-${Date.now()}`,
            status: 'PENDING',
            value: data.amount,
            method: data.method,
            pixCopiaECola: "00020126...mock-pix",
            pixQrCodeImage: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        };
    }

    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'access_token': apiKey
    };

    try {
        // 1. Cliente
        const customerUrl = `${apiUrl}/customers?email=${encodeURIComponent(data.email || '')}`;
        const customerRes = await fetch(customerUrl, { headers });
        const customerData = await customerRes.json();
        let customerId = customerData.data?.[0]?.id;

        if (!customerId) {
            const newCustomerRes = await fetch(`${apiUrl}/customers`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: data.name || 'Cliente IdentificaPix',
                    email: data.email,
                    cpfCnpj: data.cpfCnpj,
                    notificationDisabled: true
                })
            });
            const newCustomer = await newCustomerRes.json();
            if (newCustomer.errors) throw new Error(newCustomer.errors[0].description);
            customerId = newCustomer.id;
        }

        // 2. Cobrança
        const paymentPayload = {
            customer: customerId,
            billingType: data.method === 'PIX' ? 'PIX' : (data.method === 'BOLETO' ? 'BOLETO' : 'CREDIT_CARD'),
            value: data.amount,
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            description: 'Assinatura IdentificaPix',
            externalReference: data.userId
        };

        const paymentRes = await fetch(`${apiUrl}/payments`, {
            method: 'POST',
            headers,
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

        // 3. QR Code se PIX
        if (data.method === 'PIX') {
            const qrRes = await fetch(`${apiUrl}/payments/${payment.id}/pixQrCode`, { headers });
            const qrData = await qrRes.json();
            result.pixCopiaECola = qrData.payload;
            result.pixQrCodeImage = qrData.encodedImage;
        } else if (data.method === 'BOLETO') {
            result.bankSlipUrl = payment.bankSlipUrl;
        }

        return result;
    } catch (error) {
        console.error("[Asaas Error]:", error.message);
        throw error;
    }
}

export async function getAsaasPaymentStatus(id) {
    let apiKey = '';
    
    // PRIORIDADE ABSOLUTA: Base64
    if (process.env.ASAAS_API_KEY_B64) {
        try {
            apiKey = Buffer.from(process.env.ASAAS_API_KEY_B64.trim(), 'base64').toString('utf-8').trim();
        } catch (e) {
            console.error("[Asaas Status] Erro ao decodificar Base64:", e.message);
        }
    } 
    // FALLBACK: Texto puro
    else if (process.env.ASAAS_API_KEY) {
        apiKey = process.env.ASAAS_API_KEY.trim().replace(/^['"]|['"]$/g, '');
        if (apiKey.includes('=') && !apiKey.startsWith('$')) {
            apiKey = apiKey.split('=').pop().trim();
        }
    }

    const rawUrl = process.env.ASAAS_URL || process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';
    let apiUrl = rawUrl.trim().replace(/\/$/, '');

    if (apiKey.startsWith('$aact_prod_')) {
        apiUrl = 'https://www.asaas.com/api/v3';
    }

    if (!apiKey || id.startsWith('mock-')) {
        return { id, status: Math.random() > 0.8 ? 'CONFIRMED' : 'PENDING' };
    }

    try {
        const response = await fetch(`${apiUrl}/payments/${id}`, {
            headers: { 'Accept': 'application/json', 'access_token': apiKey }
        });
        const data = await response.json();
        return { id: data.id, status: data.status };
    } catch (error) {
        return { id, status: 'ERROR' };
    }
}
