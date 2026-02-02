
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Importação das rotas modulares
import gmailRoutes from './backend/routes/gmail.js';
import paymentRoutes from './backend/routes/payments.js';
import aiRoutes from './backend/routes/ai.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- DIAGNÓSTICOS DE AMBIENTE ---
const distPath = path.join(__dirname, 'dist');
const publicPwaPath = path.join(__dirname, 'public', 'pwa');

console.log(`[Server] --- DIAGNÓSTICO DE INICIALIZAÇÃO ---`);
console.log(`[Server] Root Dir: ${__dirname}`);
console.log(`[Server] Static Path (dist): ${distPath}`);

if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    console.log(`[Server] ✅ Pasta 'dist' encontrada. Itens: ${files.join(', ')}`);
    const pwaInDist = path.join(distPath, 'pwa');
    if (fs.existsSync(pwaInDist)) {
        console.log(`[Server] ✅ dist/pwa encontrada. Arquivos: ${fs.readdirSync(pwaInDist).join(', ')}`);
    } else {
        console.warn(`[Server] ⚠️ dist/pwa NÃO encontrada. Verificando pasta 'public'...`);
    }
} else {
    console.error(`[Server] ❌ Pasta 'dist' não encontrada! Certifique-se de que o build foi concluído.`);
}

if (fs.existsSync(publicPwaPath)) {
    console.log(`[Server] ✅ public/pwa disponível (fallback). Arquivos: ${fs.readdirSync(publicPwaPath).join(', ')}`);
}

// --- CONFIGURAÇÃO DE MIDDLEWARES ---
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// --- SERVIR FRONTEND (STATIC ASSETS) ---
// 1. Prioridade: Pasta dist (build oficial)
app.use(express.static(distPath));

// 2. Fallback: Pasta pwa na public (para ícones gerados no runtime pelo script generate-pwa-icons)
// Isso resolve o 404 caso o build não tenha incluído os ícones gerados após o 'npm run build'
app.use('/pwa', express.static(publicPwaPath));

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
    // 1. Bloqueio para chamadas de API inexistentes
    if (req.url.startsWith('/api/')) {
        return res.status(404).json({ error: "API Endpoint not found" });
    }

    // 2. PROTEÇÃO DE ASSETS:
    // Se o request pede um arquivo (tem extensão .png, .jpg, .json, etc)
    // e o express.static não o encontrou acima, retornamos 404 real.
    const ext = path.extname(req.url);
    if (ext && ext !== '.html') {
        // Tentativa final de busca direta antes do 404 (para caminhos complexos)
        const possiblePath = path.join(distPath, req.path);
        if (fs.existsSync(possiblePath)) {
            return res.sendFile(possiblePath);
        }
        return res.status(404).send('File not found');
    }

    // 3. Fallback apenas para rotas de navegação (ex: /dashboard, /upload)
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(500).send('Frontend not built. Please run npm run build.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[IdentificaPix Server] Running on port ${PORT}`);
    console.log(`[IdentificaPix Server] Static root: ${distPath}`);
});
