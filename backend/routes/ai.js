
import express from 'express';
import { generateAiSuggestion } from '../../services/serverHelpers.js';

const router = express.Router();

export default (ai) => {
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
