
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

// Rota de Health Check para o Coolify detectar que o server está vivo
app.get('/health', (req, res) => res.status(200).send('OK'));

const distPath = path.join(__dirname, 'dist');
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
  const indexPath = path.join(distPath, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  
  // Se o frontend não foi buildado, mostra erro amigável
  res.status(500).send(`
    <html>
      <body style="background:#051024;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div style="text-align:center;">
          <h1>IdentificaPix Server Ativo</h1>
          <p>Erro: O diretório 'dist' não foi encontrado. Verifique o processo de build.</p>
        </div>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
// CRÍTICO: Escutar em 0.0.0.0 é obrigatório para containers
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[IdentificaPix Server] Listening on http://0.0.0.0:${PORT}`);
});
