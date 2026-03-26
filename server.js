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
import { createServer as createViteServer } from 'vite';

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

async function startServer() {
    const app = express();
    const PORT = process.env.PORT || 3000;

    // --- DIAGNÓSTICOS DE IMAGEM ---
    const distPath = path.join(__dirname, 'dist');
    
    console.log(`[IdentificaPix] Iniciando servidor...`);

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

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
        console.log("[Server] Modo Desenvolvimento: Ativando Vite Middleware...");
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);

        // SPA Fallback for development
        app.get('*', async (req, res, next) => {
            if (req.url.startsWith('/api/')) return next();
            
            const url = req.originalUrl;
            try {
                let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
                template = await vite.transformIndexHtml(url, template);
                res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
            } catch (e) {
                vite.ssrFixStacktrace(e);
                next(e);
            }
        });
    } else {
        console.log("[Server] Modo Produção: Servindo arquivos estáticos de /dist");
        app.use(express.static(distPath));
        
        // Rota específica para o Service Worker (evita erro de MIME type)
        app.get('/sw.js', (req, res) => {
            const swPath = path.join(distPath, 'sw.js');
            if (fs.existsSync(swPath)) {
                res.setHeader('Content-Type', 'application/javascript');
                return res.sendFile(swPath);
            }
            res.status(404).send('Not Found');
        });

        // SPA Fallback
        app.get('*', (req, res) => {
            if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'Not Found' });
            const indexPath = path.join(distPath, 'index.html');
            if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
            res.status(200).send("IdentificaPix Server Active.");
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[IdentificaPix] Rodando em http://0.0.0.0:${PORT}`);
    });
}

startServer();
