

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
    const transactions = [];
    
    // Expressões regulares para achar valores, datas e descrições no e-mail
    const amountRegex = /(?:-|R\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\s*([CDcd])?\b/;
    const dateRegex = /\b(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\b/;

    for (const email of emails) {
        const body = email.body || '';
        
        let amount = 0;
        let date = email.date ? new Date(email.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        let description = email.subject || "Notificação de e-mail";
        let type = "income";

        // Analisa o assunto e o corpo para detectar entradas ou saídas
        const textToAnalyze = `${email.subject} ${body}`.toUpperCase();
        if (
            textToAnalyze.includes("RECEB") || 
            textToAnalyze.includes("CREDIT") || 
            textToAnalyze.includes("ENTRADA") ||
            textToAnalyze.includes("RECEBEU")
        ) {
            type = "income";
        } else if (
            textToAnalyze.includes("ENVI") || 
            textToAnalyze.includes("PAGO") || 
            textToAnalyze.includes("DEBIT") || 
            textToAnalyze.includes("SAIDA") ||
            textToAnalyze.includes("SAÍDA")
        ) {
            type = "expense";
        }

        // Tenta achar valor no e-mail
        const amountMatch = body.match(amountRegex) || email.subject.match(amountRegex);
        if (amountMatch) {
            let rawAmount = amountMatch[1];
            rawAmount = rawAmount.replace(/\./g, '').replace(',', '.');
            const parsed = parseFloat(rawAmount);
            if (!isNaN(parsed)) {
                amount = parsed;
            }
        }

        // Tenta achar data no e-mail
        const dateMatch = body.match(dateRegex);
        if (dateMatch) {
            let day = dateMatch[1];
            let month = dateMatch[2];
            let year = dateMatch[3] || new Date().getFullYear();
            if (String(year).length === 2) year = "20" + year;
            date = `${year}-${month}-${day}`;
        }

        // Tenta extrair quem enviou ou recebeu
        const senderMatch = body.match(/(?:de|por)\s+([A-Z\s\u00C0-\u00FF]{3,30})/i);
        if (senderMatch && senderMatch[1]) {
            description = senderMatch[1].trim().toUpperCase();
        }

        if (amount > 0) {
            transactions.push({
                date,
                description,
                amount: type === 'expense' ? -amount : amount,
                type: 'GMAIL'
            });
        }
    }

    return transactions;
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
    if (!transactionDescription || !contributorNames || contributorNames.length === 0) {
        return "Nenhuma sugestão clara";
    }

    const cleanText = (str) => str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/[^a-z0-9\s]/g, "") // remove pontuacao
        .replace(/\s+/g, ' ')
        .trim();

    const descClean = cleanText(transactionDescription);
    let bestMatch = "Nenhuma sugestão clara";
    let highestScore = 0;

    for (const name of contributorNames) {
        const nameClean = cleanText(name);
        if (!nameClean) continue;

        // Se o nome está contido na descrição ou vice-versa, ganha pontuação alta
        if (descClean.includes(nameClean) || nameClean.includes(descClean)) {
            const score = Math.min(nameClean.length, descClean.length) / Math.max(nameClean.length, descClean.length) * 100;
            if (score > highestScore) {
                highestScore = score;
                bestMatch = name;
            }
        } else {
            // Conta quantas palavras em comum existem
            const descWords = descClean.split(' ');
            const nameWords = nameClean.split(' ');
            const commonWords = descWords.filter(w => w.length > 2 && nameWords.includes(w));
            
            if (commonWords.length > 0) {
                const score = (commonWords.length / nameWords.length) * 80;
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = name;
                }
            }
        }
    }

    return bestMatch;
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
    
    // 1. Carregamento da Chave
    if (process.env.ASAAS_API_KEY_B64) {
        try {
            apiKey = Buffer.from(process.env.ASAAS_API_KEY_B64.trim(), 'base64').toString('utf-8').trim();
        } catch (e) {
            console.error("[Asaas] Erro Base64:", e.message);
        }
    } else if (process.env.ASAAS_API_KEY) {
        apiKey = process.env.ASAAS_API_KEY.trim();
    }

    // 2. Reparo Agressivo da Chave
    if (apiKey) {
        apiKey = apiKey.replace(/^['"]|['"]$/g, '');
        
        // Se a chave começa com $aact mas só tem um $, o segundo foi comido
        const dollarCount = (apiKey.match(/\$/g) || []).length;
        if (apiKey.startsWith('$aact') && dollarCount === 1) {
            console.log("[Asaas] Tentando reparo agressivo da chave...");
            // O segundo $ geralmente fica antes de 'aach' ou no segundo bloco após os ::
            if (apiKey.includes('aach')) {
                apiKey = apiKey.replace('aach', '$aach');
            } else {
                // Tenta inserir o $ após o segundo conjunto de :: (padrão Asaas)
                const parts = apiKey.split('::');
                if (parts.length >= 3 && !parts[2].startsWith('$')) {
                    parts[2] = '$' + parts[2];
                    apiKey = parts.join('::');
                }
            }
        }
        console.log(`[Asaas Debug] Chave Final -> Tamanho: ${apiKey.length} | Símbolos '$': ${(apiKey.match(/\$/g) || []).length}`);
    }

    // 3. Validação de Dados do Cliente (CPF/CNPJ é obrigatório para Boleto/Cartão)
    if ((data.method === 'BOLETO' || data.method === 'CREDIT_CARD') && !data.cpfCnpj) {
        console.error("[Asaas] Erro: CPF/CNPJ ausente para método:", data.method);
        throw new Error("CPF ou CNPJ é obrigatório para pagamentos via Boleto ou Cartão.");
    }

    const rawUrl = process.env.ASAAS_URL || process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';
    let apiUrl = rawUrl.trim().replace(/\/$/, '');
    if (apiKey.startsWith('$aact_prod_')) apiUrl = 'https://www.asaas.com/api/v3';

    if (!apiKey) {
        console.warn("[Asaas] Usando Mock.");
        return { id: `mock-${Date.now()}`, status: 'PENDING', value: data.amount, method: data.method };
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
        } else if (data.method === 'BOLETO' || data.method === 'CREDIT_CARD') {
            result.bankSlipUrl = payment.bankSlipUrl;
            result.invoiceUrl = payment.invoiceUrl;
        }

        return result;
    } catch (error) {
        console.error("[Asaas Error]:", error.message);
        throw error;
    }
}

export async function getAsaasPaymentStatus(id) {
    let apiKey = '';
    
    if (process.env.ASAAS_API_KEY_B64) {
        try {
            apiKey = Buffer.from(process.env.ASAAS_API_KEY_B64.trim(), 'base64').toString('utf-8').trim();
        } catch (e) {}
    } else if (process.env.ASAAS_API_KEY) {
        apiKey = process.env.ASAAS_API_KEY.trim();
    }

    if (apiKey) {
        apiKey = apiKey.replace(/^['"]|['"]$/g, '');
        if (apiKey.includes('aach_') && !apiKey.includes('$aach_')) {
            apiKey = apiKey.replace('aach_', '$aach_');
        }
    }

    const rawUrl = process.env.ASAAS_URL || process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';
    let apiUrl = rawUrl.trim().replace(/\/$/, '');

    if (apiKey.startsWith('$aact_prod_')) apiUrl = 'https://www.asaas.com/api/v3';

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
