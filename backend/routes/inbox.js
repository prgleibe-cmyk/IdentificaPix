import express from 'express';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { validateOwnerAccess } from '../lib/validateOwnerAccess.js';

const router = express.Router();

export default (ai) => {
    router.post('/:userId/:bankId', async (req, res) => {
        const apiKey = req.headers['x-api-key'];
        const validKey = process.env.INBOX_API_KEY;

        if (!apiKey || apiKey !== validKey) {
            return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
        }

        const { userId, bankId } = req.params;
        const { text } = req.body;
        const supabaseAdmin = getSupabaseAdmin();

        // Validação IDOR: Garantir que o usuário autenticado é o dono dos dados
        // Se req.user existir (rota autenticada), validamos o ID.
        // Se não existir, permitimos (webhook externo sem token).
        if (req.user) {
            // Verificação de segurança centralizada (IDOR Protection)
            validateOwnerAccess(req, userId);
        }

        if (!ai) return res.status(500).json({ error: "IA não configurada no servidor." });
        if (!supabaseAdmin) return res.status(500).json({ error: "Conexão com banco de dados não configurada." });
        if (!text) return res.status(400).json({ error: "Conteúdo da mensagem vazio" });

        try {
            console.log(`[Inbox API] Processando notificação para Usuário: ${userId}`);

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: `Analise esta notificação bancária: "${text}".
                Extraia o nome da pessoa (pagador ou recebedor), a data e o valor.
                REGRAS:
                - O nome deve ser limpo de termos como "PIX", "RECEBIDO", "PARA".
                - Se for entrada de dinheiro, type é "income". Se for saída/pagamento, type é "expense".
                - Retorne APENAS um JSON: { "date": "YYYY-MM-DD", "description": "NOME LIMPO", "amount": 0.00, "type": "income|expense" }`,
                config: {
                    temperature: 0,
                    responseMimeType: "application/json"
                }
            });

            const data = JSON.parse(response.text);

            const rowHash = `sms_${userId}_${bankId}_${data.date}_${data.amount}_${data.description.substring(0, 10).replace(/\s/g, '')}`;

            const { error } = await supabaseAdmin
                .from('consolidated_transactions')
                .insert({
                    user_id: userId,
                    bank_id: bankId,
                    transaction_date: data.date,
                    description: data.description.toUpperCase(),
                    amount: data.amount,
                    type: data.type,
                    source: 'inbox',
                    status: 'pending',
                    pix_key: 'AUTO_SMS',
                    row_hash: rowHash
                });

            if (error) {
                if (error.code === '23505') {
                    return res.json({ success: true, message: "Transação já registrada." });
                }
                throw error;
            }

            res.json({ success: true, message: "Transação injetada na Lista Viva" });

        } catch (error) {
            console.error("[Inbox API] Erro no processamento:", error.message);
            res.status(error.status || 500).json({ error: error.message || "Falha ao processar notificação via IA." });
        }
    });

    return router;
};