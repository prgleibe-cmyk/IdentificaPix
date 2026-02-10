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

// --- DIAGNÓSTICOS DE AMBIENTE ---
const distPath = path.join(__dirname, 'dist');
console.log(`[Server] Root Dir: ${__dirname}`);
console.log(`[Server] Static Path (dist): ${distPath}`);

if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath);
  console.log(`[Server] ✅ Pasta 'dist' encontrada. Itens: ${files.join(', ')}`);
} else {
  console.error(`[Server] ❌ Pasta 'dist' não encontrada! O build falhou ou não foi executado.`);
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check para o Coolify
app.get('/health', (req, res) => res.status(200).send('OK'));

// Inicialização da IA
let ai = null;
if (process.env.API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        console.log("[IdentificaPix] Gemini AI Initialized.");
    } catch (e) {
        console.error("[IdentificaPix] AI Init Error:", e.message);
    }
}

// Endpoints
app.use('/api/gmail', gmailRoutes(ai));
app.use('/api/payment', paymentRoutes);
app.use('/api/ai', aiRoutes(ai));
app.use('/api/inbox', inboxRoutes(ai));

// Servir frontend
app.use(express.static(distPath));

// SPA Fallback
app.get('*', (req, res) => {
    if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'Not Found' });
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    res.status(200).send("IdentificaPix Server is Running. Site ready soon.");
});

// Porta 3000 (Original)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[IdentificaPix] Servidor rodando na porta ${PORT}`);
});