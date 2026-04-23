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

// Importação das rotas
import gmailRoutes from './backend/routes/gmail.js';
import paymentRoutes from './backend/routes/payments.js';
import aiRoutes from './backend/routes/ai.js';
import inboxRoutes from './backend/routes/inbox.js';
import usersRoutes from './backend/routes/users.js';
import referenceRoutes from './backend/routes/reference.js';
import { authMiddleware } from './backend/middleware/auth.js';
import { getSupabaseAdmin } from './backend/lib/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Rota para admin_config (Movida para o backend para evitar CORS)
app.get('/api/admin-config', async (req, res) => {
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('admin_config')
            .select('value')
            .eq('key', 'system_settings')
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('[AdminConfig API] Erro:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        console.error('[AdminConfig API] Exceção:', err);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

// Proxy de Login (Resiliência contra erro 522/CORS)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('[Login API] Falha na autenticação:', error.message);
            return res.status(error.status || 401).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        console.error('[Login API] Exceção crítica:', err);
        res.status(500).json({ error: 'Erro interno no servidor de autenticação' });
    }
});

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

    // Middleware de Autenticação para as demais rotas
    app.use('/api', authMiddleware);
    
    // Rotas protegidas
    app.use('/api/gmail', gmailRoutes(ai));
    app.use('/api/ai', aiRoutes(ai));
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