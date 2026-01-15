
import { Type } from "@google/genai";

// --- SERVIÇOS AUXILIARES EXTRAÍDOS ---

// 1. Busca e-mails brutos via Gmail API
// ATUALIZADO: maxResults aumentado para 400 e tratamento de erros individuais
export async function fetchGmailMessages(accessToken, query, maxResults = 400) {
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    
    if (!listRes.ok) {
        // Tenta ler o corpo do erro para dar feedback preciso (ex: "API not enabled")
        const errorText = await listRes.text();
        console.error(`Gmail API Error (${listRes.status}):`, errorText);
        throw new Error(`Gmail API Error: ${listRes.status} - Verifique se a Gmail API está ativada no Google Cloud Console.`);
    }
    
    const listData = await listRes.json();
    if (!listData.messages || listData.messages.length === 0) return [];

    const details = await Promise.all(listData.messages.map(async (msg) => {
        try {
            const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
            const res = await fetch(detailUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
            if (!res.ok) return null; // Ignora mensagens que falharam individualmente
            return res.json();
        } catch (e) {
            console.error(`Erro ao buscar detalhe da mensagem ${msg.id}:`, e);
            return null;
        }
    }));

    // Filtra mensagens nulas ou sem payload (estrutura inválida) antes de processar
    return details
        .filter(msg => msg && msg.payload && msg.payload.headers)
        .map(msg => {
            const headers = msg.payload.headers;
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const date = headers.find(h => h.name === 'Date')?.value || '';
            
            let body = '';
            if (msg.payload.parts) {
                const part = msg.payload.parts.find(p => p.mimeType === 'text/plain');
                if (part && part.body.data) body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            } else if (msg.payload.body.data) {
                body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
            }
            
            return { id: msg.id, subject, date, body: body.substring(0, 1000) }; // Limita tamanho para IA
        });
}

// 2. Extrai transações dos e-mails usando Gemini
export async function extractTransactionsFromEmails(ai, emails) {
    // Preparar Payload para Gemini (Contexto)
    const emailContext = emails.map(e => `
        ID: ${e.id}
        DATA: ${e.date}
        ASSUNTO: ${e.subject}
        CORPO: ${e.body.replace(/\s+/g, ' ')}
    `).join('\n---\n');

    const prompt = `
        Você é um motor de processamento bancário.
        Analise os e-mails abaixo e extraia transações financeiras confirmadas.
        
        REGRAS RÍGIDAS:
        1. Retorne APENAS transações financeiras reais (Pix, TEF, Pagamentos).
        2. Ignore e-mails de marketing puro (ex: "Peça seu cartão", "Oferta de empréstimo").
        3. Data deve ser ISO (YYYY-MM-DD).
        4. Valor deve ser numérico (positivo para entradas/recebimentos, negativo para saídas/pagamentos).
        5. Descrição deve conter o nome da pessoa/empresa ou tipo da operação.
        
        INPUT:
        ${emailContext}
    `;

    // Processar com Gemini (Extração)
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            temperature: 0, // Determinístico
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

    const transactions = response.text ? JSON.parse(response.text) : [];
    console.log(`[Gmail] ${transactions.length} transações extraídas.`);
    return transactions;
}

// 3. Converte JSON estruturado em CSV compatível com o sistema legado (Regra de Negócio)
export function convertToCsv(transactions) {
    if (!transactions || transactions.length === 0) return "";

    // Cabeçalho padrão que o GenericStrategy (Frontend) sabe ler
    const header = "Data;Descrição;Valor;Tipo";
    
    const rows = transactions.map(t => {
        // Normalização de Data: YYYY-MM-DD -> DD/MM/YYYY
        const dateParts = t.date.split('-');
        const brDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : t.date;
        
        // Normalização de Valor: Decimal com ponto (ex: 1250.50)
        const amount = Number(t.amount).toFixed(2);
        
        // Sanitização de Descrição (Remove ponto e vírgula para não quebrar CSV)
        const desc = (t.description || '').replace(/;/g, ' ').trim();
        const type = (t.type || 'GMAIL').replace(/;/g, ' ');

        return `${brDate};${desc};${amount};${type}`;
    });

    return [header, ...rows].join('\n');
}

// 4. Gera sugestão de identificação via Gemini
export async function generateAiSuggestion(ai, transactionDescription, contributorNames) {
    if (!ai) throw new Error("Serviço de IA não configurado.");
    
    const prompt = `Analise a descrição da transação: "${transactionDescription}". Qual nome de contribuinte da lista abaixo se encaixa melhor? Responda APENAS o nome exato do contribuinte ou "Nenhuma sugestão clara". Lista: [${contributorNames.join(', ')}].`;
    
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt,
        config: {
            temperature: 0.1,
            systemInstruction: "Você é um assistente de identificação de nomes. Responda apenas o nome sugerido ou 'Nenhuma sugestão clara'."
        }
    });
    return response.text ? response.text.trim() : "Nenhuma sugestão clara";
}

// 5. Criação de Pagamento Mock (Simulação)
export async function createMockPayment(data) {
    const { amount, name, email, description, method, userId } = data;
    console.log(`[MOCK PAYMENT] Recebido: ${method} para ${name} (${email}) - Valor: ${amount}`);

    await new Promise(resolve => setTimeout(resolve, 1500));

    let paymentStatus = 'PENDING';
    let pixCopiaECola = null;
    let qrCodeImage = null;
    let barcode = null;
    let bankSlipUrl = null;

    if (method === 'PIX') {
        pixCopiaECola = `00020126330014BR.GOV.BCB.PIX011112345678901520400005303986540${amount.toFixed(2)}5802BR590${name.length}${name}6007BRASIL62250521identificapix-mock6304CA77`;
        qrCodeImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    } else if (method === 'BOLETO') {
        barcode = "23790.50400 44100.120004 02002.324009 1 92340000000000";
        bankSlipUrl = "https://example.com/boleto-mock.pdf";
    } else if (method === 'CREDIT_CARD') {
        paymentStatus = 'CONFIRMED';
    }

    return {
        id: `pay-${Date.now()}`,
        status: paymentStatus,
        value: amount,
        method: method,
        pixCopiaECola,
        pixQrCodeImage: qrCodeImage,
        barcode,
        bankSlipUrl
    };
}

// 6. Status de Pagamento Mock
export async function getMockPaymentStatus(id) {
    const shouldBePaid = Math.random() > 0.3;
    return {
        id: id,
        status: shouldBePaid ? 'CONFIRMED' : 'PENDING'
    };
}
