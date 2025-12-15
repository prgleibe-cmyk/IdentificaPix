
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Configuração para __dirname em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- Middleware de Logs (Essencial para Debug) ---
app.use((req, res, next) => {
    // Loga apenas requisições de API para não poluir com arquivos estáticos
    if (req.url.startsWith('/api')) {
        console.log(`[SERVER API] ${new Date().toISOString()} | ${req.method} ${req.url}`);
    }
    next();
});

// Aumentar limite para aceitar imagens em Base64
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Inicializa o cliente Gemini com a chave segura do servidor
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Configuração ASAAS (Com Limpeza Automática) ---
const cleanEnvVar = (val) => val ? val.trim().replace(/['";]/g, '') : '';

// Tratamento robusto para a URL do ASAAS
let rawUrl = process.env.ASAAS_URL || 'https://sandbox.asaas.com/api/v3';
// Remove caracteres indesejados comuns de copy/paste
if (rawUrl.startsWith('_')) rawUrl = rawUrl.substring(1); 
if (rawUrl.endsWith('/')) rawUrl = rawUrl.slice(0, -1); // Remove barra final se houver

const ASAAS_URL = cleanEnvVar(rawUrl);
const ASAAS_API_KEY = cleanEnvVar(process.env.ASAAS_API_KEY);

// Log de Diagnóstico na Inicialização
console.log('================================================');
console.log('🚀 IDENTIFICAPIX SERVER STARTING');
console.log(`📡 URL Base Asaas Configurada: "${ASAAS_URL}"`);
console.log(`🔑 API Key Asaas: ${ASAAS_API_KEY ? 'DEFINIDA (OK)' : 'FALTANDO (ERRO)'}`);
console.log('================================================');

// Helper para chamadas ao Asaas
const asaasRequest = async (endpoint, method = 'GET', body = null) => {
    if (!ASAAS_API_KEY) {
        console.error('ERRO FATAL: ASAAS_API_KEY não encontrada nas variáveis de ambiente.');
        throw new Error('Servidor mal configurado: Falta ASAAS_API_KEY');
    }
    
    // Garante que o endpoint comece com /
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = `${ASAAS_URL}${cleanEndpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
        'User-Agent': 'IdentificaPix-App/1.0'
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    console.log(`[Asaas] Enviando ${method} para: ${fullUrl}`);

    try {
        const response = await fetch(fullUrl, options);
        const data = await response.json();
        
        if (!response.ok) {
            console.error('[Asaas] Resposta de Erro:', JSON.stringify(data, null, 2));
            const errorMsg = data.errors?.[0]?.description || data.error || `Erro HTTP ${response.status}`;
            throw new Error(errorMsg);
        }
        return data;
    } catch (error) {
        console.error(`[Asaas] Falha de Conexão:`, error.message);
        throw error;
    }
};

// --- Rota de Health Check ---
app.get('/health', (req, res) => {
    res.status(200).send('OK - Server is running');
});

// --- Rotas de Pagamento (ASAAS) ---

app.post('/api/payment/create', async (req, res) => {
    try {
        const { amount, name, email, cpfCnpj, description, method } = req.body;
        console.log(`[API] Nova Transação Solicitada: ${method} - R$${amount}`);

        // 1. Criar ou recuperar cliente
        let customerId;
        const customerEmail = email || 'cliente@exemplo.com';
        
        try {
            const customerSearch = await asaasRequest(`/customers?email=${customerEmail}&limit=1`);
            if (customerSearch.data && customerSearch.data.length > 0) {
                customerId = customerSearch.data[0].id;
                console.log(`[Asaas] Cliente existente: ${customerId}`);
            } else {
                const newCustomer = await asaasRequest('/customers', 'POST', {
                    name: name || 'Cliente IdentificaPix',
                    email: customerEmail,
                    cpfCnpj: cpfCnpj || '00000000000'
                });
                customerId = newCustomer.id;
                console.log(`[Asaas] Novo cliente criado: ${customerId}`);
            }
        } catch (e) {
            console.error("[Asaas] Erro ao buscar/criar cliente:", e.message);
            // Fallback: Tenta criar direto mesmo sem busca
            try {
                const newCustomer = await asaasRequest('/customers', 'POST', {
                    name: name || 'Cliente IdentificaPix',
                    email: customerEmail,
                    cpfCnpj: cpfCnpj || '00000000000'
                });
                customerId = newCustomer.id;
            } catch (createError) {
                throw new Error(`Falha crítica ao criar cliente: ${createError.message}`);
            }
        }

        // 2. Criar Cobrança
        const paymentPayload = {
            customer: customerId,
            billingType: method,
            value: amount,
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            description: description || 'Assinatura IdentificaPix',
        };

        const paymentData = await asaasRequest('/payments', 'POST', paymentPayload);
        console.log(`[Asaas] Cobrança criada com sucesso: ${paymentData.id}`);

        // 3. Dados Específicos (PIX/Boleto)
        let pixData = null;
        if (method === 'PIX') {
            try {
                pixData = await asaasRequest(`/payments/${paymentData.id}/pixQrCode`, 'GET');
            } catch (e) {
                console.error("[Asaas] Erro ao obter QR Code (não fatal):", e.message);
            }
        }

        res.json({
            id: paymentData.id,
            status: paymentData.status,
            invoiceUrl: paymentData.invoiceUrl,
            bankSlipUrl: paymentData.bankSlipUrl,
            pixCopiaECola: pixData ? pixData.payload : null,
            pixQrCodeImage: pixData ? pixData.encodedImage : null
        });

    } catch (error) {
        console.error('[API] Erro 500 em /payment/create:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao processar pagamento' });
    }
});

app.get('/api/payment/status/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const paymentData = await asaasRequest(`/payments/${id}`, 'GET');
        res.json({ status: paymentData.status });
    } catch (error) {
        console.error('[API] Erro ao checar status:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Rotas de IA (Gemini) ---

app.post('/api/ai/suggestion', async (req, res) => {
    try {
        const { transactionDescription, contributorNames } = req.body;
        const prompt = `
            Você é um assistente de conciliação financeira.
            Descrição da Transação: "${transactionDescription}"
            Lista de Contribuintes: ${contributorNames}
            Analise e encontre a correspondência mais próxima. Responda APENAS com o nome exato da lista ou "Nenhuma sugestão clara".
        `;
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        res.json({ text: response.text ? response.text.trim() : "Erro na resposta da IA" });
    } catch (error) {
        console.error('Erro na rota /suggestion:', error);
        res.status(500).json({ error: 'Erro interno ao processar IA' });
    }
});

app.post('/api/ai/extract-data', async (req, res) => {
    try {
        const { text } = req.body;
        const prompt = `
            Extraia transações financeiras do texto abaixo para JSON.
            Campos: date (DD/MM/AAAA), description, amount (apenas números, use ponto para decimais).
            Texto: """${text.substring(0, 30000)}"""
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            date: { type: Type.STRING },
                            description: { type: Type.STRING },
                            amount: { type: Type.STRING },
                        }
                    }
                }
            }
        });
        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error('Erro na rota /extract-data:', error);
        res.status(500).json({ error: 'Erro ao extrair dados' });
    }
});

app.post('/api/ai/analyze-receipt', async (req, res) => {
    try {
        const { imageBase64, mimeType } = req.body;
        const prompt = `Analise este comprovante bancário brasileiro. Valide se é legítimo e extraia os dados.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: imageBase64 } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isValid: { type: Type.BOOLEAN },
                        amount: { type: Type.NUMBER },
                        date: { type: Type.STRING },
                        recipient: { type: Type.STRING },
                        sender: { type: Type.STRING },
                        reason: { type: Type.STRING }
                    },
                    required: ["isValid"]
                }
            }
        });
        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error('Erro na rota /analyze-receipt:', error);
        res.status(500).json({ error: 'Erro ao analisar comprovante' });
    }
});

// --- Servir Frontend em Produção ---
// Serve os arquivos estáticos da pasta dist
app.use(express.static(path.join(__dirname, 'dist')));

// Qualquer outra rota não-API retorna o index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
});
