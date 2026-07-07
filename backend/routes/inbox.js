import express from 'express';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { validateOwnerAccess } from '../lib/validateOwnerAccess.js';
import { authMiddleware } from '../middleware/auth.js';

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
        // Padrões específicos para Sicredi / Sicoob / etc (Push app notifications)
        /recebeu\s+um\s+pix\s+no\s+valor\s+de\s+r\$\s*[0-9.,]+\s+([a-z\s\u00c0-\u00ff0-9\.\-\/]{3,60})/i,
        /pagou\s+um\s+pix\s+no\s+valor\s+de\s+r\$\s*[0-9.,]+\s+([a-z\s\u00c0-\u00ff0-9\.\-\/]{3,60})/i,
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
            
            // Remove sufixos bancários comuns anexados no final do nome do pagador para deixar o nome limpo
            candidate = candidate.replace(/\s+(NEON PAGAMENTOS|NU PAGAMENTOS|PICPAY|CREDISIS|BRADESCO|ITAU|ITAÚ|CAIXA ECONOMICA|CAIXA ECONÔMICA|BANCO DO BRASIL|BCO DO BRASIL|SANDER|SANTANDER|SICOOB|SICREDI|PAGSEGURO|PAGBANK|MERCADO PAGO|STONE|INTER|NUBANK|BANCO|COOPERATIVO|COOP\s).*$/i, '');
            
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

// Middleware personalizado para consumir o corpo da requisição de forma resiliente
// Isso previne quebras causadas por novos caracteres de linha do MacroDroid inseridos no JSON
const resilientBodyParser = (req, res, next) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
        data += chunk;
    });
    req.on('end', () => {
        req.rawBody = data;
        if (data) {
            try {
                // Tenta o parsing padrão JSON primeiro
                req.body = JSON.parse(data);
            } catch (e) {
                console.log('[Resilient Parser] JSON.parse falhou (provavelmente devido a quebras de linha do MacroDroid). Reparando...');
                
                // Padrão 1: Tentar extrair o campo "text" via regex lidando com quebras de linha internas [\s\S]*?
                const textMatch = data.match(/"text"\s*:\s*"([\s\S]*?)"\s*}/) || data.match(/"text"\s*:\s*"([\s\S]*?)"/);
                if (textMatch) {
                    req.body = { text: textMatch[1] };
                    console.log('[Resilient Parser] Texto extraído via Regex com sucesso!');
                } else {
                    // Padrão 2: Se não houver campo "text" estruturado, tenta decodificar como formulário x-www-form-urlencoded
                    if (data.includes('=')) {
                        try {
                            const params = new URLSearchParams(data);
                            const parsed = {};
                            for (const [key, value] of params.entries()) {
                                parsed[key] = value;
                            }
                            req.body = parsed;
                            console.log('[Resilient Parser] Decodificado como Form URL Encoded');
                        } catch (err) {
                            req.body = { text: data };
                        }
                    } else {
                        // Fallback final: define o corpo inteiro como a mensagem de texto
                        req.body = { text: data };
                        console.log('[Resilient Parser] Fallback: Definido corpo bruto como texto');
                    }
                }
            }
        } else {
            req.body = {};
        }
        next();
    });
};

export default (ai) => {
    router.get('/config', authMiddleware, (req, res) => {
        res.json({ key: process.env.INBOX_API_KEY || '' });
    });

    router.post('/:userId/:bankId', resilientBodyParser, async (req, res) => {
        let { userId, bankId } = req.params;
        const rawApiKey = req.headers['x-api-key'] || req.query.key;
        const validKey = process.env.INBOX_API_KEY;

        // Resilient check if the provided API key matches the expected one (handling arrays or comma-separated strings from MacroDroid)
        let isAuthorized = false;
        if (validKey) {
            if (Array.isArray(rawApiKey)) {
                isAuthorized = rawApiKey.some(k => typeof k === 'string' && k.trim() === validKey.trim());
            } else if (typeof rawApiKey === 'string') {
                const keys = rawApiKey.split(',').map(k => k.trim());
                isAuthorized = keys.includes(validKey.trim());
            }
        }

        // Resiliently extract the SMS body text from various potential payload keys or formats
        let text = req.body?.text || req.body?.texto || req.body?.message || req.body?.body || req.body?.sms || req.query?.text || req.query?.texto || req.query?.message;
        if (!text && typeof req.body === 'string') {
            text = req.body;
        } else if (!text && req.body && typeof req.body === 'object') {
            // Fallback for form-urlencoded or similar keys
            const keys = Object.keys(req.body);
            if (keys.length === 1 && req.body[keys[0]] === '') {
                // If it was posted as raw text but parsed awkwardly
                text = keys[0];
            }
        }

        // 🧽 Robust Sanitization of userId and bankId
        if (userId) {
            try {
                userId = decodeURIComponent(userId);
            } catch (e) {}
            userId = userId.replace(/[\s\r\n\t]+/g, '').trim();
        }
        if (bankId) {
            try {
                bankId = decodeURIComponent(bankId);
            } catch (e) {}
            bankId = bankId.replace(/[\s\r\n\t]+/g, '').trim();
        }

        console.log(`\n--- [INCOMING PIX NOTIFICATION] ---`);
        console.log(`[Inbox API] Recebido POST para usuário/owner: "${userId}"`);
        console.log(`[Inbox API] Banco destino (bank_id) original: "${req.params.bankId}" | Sanitizado: "${bankId}"`);
        console.log(`[Inbox API] Conteúdo recebido (text): "${text || '(vazio)'}"`);
        console.log(`[Inbox API] API Key fornecida: "${rawApiKey || '(ausente)'}" | API Key esperada no servidor: "${validKey || '(não configurada no .env)'}"`);

        if (!isAuthorized) {
            console.warn(`[Inbox Warning] ❌ Unauthorized: Chave de API inválida ou ausente.`);
            console.warn(`[Inbox Warning] Certifique-se de que a variável INBOX_API_KEY está configurada no seu arquivo .env e coincide com a usada no celular.`);
            return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // 🧠 Auto-correction index / bank match fallback for truncated UUIDs in iOS Shortcuts
        if (bankId && bankId.length < 36 && supabaseAdmin && userId) {
            console.log(`[Inbox API] 🔍 bankId recebido de tamanho ${bankId.length} ("${bankId}"). Tentando auto-completar com as contas cadastradas do usuário...`);
            try {
                const { data: bList } = await supabaseAdmin
                    .from('banks')
                    .select('id, name')
                    .eq('user_id', userId);
                
                if (bList && bList.length > 0) {
                    const match = bList.find(b => b.id.toLowerCase().startsWith(bankId.toLowerCase()) || bankId.toLowerCase().startsWith(b.id.toLowerCase()));
                    if (match) {
                        console.log(`[Inbox API] 🩹 AUTO-AJUSTE: bankId inválido/truncado ("${bankId}") auto-corrigido para o banco: "${match.name}" (ID Real: "${match.id}")`);
                        bankId = match.id;
                    } else {
                        console.warn(`[Inbox API] ⚠️ Nenhuma conta do usuário inicia com o prefixo "${bankId}"`);
                    }
                } else {
                    console.warn(`[Inbox API] ⚠️ Nenhuma conta ativa encontrada no Supabase para o usuário ${userId}`);
                }
            } catch (e) {
                console.error(`[Inbox API] Erro ao tentar auto-ajustar bankId:`, e.message);
            }
        }

        if (req.user) {
            validateOwnerAccess(req, userId);
        }

        if (!supabaseAdmin) {
            console.error(`[Inbox API] ❌ Erro: Conexão com banco de dados Supabase Admin não configurada.`);
            return res.status(500).json({ error: "Conexão com banco de dados não configurada." });
        }
        if (!text) {
            console.warn(`[Inbox API] ⚠️ Requisição de notificação barrada: Conteúdo de texto vazio.`);
            return res.status(400).json({ error: "Conteúdo da mensagem vazio" });
        }

        try {
            console.log(`[Inbox API] Iniciando processamento determinístico do SMS/Notificação...`);

            const data = parseSMS(text);

            console.log(`[Inbox API] SMS analisado com sucesso! Dados extraídos:`, JSON.stringify(data));

            if (data.amount === 0) {
                console.warn(`[Inbox API] ⚠️ Atenção: O valor parsed foi 0,00. Certifique-se de que o texto do SMS segue o formato esperado.`);
            }

            const rowHash = `sms_${userId}_${bankId}_${data.date}_${data.amount}_${data.description.substring(0, 10).replace(/\s/g, '')}`;

            console.log(`[Inbox API] Gravando transação no banco de dados VPS... (row_hash: ${rowHash})`);

            const defaultPort = process.env.PORT || '3000';
            const vpsUrl = process.env.CONTRIBUTORS_API_URL || (process.env.INTEGRATED_MODE === 'true' ? `http://127.0.0.1:${defaultPort}` : 'http://127.0.0.1:3010');
            const cleanVpsUrl = vpsUrl.endsWith('/') ? vpsUrl.slice(0, -1) : vpsUrl;

            const vpsResponse = await fetch(`${cleanVpsUrl}/api/v1/consolidated_transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    bank_id: bankId,
                    transaction_date: data.date,
                    description: data.description.toUpperCase(),
                    amount: data.amount,
                    type: data.type,
                    source: 'file', // Adjusted from 'inbox' to respect the database check constraint (file/gmail only)
                    status: 'pending',
                    pix_key: 'AUTO_SMS',
                    row_hash: rowHash
                })
            });

            if (vpsResponse.status === 409) {
                const resJson = await vpsResponse.json().catch(() => ({}));
                if (resJson.error === 'ROW_HASH_ALREADY_EXISTS') {
                    console.log(`[Inbox API] ℹ️ Transação já cadastrada no banco de dados anteriormente (VPS).`);
                    return res.json({ success: true, message: "Transação já registrada." });
                }
            }

            if (!vpsResponse.ok) {
                const errText = await vpsResponse.text().catch(() => '');
                console.error(`[Inbox API] ❌ Erro ao inserir transação no banco VPS: Status ${vpsResponse.status} - ${errText}`);
                throw new Error(`Erro ao salvar transação na VPS (Status ${vpsResponse.status})`);
            }

            console.log(`[Inbox API] ✅ Transação registrada com sucesso no banco de dados VPS!`);
            res.json({ success: true, message: "Transação recebida e salva com sucesso!" });

        } catch (error) {
            console.error("[Inbox API] ❌ Erro no processamento do webhook:", error.message);
            res.status(500).json({ error: error.message || "Falha ao processar notificação bancária." });
        }
    });

    return router;
};