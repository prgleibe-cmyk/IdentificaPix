
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
// Aumentar limite para aceitar imagens em Base64
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Inicializa o cliente Gemini com a chave segura do servidor
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Configuração ASAAS (Com Limpeza Automática de Erros de Digitação) ---
const cleanEnvVar = (val) => val ? val.trim().replace(/['";]/g, '') : '';

// Remove underlines ou espaços acidentais no início da URL
let rawUrl = process.env.ASAAS_URL || 'https://sandbox.asaas.com/api/v3';
if (rawUrl.startsWith('_')) rawUrl = rawUrl.substring(1); 

const ASAAS_URL = cleanEnvVar(rawUrl);
const ASAAS_API_KEY = cleanEnvVar(process.env.ASAAS_API_KEY);

// Log de Diagnóstico na Inicialização
console.log('------------------------------------------------');
console.log('--- DIAGNÓSTICO ASAAS (Server Start) ---');
console.log('URL Base:', ASAAS_URL);
console.log('Ambiente Detectado:', ASAAS_URL.includes('sandbox') ? 'SANDBOX (Testes)' : 'PRODUÇÃO (Dinheiro Real)');
console.log('API Key Configurada:', ASAAS_API_KEY ? `SIM (Inicia com ${ASAAS_API_KEY.substring(0, 5)}...)` : 'NÃO');
console.log('------------------------------------------------');

// Helper para chamadas ao Asaas
const asaasRequest = async (endpoint, method = 'GET', body = null) => {
    if (!ASAAS_API_KEY) {
        console.error('ERRO FATAL: ASAAS_API_KEY não encontrada nas variáveis de ambiente.');
        throw new Error('Servidor mal configurado: Falta ASAAS_API_KEY');
    }
    
    const headers = {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
        'User-Agent': 'IdentificaPix-App/1.0'
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const fullUrl = `${ASAAS_URL}${endpoint}`;
    console.log(`[Asaas] Enviando ${method} para ${fullUrl}`);

    try {
        const response = await fetch(fullUrl, options);
        const data = await response.json();
        
        if (!response.ok) {
            console.error('[Asaas] Erro na resposta:', JSON.stringify(data, null, 2));
            // Tenta extrair a mensagem de erro mais clara possível do Asaas
            const errorMsg = data.errors?.[0]?.description || data.error || `Erro HTTP ${response.status}`;
            throw new Error(errorMsg);
        }
        return data;
    } catch (error) {
        console.error(`[Asaas] Falha na requisição:`, error.message);
        throw error;
    }
};

// --- Rota de Health Check ---
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// --- Rotas de Pagamento (ASAAS) ---

// 1. Criar Pagamento
app.post('/api/payment/create', async (req, res) => {
    try {
        const { amount, name, email, cpfCnpj, description, method } = req.body;

        console.log(`[API] Criando pagamento: ${method} - R$${amount} para ${name}`);

        // Passo 1: Criar ou recuperar cliente no Asaas
        // O Asaas não permite criar clientes duplicados com mesmo CPF/Email facilmente,
        // então buscamos primeiro.
        let customerId;
        const customerEmail = email || 'cliente@exemplo.com';
        
        try {
            console.log(`[Asaas] Buscando cliente por email: ${customerEmail}`);
            const customerSearch = await asaasRequest(`/customers?email=${customerEmail}&limit=1`);
            
            if (customerSearch.data && customerSearch.data.length > 0) {
                customerId = customerSearch.data[0].id;
                console.log(`[Asaas] Cliente existente encontrado: ${customerId}`);
            } else {
                console.log(`[Asaas] Criando novo cliente...`);
                const newCustomer = await asaasRequest('/customers', 'POST', {
                    name: name || 'Cliente IdentificaPix',
                    email: customerEmail,
                    cpfCnpj: cpfCnpj || '00000000000'
                });
                customerId = newCustomer.id;
                console.log(`[Asaas] Novo cliente criado: ${customerId}`);
            }
        } catch (e) {
            console.error("[Asaas] Erro ao gerenciar cliente:", e.message);
            // Fallback: Tenta criar direto se a busca falhar (ex: API lenta)
            try {
                const newCustomer = await asaasRequest('/customers', 'POST', {
                    name: name || 'Cliente IdentificaPix',
                    email: customerEmail,
                    cpfCnpj: cpfCnpj || '00000000000'
                });
                customerId = newCustomer.id;
            } catch (createError) {
                throw new Error(`Falha ao criar cliente: ${createError.message}`);
            }
        }

        // Passo 2: Criar Cobrança
        const paymentPayload = {
            customer: customerId,
            billingType: method, // PIX, BOLETO, CREDIT_CARD
            value: amount,
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Vence em 2 dias
            description: description || 'Assinatura IdentificaPix',
        };

        const paymentData = await asaasRequest('/payments', 'POST', paymentPayload);
        console.log(`[Asaas] Cobrança criada: ${paymentData.id}`);

        // Passo 3: Se for PIX, buscar o QR Code Payload
        let pixData = null;
        if (method === 'PIX') {
            try {
                pixData = await asaasRequest(`/payments/${paymentData.id}/pixQrCode`, 'GET');
            } catch (e) {
                console.error("[Asaas] Erro ao obter QR Code:", e.message);
            }
        }

        res.json({
            id: paymentData.id,
            status: paymentData.status,
            invoiceUrl: paymentData.invoiceUrl,
            bankSlipUrl: paymentData.bankSlipUrl,
            pixCopiaECola: pixData ? pixData.payload : null,
            pixQrCodeImage: pixData ? pixData.encodedImage : null // Asaas retorna imagem base64
        });

    } catch (error) {
        console.error('[API] Erro 500 em /payment/create:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao processar pagamento' });
    }
});

// 2. Verificar Status
app.get('/api/payment/status/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const paymentData = await asaasRequest(`/payments/${id}`, 'GET');
        res.json({ status: paymentData.status });
    } catch (error) {
        console.error('[API] Erro ao verificar status:', error);
        res.status(500).json({ error: error.message });
    }
});


// --- Rotas de IA (Gemini) ---

app.post('/api/ai/suggestion', async (req, res) => {
    try {
        const { transactionDescription, contributorNames } = req.body;

        const prompt = `
            Você é um assistente de conciliação financeira para uma igreja.
            Dada a seguinte descrição de uma transação PIX e uma lista de contribuintes, identifique o contribuinte mais provável.
            
            Descrição da Transação: "${transactionDescription}"
            
            Lista de Contribuintes:
            ${contributorNames}
            
            Analise o nome na descrição da transação e encontre a correspondência mais próxima na lista de contribuintes. 
            Responda APENAS com o nome completo do contribuinte da lista que você identificou.
            Se nenhum contribuinte parecer uma correspondência razoável, responda com "Nenhuma sugestão clara".
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        res.json({ text: response.text ? response.text.trim() : "Erro na resposta da IA" });
    } catch (error) {
        console.error('Erro na rota /suggestion:', error);
        res.status(500).json({ error: 'Erro interno ao processar IA' });
    }
});

app.post('/api/ai/analyze-receipt', async (req, res) => {
    try {
        const { imageBase64, mimeType } = req.body;

        const prompt = `
          Você é um auditor financeiro rigoroso. Analise a imagem fornecida.
          Sua tarefa é verificar se este arquivo é um Comprovante de Pagamento Bancário Brasileiro (PIX, TED, DOC ou Boleto) VÁLIDO e LEGÍTIMO.
          Regras:
          1. Se não for financeiro, isValid = false.
          2. Extraia valor (amount), data (YYYY-MM-DD), destinatário e remetente.
        `;

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
                        amount: { type: Type.NUMBER, description: "Valor numérico. Ex: 29.90" },
                        date: { type: Type.STRING, description: "Formato YYYY-MM-DD" },
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

app.post('/api/ai/extract-data', async (req, res) => {
    try {
        const { text, examples } = req.body;
        
        // Truncar texto para evitar estourar tokens se for muito grande
        const truncatedText = text.substring(0, 30000);

        const prompt = `
            Extraia transações financeiras do texto abaixo.
            ${examples ? `Siga este padrão aproximado: ${JSON.stringify(examples)}` : 'Busque padrões de Data, Descrição e Valor.'}
            
            TEXTO:
            """
            ${truncatedText}
            """
            
            Retorne JSON array.
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

// --- Servir Frontend em Produção ---
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
