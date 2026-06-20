import express from 'express';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { validateOwnerAccess } from '../lib/validateOwnerAccess.js';

const router = express.Router();

// Função robusta de parsing para limpar e extrair dados de SMS sem IA
function parseSMS(text) {
    let amount = 0;
    let description = "NOTIFICACAO SMS";
    let type = "income"; // default
    let date = new Date().toISOString().split('T')[0]; // default para hoje

    const normalizedText = text.replace(/\s+/g, ' ');

    // 1. EXTRAÇÃO DE VALOR
    // Ex: "R$ 150,00", "R$1.250,55", "R$ 50", "R$ 5,00"
    const amountMatch = normalizedText.match(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2}|[0-9\.]+)/i);
    if (amountMatch) {
        let rawAmount = amountMatch[1];
        if (rawAmount.includes(',') && rawAmount.includes('.')) {
            rawAmount = rawAmount.replace(/\./g, '').replace(',', '.');
        } else if (rawAmount.includes(',')) {
            rawAmount = rawAmount.replace(',', '.');
        }
        const parsed = parseFloat(rawAmount);
        if (!isNaN(parsed)) {
            amount = parsed;
        }
    }

    // 2. TIPO DE TRANSAÇÃO (INCOME / EXPENSE)
    const upperText = normalizedText.toUpperCase();
    if (
        upperText.includes("RECEB") || 
        upperText.includes("DEPOSIT") || 
        upperText.includes("CREDIT") || 
        upperText.includes("ENTRADA") ||
        upperText.includes("VCE RECEBEU") ||
        upperText.includes("VOCE RECEBEU") ||
        upperText.includes("CONTA POUPANCA CREDITADO")
    ) {
        type = "income";
    } else if (
        upperText.includes("ENVIA") || 
        upperText.includes("PAGAM") || 
        upperText.includes("PAGO") || 
        upperText.includes("DEBIT") || 
        upperText.includes("TRANSF") || 
        upperText.includes("SAIDA") || 
        upperText.includes("COMPRA") ||
        upperText.includes("SAÍDA")
    ) {
        type = "expense";
    }

    // 3. EXTRAÇÃO DE DATA
    const dateMatch = normalizedText.match(/(\d{2})\/(\d{2})\/(\d{4})/) || normalizedText.match(/(\d{2})\/(\d{2})\/(\d{2})/);
    if (dateMatch) {
        let day = dateMatch[1];
        let month = dateMatch[2];
        let year = dateMatch[3];
        if (year.length === 2) {
            year = "20" + year;
        }
        date = `${year}-${month}-${day}`;
    } else {
        const shortDateMatch = normalizedText.match(/(\d{2})\/(\d{2})/);
        if (shortDateMatch) {
            let day = shortDateMatch[1];
            let month = shortDateMatch[2];
            let year = new Date().getFullYear();
            date = `${year}-${month}-${day}`;
        }
    }

    // 4. EXTRAÇÃO DE NOME / DESCRIÇÃO (A MÁGICA DE PURIFICAÇÃO)
    let matchDesc = null;
    const patterns = [
        /recebido\s+de\s+([A-Z\s\u00C0-\u00FF]+?)(?:\s+no\s+valor|\s+em\s+|\s+para\s+|\s+\.|\s*R\$|\d|$)/i,
        /enviado\s+por\s+([A-Z\s\u00C0-\u00FF]+?)(?:\s+no\s+valor|\s+em\s+|\s+para\s+|\s+\.|\s*R\$|\d|$)/i,
        /enviado\s+para\s+([A-Z\s\u00C0-\u00FF]+?)(?:\s+no\s+valor|\s+em\s+|\s+para\s+|\s+\.|\s*R\$|\d|$)/i,
        /de\s+([A-Z\s\u00C0-\u00FF]+?)\s+em\s+\d{2}\/\d{2}/i,
        /de\s+([A-Z\s\u00C0-\u00FF]{3,30})(?:\s+em\s+|\s+no\s+valor|\s*R\$|\s*\.|\s*$)/i,
        /para\s+([A-Z\s\u00C0-\u00FF]{3,30})(?:\s+em\s+|\s+no\s+valor|\s*R\$|\s*\.|\s*$)/i,
    ];

    for (const pattern of patterns) {
        const m = normalizedText.match(pattern);
        if (m && m[1]) {
            let candidate = m[1].trim();
            candidate = candidate.replace(/^(UM|UMA|PIX|CONTA|POUPANCA|CORRENTE|VALOR|REAIS|EM|POR|PARA|DE)\s+/i, '');
            candidate = candidate.replace(/\s+(UM|UMA|PIX|CONTA|POUPANCA|CORRENTE|VALOR|REAIS|EM|POR|PARA|DE)$/i, '');
            if (candidate.length >= 3 && !/^\d+$/.test(candidate)) {
                description = candidate;
                break;
            }
        }
    }

    if (description === "NOTIFICACAO SMS") {
        let cleaned = normalizedText;
        cleaned = cleaned.replace(/^(SICOOB|SICREDI|BRADESCO|ITAU|CAIXA|INTER|NUBANK|BB|BANCO DO BRASIL):\s*/i, '');
        cleaned = cleaned.replace(/pix\s+(recebido|enviado|realizado|efetuado|pago)/i, '');
        cleaned = cleaned.replace(/(no\s+valor\s+de|valor:|R\$)\s*[0-9.,]+/i, '');
        cleaned = cleaned.replace(/(em|no\s+dia)\s*\d{2}\/\d{2}(\/\d{2,4})?/i, '');
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        cleaned = cleaned.replace(/^(de|para|por)\s+/i, '');
        cleaned = cleaned.replace(/\s+(de|para|por)$/i, '');

        if (cleaned.length > 2) {
            description = cleaned;
        }
    }

    description = description
        .replace(/[\.\,\:\;\-\*]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        date,
        description: description.toUpperCase(),
        amount,
        type
    };
}

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

        if (req.user) {
            validateOwnerAccess(req, userId);
        }

        if (!supabaseAdmin) return res.status(500).json({ error: "Conexão com banco de dados não configurada." });
        if (!text) return res.status(400).json({ error: "Conteúdo da mensagem vazio" });

        try {
            console.log(`[Inbox API] Processando notificação deterministicamente para Usuário: ${userId}`);

            const data = parseSMS(text);

            console.log(`[Inbox API] SMS extraído com sucesso:`, JSON.stringify(data));

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

            res.json({ success: true, message: "Transação recebida e salva com sucesso!" });

        } catch (error) {
            console.error("[Inbox API] Erro no processamento determinístico:", error.message);
            res.status(500).json({ error: error.message || "Falha ao processar notificação bancária." });
        }
    });

    return router;
};