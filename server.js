import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';

// Importação das rotas modulares
import gmailRoutes from './backend/routes/gmail.js';
import paymentRoutes from './backend/routes/payments.js';
import aiRoutes from './backend/routes/ai.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- CONFIGURAÇÃO DE MIDDLEWARES ---
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// --- SERVIR FRONTEND (STATIC ASSETS) ---
// Primeiro servimos os arquivos reais da pasta dist
app.use(express.static(path.join(__dirname, 'dist')));

// --- INICIALIZAÇÃO IA (GEMINI) ---
let ai = null;
if (process.env.API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        console.log("[Server] Gemini AI Initialized.");
    } catch (e) {
        console.error("[Server] Critical: Failed to init Gemini SDK", e.message);
    }
}

// --- ROTAS DA API ---
app.use('/api/gmail', gmailRoutes(ai));
app.use('/api/payment', paymentRoutes);
app.use('/api/ai', aiRoutes(ai));

// --- SPA FALLBACK LOGIC ---
app.get('*', (req, res) => {
    // 1. Ignora requisições de API
    if (req.url.startsWith('/api/')) {
        return res.status(404).json({ error: "API Endpoint not found" });
    }

    // 2. BLINDAGEM DE ASSETS: Se o request tem extensão (.png, .ico, .json, .js, .css)
    // e chegou aqui, significa que o arquivo real NÃO EXISTE na pasta dist.
    // Retornamos 404 em vez de index.html para não quebrar o browser/PWA.
    const ext = path.extname(req.url);
    if (ext && ext !== '.html') {
        console.warn(`[Server] Static asset missing: ${req.url}`);
        return res.status(404).send('Not found');
    }

    // 3. Fallback para index.html apenas para rotas de navegação (ex: /dashboard, /upload)
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[IdentificaPix Server] Running on port ${PORT}`);
});