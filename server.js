
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

// --- Configuração ASAAS ---
const ASAAS_API_KEY = process.env.ASAAS_API_KEY; // Chave da API do Asaas (Sandbox ou Produção)
const ASAAS_URL = process.env.ASAAS_URL || 'https://sandbox.asaas.com/api/v3'; // Padrão Sandbox, mude no .env para Produção

// Helper para chamadas ao Asaas
const asaasRequest = async (endpoint, method = 'GET', body = null) => {
    if (!ASAAS_API_KEY) throw new Error('ASAAS_API_KEY não configurada no servidor.');
    
    const headers = {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${ASAAS_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.errors?.[0]?.description || `Erro Asaas: ${response.statusText}`);
    }
    return data;
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

        // Passo 1: Criar ou recuperar cliente no Asaas
        // (Simplificado: Cria um novo sempre ou busca por email se quiser refinar depois)
        const customerPayload = {
            name: name || 'Cliente IdentificaPix',
            email: email || 'cliente@exemplo.com',
            cpfCnpj: cpfCnpj || '00000000000' 
        };

        // Tenta buscar cliente existente pelo email para evitar duplicatas
        let customerId;
        try {
            const customerSearch = await asaasRequest(`/customers?email=${customerPayload.email}&limit=1`);
            if (customerSearch.data && customerSearch.data.length > 0) {
                customerId = customerSearch.data[0].id;
            } else {
                const newCustomer = await asaasRequest('/customers', 'POST', customerPayload);
                customerId = newCustomer.id;
            }
        } catch (e) {
            console.error("Erro ao buscar/criar cliente Asaas", e);
            // Fallback: Tenta criar mesmo assim
            const newCustomer = await asaasRequest('/customers', 'POST', customerPayload);
            customerId = newCustomer.id;
        }

        // Passo 2: Criar Cobrança
        const paymentPayload = {
            customer: customerId,
            billingType: method, // PIX, BOLETO, CREDIT_CARD
            value: amount,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Vence amanhã
            description: description || 'Assinatura IdentificaPix',
        };

        const paymentData = await asaasRequest('/payments', 'POST', paymentPayload);

        // Passo 3: Se for PIX, buscar o QR Code Payload
        let pixData = null;
        if (method === 'PIX') {
            pixData = await asaasRequest(`/payments/${paymentData.id}/pixQrCode`, 'GET');
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
        console.error('Erro ao criar pagamento:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Verificar Status
app.get('/api/payment/status/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const paymentData = await asaasRequest(`/payments/${id}`, 'GET');
        res.json({ status: paymentData.status });
    } catch (error) {
        console.error('Erro ao verificar status:', error);
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
