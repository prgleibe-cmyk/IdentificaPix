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

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check para o Coolify detectar que o container está saudável
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

// Registro Seguro de Rotas
try {
    app.use('/api/gmail', gmailRoutes(ai));
    app.use('/api/payment', paymentRoutes);
    app.use('/api/ai', aiRoutes(ai));
    app.use('/api/inbox', inboxRoutes(ai));
    console.log("[IdentificaPix] API Routes Registered.");
} catch (error) {
    console.error("[IdentificaPix] Route Registration Error:", error.message);
}

// Pasta de arquivos estáticos (Vite build)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA Fallback: Serve o index.html para qualquer rota não mapeada (essencial para React Router)
app.get('*', (req, res) => {
    if (req.url.startsWith('/api/')) {
        return res.status(404).json({ error: 'API Endpoint Not Found' });
    }
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    res.status(200).send("IdentificaPix Server is Running. Frontend dist not found yet.");
});

// Porta 3000 (O padrão que funcionava perfeitamente)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[IdentificaPix] Servidor rodando na porta ${PORT}`);
});