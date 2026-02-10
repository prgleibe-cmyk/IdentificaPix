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

// 1. MIDDLEWARES BÁSICOS
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 2. HEALTH CHECK (Prioridade para o Coolify detectar que o app está vivo)
app.get('/health', (req, res) => res.status(200).send('OK'));

// 3. INICIALIZAÇÃO DA IA
let ai = null;
if (process.env.API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        console.log("[IdentificaPix] Gemini AI Pronto.");
    } catch (e) {
        console.error("[IdentificaPix] Erro IA:", e.message);
    }
}

// 4. ROTAS DA API
app.use('/api/gmail', gmailRoutes(ai));
app.use('/api/payment', paymentRoutes);
app.use('/api/ai', aiRoutes(ai));
app.use('/api/inbox', inboxRoutes(ai));

// 5. SERVIÇO DE ARQUIVOS ESTÁTICOS (FRONTEND)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// 6. SPA FALLBACK
app.get('*', (req, res) => {
    if (req.url.startsWith('/api/')) {
        return res.status(404).json({ error: 'Endpoint não encontrado' });
    }

    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    
    // Fallback amigável
    res.status(200).send(`
        <html>
            <body style="background:#051024;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                <div style="text-align:center;padding:40px;border:1px solid rgba(255,255,255,0.1);border-radius:24px;background:rgba(255,255,255,0.05);">
                    <h1 style="color:#4285F4;">IdentificaPix v2.5</h1>
                    <p style="opacity:0.7;">Servidor Online na Porta 3001.</p>
                </div>
            </body>
        </html>
    `);
});

// 7. PORTA 3001 (Revertida conforme solicitado)
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[IdentificaPix] Rodando em http://0.0.0.0:${PORT}`);
});