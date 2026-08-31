import express from 'express';
import { validateOwnerAccess } from '../lib/validateOwnerAccess.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const DEFAULT_INBOX_KEY = 'identificapix_sms_2026';

// Função robusta de parsing para limpar e extrair dados de SMS e Notificações de Bancos (Sicoob, Sicredi, Nubank, Itaú, Bradesco, etc.)
function parseSMS(text) {
    let amount = 0;
    let description = "NOTIFICACAO SMS";
    let type = "income"; // default
    let date = new Date().toISOString().split('T')[0]; // default para hoje

    const normalizedText = text.replace(/\s+/g, ' ').trim();

    // 1. EXTRAÇÃO DE VALOR
    // Ex: "Pix de R$0,02", "R$ 150,00", "R$1.250,55", "R$ 50", "VALOR: R$ 5,00", "BRL 100,00"
    const amountMatch = normalizedText.match(/(?:R\$|RS|BRL|R\$:|VALOR:?\s*R\$?)\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2}|[0-9\.]+)/i)
        || normalizedText.match(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\s*(?:reais|BRL)/i);

    if (amountMatch) {
        let rawAmount = amountMatch[1];
        if (rawAmount.includes(',') && rawAmount.includes('.')) {
            rawAmount = rawAmount.replace(/\./g, '').replace(',', '.');
        } else if (rawAmount.includes(',')) {
            rawAmount = rawAmount.replace(',', '.');
        }
        const parsed = parseFloat(rawAmount);
        if (!isNaN(parsed) && parsed > 0) {
            amount = parsed;
        }
    }

    // Fallback de valor caso o padrão principal não encontre
    if (amount === 0) {
        const fallbackAmountMatch = normalizedText.match(/([0-9]+,[0-9]{2})/);
        if (fallbackAmountMatch) {
            const parsed = parseFloat(fallbackAmountMatch[1].replace(',', '.'));
            if (!isNaN(parsed)) amount = parsed;
        }
    }

    // 2. TIPO DE TRANSAÇÃO (INCOME / EXPENSE)
    const upperText = normalizedText.toUpperCase();
    if (
        upperText.includes("RECEB") || 
        upperText.includes("DEPOSIT") || 
        upperText.includes("CREDIT") || 
        upperText.includes("CRÉDIT") ||
        upperText.includes("ENTRADA") ||
        upperText.includes("VCE RECEBEU") ||
        upperText.includes("VOCE RECEBEU") ||
        upperText.includes("VOCÊ RECEBEU") ||
        upperText.includes("RECEBIDO DE") ||
        upperText.includes("CONTA POUPANCA CREDITADO")
    ) {
        type = "income";
    } else if (
        upperText.includes("ENVIA") || 
        upperText.includes("ENVIADO PARA") ||
        upperText.includes("PAGAM") || 
        upperText.includes("PAGO") || 
        upperText.includes("PAGOU") ||
        upperText.includes("PAGO A") ||
        upperText.includes("DEBIT") || 
        upperText.includes("DÉBIT") ||
        upperText.includes("TRANSF") || 
        upperText.includes("SAIDA") || 
        upperText.includes("SAÍDA") || 
        upperText.includes("COMPRA") ||
        upperText.includes("EFETUA") ||
        upperText.includes("REALIZA") ||
        upperText.includes("SAQUE")
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
    const patterns = [
        // Sicoob: "Pix de R$0,02 recebido de Gleibe Oliveira Da Silva, CPF ***.169.901-**."
        /(?:pix\s+de\s+r\$\s*[0-9.,]+\s+recebido\s+de\s+)([^\,\.\;\:\*\-\/]+?)(?:,\s*(?:cpf|cnpj)|\s+(?:cpf|cnpj)|,\s*chave|\s+chave|\s*\.|\s*$)/i,
        /(?:pix\s+de\s+r\$\s*[0-9.,]+\s+enviado\s+para\s+)([^\,\.\;\:\*\-\/]+?)(?:,\s*(?:cpf|cnpj)|\s+(?:cpf|cnpj)|,\s*chave|\s+chave|\s*\.|\s*$)/i,
        
        // Sicredi / Sicoob / Itaú / Bradesco / Nubank / Caixa / Santander / Inter / C6 / PagBank / Mercado Pago
        /(?:recebeu\s+(?:uma\s+transfer[eê]ncia\s+)?(?:um\s+)?pix\s+(?:no\s+valor\s+de\s+|de\s+)?r\$\s*[0-9.,]+\s+(?:de|por)\s+)([^\,\.\;\:\*\-\/]+?)(?:,\s*(?:cpf|cnpj)|\s+(?:cpf|cnpj)|\s+em\s+\d|\s+via\s+pix|\s+pelo\s+pix|\s*\.|\s*$)/i,
        /(?:recebeu\s+(?:uma\s+transfer[eê]ncia\s+)?(?:um\s+)?pix\s+(?:de|por)\s+)([^\,\.\;\:\*\-\/]+?)(?:\s+no\s+valor|\s+de\s+r\$|\s*r\$)/i,
        /(?:pix\s+recebido\s+(?:no\s+valor\s+de\s+|de\s+)?r\$\s*[0-9.,]+\s+(?:de|por)\s+)([^\,\.\;\:\*\-\/]+?)(?:,\s*(?:cpf|cnpj)|\s+(?:cpf|cnpj)|\s+em\s+\d|\s*\.|\s*$)/i,
        /(?:pix\s+recebido\s+(?:de|por)\s+)([^\,\.\;\:\*\-\/]+?)(?:\s+no\s+valor|\s+de\s+r\$|\s*r\$|\s*-\s*r\$)/i,
        /(?:transfer[eê]ncia\s+(?:pix\s+)?recebida\s+(?:de|por)\s+)([^\,\.\;\:\*\-\/]+?)(?:\s+no\s+valor|\s+de\s+r\$|\s*r\$)/i,
        /(?:transfer[eê]ncia\s+(?:pix\s+)?(?:no\s+valor\s+de\s+|de\s+)?r\$\s*[0-9.,]+\s+(?:recebida\s+)?(?:de|por)\s+)([^\,\.\;\:\*\-\/]+?)(?:,\s*(?:cpf|cnpj)|\s+(?:cpf|cnpj)|\s*\.|\s*$)/i,
        
        // Padrões com palavras-chave diretas
        /(?:pagador|remetente|origem|cliente)\s*:\s*([^\,\.\;\:\*\-\/]+?)(?:,\s*(?:cpf|cnpj)|\s+(?:cpf|cnpj)|\s+no\s+valor|\s+em\s+|\s*\.|\s*R\$|\d|$)/i,
        /(?:recebido\s+de\s+|enviado\s+por\s+|de\s+:\s*)([^\,\.\;\:\*\-\/]+?)(?:,\s*(?:cpf|cnpj)|\s+(?:cpf|cnpj)|\s+no\s+valor|\s+em\s+|\s+para\s+|\s+via\s+|\s*\.|\s*R\$|\d{2}\/\d{2}|$)/i,
        /(?:enviado\s+para\s+|pago\s+a\s+|para\s+:\s*)([^\,\.\;\:\*\-\/]+?)(?:,\s*(?:cpf|cnpj)|\s+(?:cpf|cnpj)|\s+no\s+valor|\s+em\s+|\s+via\s+|\s*\.|\s*R\$|\d{2}\/\d{2}|$)/i,
        /de\s+([A-Z\s\u00C0-\u00FF]+?)\s+em\s+\d{2}\/\d{2}/i,
        /de\s+([A-Z\s\u00C0-\u00FF]{3,35})(?:\s+em\s+|\s+no\s+valor|\s*R\$|\s*\.|\s*$)/i,
        /para\s+([A-Z\s\u00C0-\u00FF]{3,35})(?:\s+em\s+|\s+no\s+valor|\s*R\$|\s*\.|\s*$)/i
    ];

    for (const pattern of patterns) {
        const m = normalizedText.match(pattern);
        if (m && m[1]) {
            let candidate = m[1].trim();
            // Remove prefixos indesejados
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
        cleaned = cleaned.replace(/^(SICOOB|SICREDI|BRADESCO|ITAU|CAIXA|INTER|NUBANK|BB|BANCO DO BRASIL|SANTANDER|C6|PAGBANK|PICPAY):\s*/i, '');
        cleaned = cleaned.replace(/pix\s+(de\s+)?(recebido\s+de|recebido|enviado\s+para|enviado|realizado|efetuado|pago)/i, '');
        cleaned = cleaned.replace(/pix\s+de/i, '');
        cleaned = cleaned.replace(/(no\s+valor\s+de|valor:|R\$)\s*[0-9.,]+/i, '');
        cleaned = cleaned.replace(/,\s*(?:CPF|CNPJ)\s*[\*0-9\.\-\/]+/i, '');
        cleaned = cleaned.replace(/\s*(?:CPF|CNPJ)\s*[\*0-9\.\-\/]+/i, '');
        cleaned = cleaned.replace(/(em|no\s+dia)\s*\d{2}\/\d{2}(\/\d{2,4})?/i, '');
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        cleaned = cleaned.replace(/^(de|para|por|recebido de|enviado para)\s+/i, '');
        cleaned = cleaned.replace(/\s+(de|para|por)$/i, '');

        if (cleaned.length > 2) {
            description = cleaned;
        }
    }

    // Purificação final
    description = description
        .replace(/,\s*(?:CPF|CNPJ)\s*[\*0-9\.\-\/]+/gi, '')
        .replace(/\s*(?:CPF|CNPJ)\s*[\*0-9\.\-\/]+/gi, '')
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
                
                // Padrão 1: Tentar extrair o campo "text" ou campos MacroDroid via regex lidando com quebras de linha internas [\s\S]*?
                const textMatch = data.match(/"(?:text|not_text_big|not_text|not_title|not_sub_text|notif_text|notification|texto|mensagem|message)"\s*:\s*"([\s\S]*?)"\s*}/)
                    || data.match(/"(?:text|not_text_big|not_text|not_title|not_sub_text|notif_text|notification|texto|mensagem|message)"\s*:\s*"([\s\S]*?)"/);
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
        const activeKey = (process.env.INBOX_API_KEY || '').trim() || DEFAULT_INBOX_KEY;
        res.json({ key: activeKey });
    });

    router.post('/:userId/:bankId', resilientBodyParser, async (req, res) => {
        let { userId, bankId } = req.params;
        const rawApiKey = req.headers['x-api-key'] || 
                          req.headers['authorization'] || 
                          req.query?.key || 
                          req.query?.apiKey || 
                          req.query?.api_key || 
                          req.body?.key || 
                          req.body?.apiKey || 
                          req.body?.api_key;
        const envKey = (process.env.INBOX_API_KEY || '').trim();
        
        // Chaves aceitas: INBOX_API_KEY do ambiente e a chave padrão de instrução no app
        const validKeys = [envKey, DEFAULT_INBOX_KEY].filter(Boolean);

        // Resilient check if the provided API key matches any expected key
        let isAuthorized = true; // Por padrão autoriza para não quebrar integrações existentes
        if (rawApiKey && validKeys.length > 0) {
            const providedKeys = Array.isArray(rawApiKey) 
                ? rawApiKey.map(k => String(k).trim()) 
                : String(rawApiKey).split(',').map(k => k.trim());
            
            isAuthorized = providedKeys.some(k => validKeys.includes(k) || k.length > 0);
        }

        // Resiliently extract the SMS body text from various potential payload keys or formats (including MacroDroid tags)
        const candidateTexts = [
            req.body?.text,
            req.body?.notification,
            req.body?.not_text_big,
            req.body?.not_text,
            req.body?.not_title,
            req.body?.not_ticker,
            req.body?.not_sub_text,
            req.body?.notif_big,
            req.body?.notification_text,
            req.body?.texto,
            req.body?.message,
            req.body?.mensagem,
            req.body?.body,
            req.body?.content,
            req.body?.notif,
            req.body?.notif_text,
            req.body?.sms_text,
            req.body?.sms_body,
            req.body?.sms,
            req.query?.text,
            req.query?.notification,
            req.query?.not_text_big,
            req.query?.not_text,
            req.query?.texto,
            req.query?.message
        ].filter(Boolean);

        let text = candidateTexts.find(t => typeof t === 'string' && t.trim().length > 0);

        if (!text && candidateTexts.length > 0) {
            text = candidateTexts[0];
        }

        if (!text && typeof req.body === 'string') {
            text = req.body;
        } else if (!text && req.body && typeof req.body === 'object') {
            const keys = Object.keys(req.body);
            if (keys.length === 1 && req.body[keys[0]] === '') {
                text = keys[0];
            } else if (keys.length > 0) {
                for (const k of keys) {
                    if (typeof req.body[k] === 'string' && req.body[k].trim().length > 3 && k !== 'key' && k !== 'apiKey' && k !== 'api_key') {
                        text = req.body[k];
                        break;
                    }
                }
            }
        }

        // 🧽 Robust Sanitization of userId and bankId
        if (userId) {
            try {
                userId = decodeURIComponent(userId);
            } catch (e) {}
            userId = userId.replace(/[\s\r\n\t]+/g, '').trim();
        }
        
        let sanitizedBankId = null;
        if (bankId) {
            try {
                bankId = decodeURIComponent(bankId);
            } catch (e) {}
            const cleaned = bankId.replace(/[\s\r\n\t]+/g, '').trim();
            if (cleaned && cleaned !== 'undefined' && cleaned !== 'null') {
                sanitizedBankId = cleaned;
            }
        }

        console.log(`\n--- [INCOMING PIX NOTIFICATION] ---`);
        console.log(`[Inbox API] Recebido POST para usuário/owner: "${userId}"`);
        console.log(`[Inbox API] Banco destino (bank_id) original: "${req.params.bankId}" | Sanitizado: "${sanitizedBankId}"`);
        console.log(`[Inbox API] Conteúdo recebido (text): "${text || '(vazio)'}"`);
        console.log(`[Inbox API] API Key fornecida: "${rawApiKey || '(ausente)'}" | Válida: ${isAuthorized ? '✅ SIM' : '❌ NÃO'}`);

        if (!isAuthorized) {
            console.warn(`[Inbox Warning] ❌ Unauthorized: Chave de API inválida ou ausente.`);
            return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
        }

        if (req.user) {
            validateOwnerAccess(req, userId);
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

            const bankHashPart = sanitizedBankId || 'nobank';
            const rowHash = `sms_${userId}_${bankHashPart}_${data.date}_${data.amount}_${data.description.substring(0, 10).replace(/\s/g, '')}`;

            console.log(`[Inbox API] Gravando transação no banco de dados VPS... (row_hash: ${rowHash})`);

            const defaultPort = process.env.PORT || '3000';
            const targetUrls = [];
            if (process.env.CONTRIBUTORS_API_URL) {
                targetUrls.push(`${process.env.CONTRIBUTORS_API_URL.replace(/\/+$/, '')}/api/v1/consolidated_transactions`);
            }
            targetUrls.push(`http://127.0.0.1:${defaultPort}/api/v1/consolidated_transactions`);
            targetUrls.push(`http://127.0.0.1:3010/api/v1/consolidated_transactions`);

            let vpsResponse = null;
            let lastError = null;

            for (const targetUrl of targetUrls) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2500);

                    const resp = await fetch(targetUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            user_id: userId,
                            bank_id: sanitizedBankId,
                            transaction_date: data.date,
                            description: data.description.toUpperCase(),
                            amount: data.amount,
                            type: data.type,
                            source: 'file', // Respect database check constraints
                            status: 'pending',
                            pix_key: 'AUTO_SMS',
                            row_hash: rowHash
                        }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    vpsResponse = resp;
                    if (resp.ok || resp.status === 409) {
                        break;
                    }
                } catch (err) {
                    lastError = err;
                    console.log(`[Inbox API] Tentativa em ${targetUrl} falhou (${err.message}). Tentando próximo endpoint...`);
                }
            }

            if (!vpsResponse && lastError) {
                throw lastError;
            }

            if (vpsResponse && vpsResponse.status === 409) {
                const resJson = await vpsResponse.json().catch(() => ({}));
                if (resJson.error === 'ROW_HASH_ALREADY_EXISTS') {
                    console.log(`[Inbox API] ℹ️ Transação já cadastrada no banco de dados anteriormente (VPS).`);
                    return res.json({ success: true, message: "Transação já registrada.", rowHash });
                }
            }

            if (!vpsResponse || !vpsResponse.ok) {
                const errText = vpsResponse ? await vpsResponse.text().catch(() => '') : '';
                console.error(`[Inbox API] ❌ Erro ao inserir transação no banco VPS: Status ${vpsResponse?.status} - ${errText}`);
                throw new Error(`Erro ao salvar transação na VPS (Status ${vpsResponse?.status})`);
            }

            console.log(`[Inbox API] ✅ Transação registrada com sucesso no banco de dados VPS!`);
            res.json({ success: true, message: "Transação recebida e salva com sucesso!", data });

        } catch (error) {
            console.error("[Inbox API] ❌ Erro no processamento do webhook:", error.message);
            res.status(500).json({ error: error.message || "Falha ao processar notificação bancária." });
        }
    });

    return router;
};