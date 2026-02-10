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
import inboxRoutes from './backend/routes/inbox.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- CONFIGURAÇÃO DE MIDDLEWARES ---
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Rota de Health Check para o Coolify detectar que o container está vivo
app.get('/health', (req, res) => res.status(200).send('OK'));

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// --- INICIALIZAÇÃO IA (GEMINI) ---
let ai = null;
if (process.env.API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    console.log("[IdentificaPix] Gemini AI Initialized.");
  } catch (e) {
    console.error("[IdentificaPix] Failed to init Gemini SDK", e.message);
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
  const indexPath = path.join(distPath, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  
  // Se o frontend não foi buildado, mostra erro informativo mantendo o servidor vivo para o Coolify
  res.status(200).send(`
    <html>
      <head><title>IdentificaPix Server</title></head>
      <body style="background:#051024;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;padding:40px;border:1px solid rgba(255,255,255,0.1);border-radius:30px;background:rgba(0,0,0,0.4);backdrop-filter:blur(10px);">
          <h1 style="color:#4285F4;margin-bottom:10px;">IdentificaPix Server v2.2</h1>
          <p style="opacity:0.8;font-size:18px;">Servidor Operacional na Porta 3001</p>
          <div style="margin-top:20px;padding:15px;background:rgba(234,67,53,0.1);border-radius:10px;color:#ff6b6b;font-weight:bold;">
             Aviso: A pasta 'dist' (frontend) não foi encontrada.<br>
             O comando 'npm run build' precisa ser executado antes do deploy.
          </div>
        </div>
      </body>
    </html>
  `);
});

// Porta 3001 conforme configurado no painel do Coolify
const PORT = 3001;

// CRÍTICO: Escutar em 0.0.0.0 é OBRIGATÓRIO para containers
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[IdentificaPix Server] RUNNING ON http://0.0.0.0:${PORT}`);
  console.log(`[IdentificaPix Server] HEALTH CHECK: http://0.0.0.0:${PORT}/health`);
});