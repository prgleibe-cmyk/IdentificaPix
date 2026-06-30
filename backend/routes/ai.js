
import express from 'express';
import { generateAiSuggestion } from '../../services/serverHelpers.js';
import { authMiddleware } from '../middleware/auth.js';


// 🛡️ PARSER RESILIENTE (BACKEND VERSION)
const safeJsonParse = (input, fallback = []) => {
    if (!input) return fallback;
    let sanitized = String(input).trim();
    
    sanitized = sanitized.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');

    const tryParse = (str) => {
        try {
            const parsed = JSON.parse(str);
            if (parsed.rows) return parsed.rows;
            if (parsed.transactions) return parsed.transactions;
            return Array.isArray(parsed) ? parsed : null;
        } catch { return null; }
    };

    let result = tryParse(sanitized);
    if (result) return result;

    let lastBrace = sanitized.lastIndexOf('}');
    const possibleClosures = ['', ']', ']}', '"}]}', '"}'];

    while (lastBrace > 0) {
        const base = sanitized.substring(0, lastBrace + 1);
        for (const closure of possibleClosures) {
            const candidate = base + closure;
            result = tryParse(candidate);
            if (result) return result;
        }
        lastBrace = sanitized.lastIndexOf('}', lastBrace - 1);
    }

    return fallback;
};

// Controle simples de rate limiting em memória por usuário
const userRequests = {};
const RATE_LIMIT = 30; // Aumentado para suportar o fluxo de extração
const TIME_WINDOW = 60 * 1000; // por minuto

const aiRateLimiter = (req, res, next) => {
    const userId = req.user?.id || 'anonymous';
    
    const now = Date.now();
    if (!userRequests[userId]) userRequests[userId] = [];
    
    userRequests[userId] = userRequests[userId].filter(time => now - time < TIME_WINDOW);

    if (userRequests[userId].length >= RATE_LIMIT) {
        return res.status(429).json({ error: "Limite de uso atingido. Tente novamente em 1 minuto." });
    }

    userRequests[userId].push(now);
    next();
};

export default (ai) => {
    const router = express.Router();
    router.use(authMiddleware);
    router.use(aiRateLimiter);

    router.post('/suggestion', async (req, res) => {
        try {
            const { transactionDescription, contributorNames } = req.body;
            const text = await generateAiSuggestion(null, transactionDescription, contributorNames);
            res.json({ text });
        } catch (error) { 
            console.error("[AI Route] Erro na sugestão determinística:", error);
            res.status(500).json({ error: error.message || 'Erro ao gerar sugestão local.' }); 
        }
    });

    // 🎯 MOTOR DE EXTRAÇÃO SEMÂNTICA (PROXY BACKEND - DESCONTINUADO EM FAVOR DO PROCESSADOR OFFLINE)
    router.post('/extract-transactions', async (req, res) => {
        try {
            // Retorna vazio pois o ContractExecutor agora roda localmente de forma determinística
            res.json({ rows: [] });
        } catch (error) {
            res.status(500).json({ error: 'Processador local de bloco ativo.' });
        }
    });

    // 📄 STRUCTURAL DUMP (PROXY BACKEND - DESCONTINUADO EM FAVOR DO PROCESSADOR OFFLINE)
    router.post('/structural-dump', async (req, res) => {
        try {
            res.json([]);
        } catch (error) {
            res.status(500).json({ error: "Processador de dump local ativo." });
        }
    });

    // 🧭 INFER MAPPING (PROXY BACKEND - DESCONTINUADO EM FAVOR DO PROCESSADOR OFFLINE)
    router.post('/infer-mapping', async (req, res) => {
        try {
            res.json({});
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // 🎓 LEARN PATTERN (PROXY BACKEND - DESCONTINUADO EM FAVOR DO PROCESSADOR OFFLINE)
    router.post('/learn-pattern', async (req, res) => {
        try {
            res.json({});
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
