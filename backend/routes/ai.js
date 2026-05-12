
import express from 'express';
import { generateAiSuggestion } from '../../services/serverHelpers.js';

const router = express.Router();

// Controle simples de rate limiting em memória por usuário
const userRequests = {};
const RATE_LIMIT = 10; // 10 requisições
const TIME_WINDOW = 60 * 1000; // por minuto

const aiRateLimiter = (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();

    const now = Date.now();
    if (!userRequests[userId]) userRequests[userId] = [];
    
    // Remove registros antigos da janela de tempo
    userRequests[userId] = userRequests[userId].filter(time => now - time < TIME_WINDOW);

    if (userRequests[userId].length >= RATE_LIMIT) {
        return res.status(429).json({ error: "Limite de uso da IA atingido. Tente novamente em 1 minuto." });
    }

    userRequests[userId].push(now);
    next();
};

export default (ai) => {
    router.use(aiRateLimiter);

    router.post('/suggestion', async (req, res) => {
        if (!ai) return res.status(500).json({ error: "Serviço de IA não configurado." });
        
        try {
            const { transactionDescription, contributorNames } = req.body;
            const text = await generateAiSuggestion(ai, transactionDescription, contributorNames);
            res.json({ text });
        } catch (error) { 
            console.error("[AI Route] Erro na sugestão:", error);
            res.status(500).json({ error: error.message || 'Erro na IA ao gerar sugestão.' }); 
        }
    });

    // Placeholder para futuras rotas de extração direta de texto/OCR via backend
    router.post('/extract-data', async (req, res) => {
        res.status(501).json({ error: "A extração visual é processada preferencialmente no client-side v3." });
    });

    return router;
};
