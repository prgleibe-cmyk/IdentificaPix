import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// --- SERVIR FRONTEND ESTÁTICO ---
app.use(express.static(path.join(__dirname, 'dist')));

// A chave de API DEVE ser obtida de process.env.API_KEY.
let ai;
try {
    if (!process.env.API_KEY) {
        console.error("CRITICAL: Gemini API Key is missing from environment variables.");
    } else {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
} catch (e) {
    console.error("Failed to initialize GoogleGenAI client:", e.message);
}

// --- SERVIÇOS AUXILIARES ---

// 1. Busca e-mails brutos via Gmail API
// ATUALIZADO: maxResults aumentado para 400 e tratamento de erros individuais
async function fetchGmailMessages(accessToken, query, maxResults = 400) {
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

// 2. Converte JSON estruturado em CSV compatível com o sistema legado (Regra de Negócio)
function convertToCsv(transactions) {
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

// --- ROTAS DA API ---

// ROTA PRINCIPAL: Sincronização Gmail -> CSV
app.post('/api/gmail/sync', async (req, res) => {
    if (!ai) return res.status(500).json({ error: "Serviço de IA não configurado." });
    
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: "Token de acesso não fornecido." });

    try {
        console.log("[Gmail] Iniciando sincronização...");
        
        // 1. Buscar E-mails (Filtro Bancário Otimizado)
        const emails = await fetchGmailMessages(
            accessToken, 
            'subject:(pix OR transferência OR comprovante OR recebido OR enviado OR pagamento OR débito OR crédito OR extrato OR aviso OR notificação)',
            400 // Busca os últimos 400 emails (Alta capacidade para eventos)
        );

        if (emails.length === 0) return res.json({ csv: "", count: 0 });

        // 2. Preparar Payload para Gemini (Contexto)
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

        // 3. Processar com Gemini (Extração)
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
        
        // 4. Converter para CSV no Backend (O Frontend recebe o arquivo pronto)
        const csvContent = convertToCsv(transactions);

        res.json({ 
            csv: csvContent, 
            count: transactions.length 
        });

    } catch (error) {
        console.error("[Gmail] Erro no processamento:", error);
        res.status(500).json({ error: "Erro ao processar e-mails: " + error.message });
    }
});

// Rotas existentes (Legado/Mock)
app.post('/api/ai/extract-data', async (req, res) => { /* ... mantido ... */ });
app.post('/api/ai/suggestion', async (req, res) => {
    if (!ai) {
        return res.status(500).json({ error: "Serviço de IA não configurado." });
    }
    try {
        const { transactionDescription, contributorNames } = req.body;
        const prompt = `Analise a descrição da transação: "${transactionDescription}". Qual nome de contribuinte da lista abaixo se encaixa melhor? Responda APENAS o nome exato do contribuinte ou "Nenhuma sugestão clara". Lista: [${contributorNames.join(', ')}].`;
        
        const response = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: prompt,
            config: {
                temperature: 0.1,
                systemInstruction: "Você é um assistente de identificação de nomes. Responda apenas o nome sugerido ou 'Nenhuma sugestão clara'."
            }
        });
        res.json({ text: response.text ? response.text.trim() : "Nenhuma sugestão clara" });
    } catch (error) { 
        console.error("Erro na sugestão IA (backend):", error);
        res.status(500).json({ error: 'Erro na IA ao gerar sugestão.' }); 
    }
});

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

app.post('/api/payment/create', async (req, res) => {
    const { amount, name, email, description, method, userId } = req.body;
    console.log(`[MOCK PAYMENT] Recebido: ${method} para ${name} (${email}) - Valor: ${amount}`);

    try {
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

        const responseData = {
            id: `pay-${Date.now()}`,
            status: paymentStatus,
            value: amount,
            method: method,
            pixCopiaECola,
            pixQrCodeImage: qrCodeImage,
            barcode,
            bankSlipUrl
        };
        res.json(responseData);
    } catch (error) {
        console.error("Erro no mock de pagamento:", error);
        res.status(500).json({ error: "Erro ao processar pagamento simulado." });
    }
});

app.get('/api/payment/status/:id', async (req, res) => {
    const shouldBePaid = Math.random() > 0.3;
    res.json({
        id: req.params.id,
        status: shouldBePaid ? 'CONFIRMED' : 'PENDING'
    });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
