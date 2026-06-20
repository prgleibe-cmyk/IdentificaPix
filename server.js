import dotenv from 'dotenv';
dotenv.config();

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                   process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                   process.env.SERVICE_ROLE_KEY ||
                   process.env.SUPABASE_SERVICE_KEY;

console.log(`[Server] Verificando variáveis de ambiente...`);
console.log(`[Server] Supabase Service Key: ${serviceKey ? 'Detectada (tamanho: ' + serviceKey.length + ')' : 'NÃO ENCONTRADA'}`);
console.log(`[Server] API_KEY: ${process.env.API_KEY ? 'Detectada' : 'NÃO ENCONTRADA'}`);
console.log(`[Server] ASAAS_API_KEY: ${process.env.ASAAS_API_KEY ? 'Detectada' : 'NÃO ENCONTRADA'}`);
console.log(`[Server] ASAAS_API_KEY_B64: ${process.env.ASAAS_API_KEY_B64 ? 'Detectada' : 'NÃO ENCONTRADA'}`);
console.log(`[Server] ASAAS_URL: ${process.env.ASAAS_URL || process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3'}`);

import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';

// Importação das rotas
import gmailRoutes from './backend/routes/gmail.js';
import paymentRoutes from './backend/routes/payments.js';
import aiRoutes from './backend/routes/ai.js';
import inboxRoutes from './backend/routes/inbox.js';
import usersRoutes from './backend/routes/users.js';
import referenceRoutes from './backend/routes/reference.js';
import { authMiddleware } from './backend/middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Iniciando Contributors API em segundo plano
console.log(`[IdentificaPix] Iniciando Contributors API em segundo plano...`);
const childEnv = { ...process.env, PORT: '3010' };
if (childEnv.DATABASE_URL && !childEnv.DATABASE_URL.startsWith('postgres://') && !childEnv.DATABASE_URL.startsWith('postgresql://')) {
    console.warn(`[IdentificaPix] ATENÇÃO: DATABASE_URL inválido detectado ("${childEnv.DATABASE_URL.substring(0, 40)}..."). Removendo-o para segurança.`);
    delete childEnv.DATABASE_URL;
}
if (childEnv.DATABASE_PRIVATE_URL && !childEnv.DATABASE_PRIVATE_URL.startsWith('postgres://') && !childEnv.DATABASE_PRIVATE_URL.startsWith('postgresql://')) {
    delete childEnv.DATABASE_PRIVATE_URL;
}

const contributorsApi = spawn('npx', ['tsx', 'server.ts'], {
    cwd: path.join(__dirname, 'contributors-api'),
    stdio: 'inherit',
    env: childEnv
});

contributorsApi.on('error', (err) => {
    console.error('[IdentificaPix] Erro ao iniciar Contributors API:', err.message);
});

contributorsApi.on('exit', (code) => {
    console.log(`[IdentificaPix] Contributors API finalizado com código ${code}`);
});

const app = express();

// --- DIAGNÓSTICOS DE IMAGEM ---
const distPath = path.join(__dirname, 'dist');
const pwaPath = path.join(distPath, 'pwa');

console.log(`[IdentificaPix] Iniciando servidor...`);

if (fs.existsSync(distPath)) {
    const logoExists = fs.existsSync(path.join(distPath, 'logo.png'));
    const pwaExists = fs.existsSync(pwaPath);
    console.log(`[Server] logo.png em dist: ${logoExists ? '✅' : '❌'}`);
    console.log(`[Server] pasta pwa em dist: ${pwaExists ? '✅' : '❌'}`);
    if (pwaExists) {
        console.log(`[Server] Arquivos PWA: ${fs.readdirSync(pwaPath).join(', ')}`);
    }
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Inicialização da IA Gemini
let ai = null;
const geminiKey = process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;

if (geminiKey) {
    try {
        ai = new GoogleGenAI({ apiKey: geminiKey });
        console.log("[IdentificaPix] Gemini AI Initialized.");
    } catch (e) {
        console.error("[IdentificaPix] AI Init Error:", e.message);
    }
}

// Registro de Rotas
try {
    // Rotas públicas ou de webhook (devem vir ANTES do authMiddleware)
    app.use('/api/payment', paymentRoutes);
    app.use('/api/inbox', inboxRoutes(ai));
    app.use('/api/ai', aiRoutes(ai));

    // Proxy para o Contributors API (PG + VPS)
    app.all('/api/v1/*', async (req, res) => {
        try {
            const baseUrl = process.env.CONTRIBUTORS_API_URL || 'http://127.0.0.1:3010';
            const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            const targetUrl = `${cleanBaseUrl}${req.originalUrl}`;
            
            console.log(`[Proxy] Forwarding ${req.method} ${req.originalUrl} to ${targetUrl}`);
            
            // Extrair o hostname correto de destino para evitar rejeição de cabeçalhos
            const urlObj = new URL(targetUrl);
            const targetHost = urlObj.host;

            // Limpar e sanitizar cabeçalhos para evitar erros no fetch (como incompatibilidade de content-length ou host)
            const cleanHeaders = {};
            const excludedHeaders = ['content-length', 'connection', 'host', 'keep-alive', 'transfer-encoding', 'accept-encoding'];
            for (const [key, value] of Object.entries(req.headers)) {
                if (!excludedHeaders.includes(key.toLowerCase())) {
                    cleanHeaders[key] = value;
                }
            }
            cleanHeaders['host'] = targetHost;

            const fetchOptions = {
                method: req.method,
                headers: cleanHeaders
            };

            if (req.method !== 'GET' && req.method !== 'HEAD') {
                fetchOptions.body = JSON.stringify(req.body);
                cleanHeaders['content-type'] = 'application/json';
            }

            let response;
            try {
                // Adiciona timeout rápido (1500ms) para evitar que a requisição fique travada 
                // caso o domínio do microserviço na VPS esteja inacessível no ambiente local.
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1500);

                response = await fetch(targetUrl, {
                    ...fetchOptions,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
            } catch (fetchErr) {
                console.warn(`[Proxy Warning] Direct forward to ${targetUrl} failed or timed out: ${fetchErr.message}. Trying local fallback on http://127.0.0.1:3010...`);
                // Fallback para o processo local em segundo plano
                const localUrl = `http://127.0.0.1:3010${req.originalUrl}`;
                response = await fetch(localUrl, fetchOptions);
            }

            const data = await response.json().catch(() => null);

            res.status(response.status).json(data || { error: 'Invalid Response from contributors-api' });
        } catch (error) {
            console.error(`[Proxy Error] Fail to forward to contributors-api:`, error.message);
            res.status(500).json({ error: 'CONTRIBUTORS_API_UNAVAILABLE' });
        }
    });

    // Middleware de Autenticação para as demais rotas
    app.use('/api', authMiddleware);
    
    // Rotas protegidas
    app.use('/api/gmail', gmailRoutes(ai));
    app.use('/api/users', usersRoutes());
    app.use('/api/reference', referenceRoutes());
} catch (error) {
    console.error("[IdentificaPix] Route Registration Error:", error.message);
}

// Pasta de arquivos estáticos
app.use(express.static(distPath));

// SPA Fallback
app.get('*', (req, res) => {
    if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'Not Found' });
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    res.status(200).send("IdentificaPix Server Active.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[IdentificaPix] Rodando em http://0.0.0.0:${PORT}`);
});