
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import path from 'url';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pathModule from 'path';

// Importação das rotas modulares
import gmailRoutes from './backend/routes/gmail.js';
import paymentRoutes from './backend/routes/payments.js';
import aiRoutes from './backend/routes/ai.js';
import inboxRoutes from './backend/routes/inbox.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);

const app = express();

// --- CONFIGURAÇÃO DE MIDDLEWARES ---
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Rota de Health Check para o Coolify detectar que o server está vivo
app.get('/health', (req, res) => res.status(200).send('OK'));

const distPath = pathModule.join(__dirname, 'dist');
app.use(express.static(distPath));

// --- INICIALIZAÇÃO IA (GEMINI) ---
let ai = null;
if (process.env.API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    console.log("[Server] Gemini AI Initialized.");
  } catch (e) {
    console.error("[Server] Failed to init Gemini SDK", e.message);
  }
}

// --- ROTAS DA API ---
app.use('/api/gmail', gmailRoutes(ai));
app.use('/api/payment', paymentRoutes);
app.use('/api/ai', aiRoutes(ai));
app.use('/api/inbox', inboxRoutes(ai));

// --- SPA FALLBACK ---
app.get('*', (req, res) => {
  if (req.url.startsWith('/api/')) return res.status(404).end();
  const indexPath = pathModule.join(distPath, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  
  // Se o frontend não foi buildado, mostra erro amigável
  res.status(500).send(`
    <html>
      <body style="background:#051024;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;padding:20px;border:1px solid rgba(255,255,255,0.1);border-radius:20px;background:rgba(0,0,0,0.2);">
          <h1 style="color:#4285F4;">IdentificaPix Server</h1>
          <p style="opacity:0.8;">O servidor está ativo na porta 3001.</p>
          <p style="color:#ea4335;font-weight:bold;">Aviso: Pasta 'dist' não encontrada. Execute o build do frontend.</p>
        </div>
      </body>
    </html>
  `);
});

// Porta configurada para 3001 conforme especificado no Coolify
const PORT = process.env.PORT || 3001;

// CRÍTICO: Escutar em 0.0.0.0 é obrigatório para containers
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[IdentificaPix Server] Listening on http://0.0.0.0:${PORT}`);
});
