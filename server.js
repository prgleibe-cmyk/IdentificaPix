
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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
// Prioriza API_KEY (Coolify) mas aceita VITE_GEMINI_API_KEY (Local) como fallback
const GEMINI_KEY = process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

// --- Configuração SUPABASE ADMIN (Para Webhooks) ---
// É necessário usar a Service Role Key para escrever no banco sem sessão de usuário ativa
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uflheoknbopcgmzyjbft.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabaseAdmin = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('✅ Supabase Admin inicializado com sucesso.');
} else {
    console.warn("⚠️ ALERTA: SUPABASE_SERVICE_KEY não encontrada. Webhooks de pagamento não atualizarão o banco de dados automaticamente.");
}

// --- Configuração ASAAS (Com Limpeza Automática Robusta e Inteligência de Ambiente) ---
const cleanEnvVar = (val) => val ? val.trim().replace(/['";]/g, '') : '';

// 1. Tenta pegar a URL correta, mas aceita erros de digitação comuns (ex: ASAAS_URL_)
let rawUrl = process.env.ASAAS_URL || process.env.ASAAS_URL_ || ''; 
const rawKey = process.env.ASAAS_API_KEY || '';

// 2. Inteligência de Ambiente: Se não tem URL definida (ou está vazia), tenta adivinhar pela chave
if (!rawUrl || rawUrl.trim() === '') {
    if (rawKey.includes('prod') || rawKey.includes('PROD')) {
        // CORREÇÃO: Produção no subdomínio 'api' não leva '/api' no path
        rawUrl = 'https://api.asaas.com/v3'; 
        console.log('ℹ️ Auto-detecção: Chave de Produção identificada. Usando URL de Produção.');
    } else {
        rawUrl = 'https://sandbox.asaas.com/api/v3';
        console.log('ℹ️ Auto-detecção: Usando URL de Sandbox (Padrão).');
    }
}

// 3. Limpeza final da URL (Corrige erros comuns de copy-paste)
if (rawUrl.includes(' ')) rawUrl = rawUrl.split(' ')[0]; // Remove dados extras se houver
if (rawUrl.startsWith('_')) rawUrl = rawUrl.substring(1); 
// Loop para remover barras ou iguais no final (pode ter mais de um)
while (rawUrl.endsWith('/') || rawUrl.endsWith('=')) {
    rawUrl = rawUrl.slice(0, -1);
}

// 4. CORREÇÃO CRÍTICA DE ROTA (Fix para Erro 404 em Produção)
// Se a URL for de produção (api.asaas.com) e tiver /api/v3, remove o /api extra
if (rawUrl.includes('api.asaas.com') && rawUrl.includes('/api/v3')) {
    rawUrl = rawUrl.replace('/api/v3', '/v3');
    console.log('🔧 Auto-fix: URL de produção corrigida (removido /api redundante).');
}

const ASAAS_URL = cleanEnvVar(rawUrl);
const ASAAS_API_KEY = cleanEnvVar(rawKey);

// Log de Diagnóstico na Inicialização
console.log('================================================');
console.log('🚀 IDENTIFICAPIX SERVER STARTING');
console.log(`📡 URL Base Asaas Final: "${ASAAS_URL}"`);

// DEBUG: Lista as chaves de variáveis detectadas para confirmar injeção
const envKeys = Object.keys(process.env).filter(k => k.includes('ASAAS') || k.includes('API'));
console.log(`🔍 Variáveis de Ambiente Detectadas: [${envKeys.join(', ')}]`);

if (!ASAAS_API_KEY) {
    console.error('❌ ERRO CRÍTICO: ASAAS_API_KEY está vazia ou indefinida.');
    console.error('⚠️ DICA: Se sua chave começa com "$", altere no Coolify para "$$" (dois cifrões) ou coloque entre aspas simples.');
} else if (ASAAS_API_KEY.length < 20) {
    console.warn(`⚠️ ALERTA: ASAAS_API_KEY parece muito curta ou corrompida (${ASAAS_API_KEY.length} chars). Verifique se o caractere "$" não causou interpolação.`);
} else {
    const keyEnv = ASAAS_API_KEY.includes('prod') ? 'PRODUÇÃO' : 'SANDBOX';
    console.log(`🔑 API Key Asaas: DEFINIDA (${keyEnv}) - ${ASAAS_API_KEY.substring(0, 10)}...`);
    
    // Validação extra de segurança
    if (ASAAS_URL.includes('sandbox') && ASAAS_API_KEY.includes('prod')) {
        console.warn('⚠️ ALERTA DE CONFIGURAÇÃO: Você está usando chave de PRODUÇÃO em ambiente SANDBOX. Isso vai falhar.');
    } else if (!ASAAS_URL.includes('sandbox') && !ASAAS_API_KEY.includes('prod')) {
        console.warn('⚠️ ALERTA DE CONFIGURAÇÃO: Você está usando chave de SANDBOX em ambiente PRODUÇÃO. Isso vai falhar.');
    }
}

console.log(`🤖 Gemini Key: ${GEMINI_KEY ? 'DEFINIDA (OK)' : 'FALTANDO (ERRO)'}`);
console.log('================================================');

// Helper para chamadas ao Asaas
const asaasRequest = async (endpoint, method = 'GET', body = null) => {
    if (!ASAAS_API_KEY) {
        console.error('ERRO FATAL: ASAAS_API_KEY não encontrada nas variáveis de ambiente.');
        throw new Error('Servidor mal configurado: Falta ASAAS_API_KEY. Verifique os logs de inicialização.');
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
        
        // Verifica se a resposta é JSON antes de tentar fazer o parse
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            if (!response.ok) {
                console.error('[Asaas] Resposta de Erro:', JSON.stringify(data, null, 2));
                const errorMsg = data.errors?.[0]?.description || data.error || `Erro HTTP ${response.status}`;
                throw new Error(errorMsg);
            }
            return data;
        } else {
            // Se não for JSON (provavelmente HTML de erro 404/500), pega o texto para debug
            const text = await response.text();
            console.error(`[Asaas] Erro Crítico: Resposta não-JSON recebida. Status: ${response.status}. URL: ${fullUrl}`);
            // console.error(`[Asaas] Conteúdo da resposta (início): ${text.substring(0, 200)}...`);
            throw new Error(`Erro HTTP ${response.status}: O servidor Asaas retornou uma resposta inválida. Verifique se a URL da API está correta.`);
        }

    } catch (error) {
        console.error(`[Asaas] Falha de Conexão:`, error.message);
        throw error;
    }
};

// --- Helper: Gerador de CPF Válido (Fallback para Produção) ---
const generateCpf = () => {
  const rnd = (n) => Math.round(Math.random() * n);
  const mod = (base, div) => Math.round(base - Math.floor(base / div) * div);
  const n = Array(9).fill(0).map(() => rnd(9));
  
  let d1 = n.reduce((total, num, i) => total + (num * (10 - i)), 0);
  d1 = 11 - mod(d1, 11);
  if (d1 >= 10) d1 = 0;
  
  let d2 = n.reduce((total, num, i) => total + (num * (11 - i)), 0) + (d1 * 2);
  d2 = 11 - mod(d2, 11);
  if (d2 >= 10) d2 = 0;
  
  return `${n.join('')}${d1}${d2}`;
};

// --- Rota de Health Check ---
app.get('/api/health', (req, res) => {
    const status = {
        status: 'OK',
        asaasConfigured: !!ASAAS_API_KEY,
        supabaseAdminConfigured: !!supabaseAdmin,
        envCheck: Object.keys(process.env).filter(k => k.includes('ASAAS')),
        host: req.headers.host,
        protocol: req.protocol
    };
    res.status(200).json(status);
});

// --- Rota de Webhook ASAAS (Recepção de Pagamentos) ---
app.post('/api/webhooks/asaas', async (req, res) => {
    const { event, payment } = req.body;
    console.log(`[Webhook] Evento recebido: ${event} | ID: ${payment?.id}`);

    // Confirmação de recebimento para o Asaas não ficar tentando reenviar
    // Processamos de forma assíncrona se for válido
    
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        const userId = payment.externalReference;
        
        if (userId && supabaseAdmin) {
            console.log(`[Webhook] Processando liberação para usuário: ${userId}`);
            
            try {
                // 1. Registrar pagamento no banco de dados (para auditoria)
                await supabaseAdmin.from('payments').insert({
                    user_id: userId,
                    amount: payment.value,
                    status: 'approved',
                    notes: `Webhook Asaas: ${payment.billingType} - ${payment.id}`,
                    created_at: new Date().toISOString()
                });

                // 2. Atualizar assinatura do usuário (Adicionar 30 dias)
                // Primeiro buscamos o perfil para saber quando a assinatura atual vence
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('subscription_ends_at')
                    .eq('id', userId)
                    .single();
                
                const now = new Date();
                let currentEnd = profile?.subscription_ends_at ? new Date(profile.subscription_ends_at) : now;
                
                // Se já venceu, começa de agora. Se ainda vale, soma ao final.
                if (currentEnd < now) currentEnd = now;
                
                const newEnd = new Date(currentEnd);
                newEnd.setDate(newEnd.getDate() + 30); // Adiciona 30 dias

                // Atualiza o perfil
                const { error: updateError } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        subscription_status: 'active',
                        subscription_ends_at: newEnd.toISOString()
                    })
                    .eq('id', userId);

                if (updateError) throw updateError;

                console.log(`[Webhook] ✅ Sucesso! Assinatura renovada até ${newEnd.toISOString()} para o usuário ${userId}.`);

            } catch (err) {
                console.error(`[Webhook] ❌ Erro ao atualizar Supabase:`, err);
                // Retornamos 500 para o Asaas tentar de novo depois, pois é erro nosso de banco
                return res.status(500).json({ received: true, error: 'Falha ao salvar no banco de dados' });
            }
        } else {
            console.warn(`[Webhook] Ignorado: ${!userId ? 'Sem UserId (externalReference)' : 'SupabaseAdmin não configurado'}.`);
        }
    }

    res.json({ received: true });
});

// --- Rotas de Pagamento (ASAAS) ---

app.post('/api/payment/create', async (req, res) => {
    try {
        const { amount, name, email, cpfCnpj, description, method, userId } = req.body;
        console.log(`[API] Nova Transação Solicitada: ${method} - R$${amount} (User: ${userId})`);

        // 1. Criar ou recuperar cliente
        let customerId;
        const customerEmail = email || 'cliente@exemplo.com';
        
        try {
            const customerSearch = await asaasRequest(`/customers?email=${customerEmail}&limit=1`);
            if (customerSearch.data && customerSearch.data.length > 0) {
                customerId = customerSearch.data[0].id;
                console.log(`[Asaas] Cliente existente: ${customerId}`);
            } else {
                // Em produção, o CPF deve ser válido. Usamos o gerado se não fornecido.
                const validCpf = cpfCnpj || generateCpf();
                console.log(`[Asaas] Criando cliente com CPF gerado/fornecido: ${validCpf}`);
                
                const newCustomer = await asaasRequest('/customers', 'POST', {
                    name: name || 'Cliente IdentificaPix',
                    email: customerEmail,
                    cpfCnpj: validCpf
                });
                customerId = newCustomer.id;
                console.log(`[Asaas] Novo cliente criado: ${customerId}`);
            }
        } catch (e) {
            console.error("[Asaas] Erro ao buscar/criar cliente:", e.message);
            // Fallback: Tenta criar direto mesmo sem busca, gerando CPF válido
            try {
                const validCpf = cpfCnpj || generateCpf();
                const newCustomer = await asaasRequest('/customers', 'POST', {
                    name: name || 'Cliente IdentificaPix',
                    email: customerEmail,
                    cpfCnpj: validCpf
                });
                customerId = newCustomer.id;
            } catch (createError) {
                throw new Error(`Falha crítica ao criar cliente: ${createError.message}`);
            }
        }

        // 2. Criar Cobrança
        // IMPORTANTE: Passamos o userId no campo 'externalReference' para o Webhook saber quem pagou
        const paymentPayload = {
            customer: customerId,
            billingType: method,
            value: amount,
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            description: description || 'Assinatura IdentificaPix',
            externalReference: userId || null 
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

// --- API 404 Handler (CRUCIAL) ---
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Endpoint de API não encontrado: ${req.method} ${req.url}` });
});

// --- Servir Frontend em Produção ---
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
});
