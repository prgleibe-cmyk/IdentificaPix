import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Importação das rotas
import gmailRoutes from './backend/routes/gmail.js';
import paymentRoutes from './backend/routes/payments.js';
import aiRoutes from './backend/routes/ai.js';
import inboxRoutes from './backend/routes/inbox.js';

dotenv.config();

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

// Inicialização da IA Gemini
let ai = null;
if (process.env.API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        console.log("[IdentificaPix] Gemini AI Initialized.");
    } catch (e) {
        console.error("[IdentificaPix] AI Init Error:", e.message);
    }
}

// Registro de Rotas
try {
    app.use('/api/gmail', gmailRoutes(ai));
    app.use('/api/payment', paymentRoutes);
    app.use('/api/ai', aiRoutes(ai));
    app.use('/api/inbox', inboxRoutes(ai));
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