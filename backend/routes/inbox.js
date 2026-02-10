
import express from 'express';
import { Type } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// No backend, idealmente usaríamos a SERVICE_ROLE_KEY para ignorar RLS, 
// mas para o teste usaremos as envs disponíveis.
const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export default (ai) => {
    router.post('/:userId/:bankId', async (req, res) => {
        const { userId, bankId } = req.params;
        const { text } = req.body;

        if (!ai) return res.status(500).json({ error: "IA não configurada" });
        if (!text) return res.status(400).json({ error: "Conteúdo da mensagem vazio" });

        try {
            console.log(`[Inbox API] Processando mensagem para Usuário: ${userId}`);

            // 1. Gemini Pro para extração de alta fidelidade
            // Usamos o modelo Pro para garantir que o nome do pagador seja isolado corretamente
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

            // 2. Hash anti-duplicidade (evita que o mesmo SMS processe duas vezes)
            const rowHash = `sms_${userId}_${bankId}_${data.date}_${data.amount}_${data.description.substring(0, 10).replace(/\s/g, '')}`;

            // 3. Inserção via Cliente Admin (Bypassing RLS)
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
                    return res.json({ success: true, message: "Transação já existia (duplicata)" });
                }
                throw error;
            }

            console.log(`[Inbox API] Sucesso: Transação de ${data.description} injetada.`);
            res.json({ success: true, message: "Transação injetada na Lista Viva" });

        } catch (error) {
            console.error("[Inbox API] Erro:", error.message);
            res.status(500).json({ error: "Falha ao processar notificação" });
        }
    });

    return router;
};
