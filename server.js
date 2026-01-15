
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { 
    fetchGmailMessages, 
    extractTransactionsFromEmails,
    convertToCsv, 
    generateAiSuggestion, 
    createMockPayment, 
    getMockPaymentStatus 
} from './services/serverHelpers.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// --- SERVIR FRONTEND ESTÁTICO ---
app.use(express.static(path.join(__dirname, 'dist')));

// A chave de API DEVE ser obtida de process.env.API_KEY.
let ai;
try {
    if (!process.env.API_KEY) {
        console.error("CRITICAL: Gemini API Key is missing from environment variables.");
    } else {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
} catch (e) {
    console.error("Failed to initialize GoogleGenAI client:", e.message);
}

// --- ROTAS DA API ---

// ROTA PRINCIPAL: Sincronização Gmail -> CSV
app.post('/api/gmail/sync', async (req, res) => {
    if (!ai) return res.status(500).json({ error: "Serviço de IA não configurado." });
    
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: "Token de acesso não fornecido." });

    try {
        console.log("[Gmail] Iniciando sincronização...");
        
        // 1. Buscar E-mails (Filtro Bancário Otimizado)
        const emails = await fetchGmailMessages(
            accessToken, 
            'subject:(pix OR transferência OR comprovante OR recebido OR enviado OR pagamento OR débito OR crédito OR extrato OR aviso OR notificação)',
            400 // Busca os últimos 400 emails (Alta capacidade para eventos)
        );

        if (emails.length === 0) return res.json({ csv: "", count: 0 });

        // 2. Extrair Transações com IA
        const transactions = await extractTransactionsFromEmails(ai, emails);
        
        // 3. Converter para CSV no Backend (O Frontend recebe o arquivo pronto)
        const csvContent = convertToCsv(transactions);

        res.json({ 
            csv: csvContent, 
            count: transactions.length 
        });

    } catch (error) {
        console.error("[Gmail] Erro no processamento:", error);
        res.status(500).json({ error: "Erro ao processar e-mails: " + error.message });
    }
});

// Rotas existentes (Legado/Mock)
app.post('/api/ai/extract-data', async (req, res) => { /* ... mantido ... */ });

app.post('/api/ai/suggestion', async (req, res) => {
    if (!ai) {
        return res.status(500).json({ error: "Serviço de IA não configurado." });
    }
    try {
        const { transactionDescription, contributorNames } = req.body;
        const text = await generateAiSuggestion(ai, transactionDescription, contributorNames);
        res.json({ text });
    } catch (error) { 
        console.error("Erro na sugestão IA (backend):", error);
        res.status(500).json({ error: error.message || 'Erro na IA ao gerar sugestão.' }); 
    }
});

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

app.post('/api/payment/create', async (req, res) => {
    try {
        const responseData = await createMockPayment(req.body);
        res.json(responseData);
    } catch (error) {
        console.error("Erro no mock de pagamento:", error);
        res.status(500).json({ error: "Erro ao processar pagamento simulado." });
    }
});

app.get('/api/payment/status/:id', async (req, res) => {
    try {
        const responseData = await getMockPaymentStatus(req.params.id);
        res.json(responseData);
    } catch (error) {
        console.error("Erro no status de pagamento:", error);
        res.status(500).json({ error: "Erro ao verificar status." });
    }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
