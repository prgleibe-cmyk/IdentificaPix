
import express from 'express';
import { fetchGmailMessages, extractTransactionsFromEmails, convertToCsv } from '../../services/serverHelpers.js';

const router = express.Router();

export default (ai) => {
    router.post('/sync', async (req, res) => {
        if (!ai) return res.status(500).json({ error: "Serviço de IA não configurado no servidor." });
        
        const { accessToken } = req.body;
        if (!accessToken) return res.status(400).json({ error: "Token de acesso não fornecido." });

        try {
            console.log("[Gmail Route] Iniciando sincronização...");
            
            const emails = await fetchGmailMessages(
                accessToken, 
                'subject:(pix OR transferência OR comprovante OR recebido OR enviado OR pagamento OR débito OR crédito OR extrato OR aviso OR notificação)',
                400
            );

            if (emails.length === 0) return res.json({ csv: "", count: 0 });

            const transactions = await extractTransactionsFromEmails(ai, emails);
            const csvContent = convertToCsv(transactions);

            res.json({ 
                csv: csvContent, 
                count: transactions.length 
            });

        } catch (error) {
            console.error("[Gmail Route] Erro:", error);
            res.status(500).json({ error: "Erro ao processar e-mails: " + error.message });
        }
    });

    return router;
};
