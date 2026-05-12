
import express from 'express';
import { Type } from "@google/genai";
import { generateAiSuggestion } from '../../services/serverHelpers.js';


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
        return res.status(429).json({ error: "Limite de uso da IA atingido. Tente novamente em 1 minuto." });
    }

    userRequests[userId].push(now);
    next();
};

export default (ai) => {
    const router = express.Router();
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

    // 🎯 MOTOR DE EXTRAÇÃO SEMÂNTICA (PROXY BACKEND)
    router.post('/extract-transactions', async (req, res) => {
        if (!ai) return res.status(500).json({ error: "Serviço de IA não configurado." });
        
        try {
            const { rawText, modelContext, base64Data, limit } = req.body;

            const isPreview = !!limit;
            const limitInstruction = isPreview 
                ? `RESTRICAO: Apenas os primeiros ${limit} registros.`
                : `PROCESSAMENTO TOTAL: Extraia todos os dados sem exceção.`;

            const instruction = `VOCÊ É UM ROBÔ DE CÓPIA LITERAL (CÓPIA BIT-A-BIT). 
               Sua inteligência é avaliada pela fidelidade caractere-por-caractere com o documento original.
               
               --- CONTRATO DE EXTRAÇÃO (GABARITO ESTRUTURAL) ---
               ${modelContext}
               
               --- REGRAS DE OURO DE PRESERVAÇÃO ---
               1. FIDELIDADE TEXTUAL TOTAL: A 'description' deve ser copiada EXATAMENTE como aparece visualmente.
               2. DETECÇÃO DE SINAIS: Identifique se é Crédito ou Débito. Valores de saída (Débitos) devem ser SEMPRE negativos no JSON.
               3. FILTRAGEM: Extraia apenas as transações. Ignore headers de página e rodapés.
               ${limitInstruction}
               
               RETORNO OBRIGATÓRIO: JSON { "rows": [ { "date", "description", "amount", "forma", "tipo" } ] }`;

            const parts = [];
            if (base64Data) {
                parts.push({ inlineData: { data: base64Data, mimeType: 'application/pdf' } });
            } else {
                parts.push({ text: `CONTEÚDO PARA EXTRAÇÃO:\n${isPreview ? rawText.substring(0, 15000) : rawText}` });
            }
            parts.push({ text: instruction });

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview', 
                contents: { parts },
                config: {
                    temperature: 0,
                    maxOutputTokens: 96000, 
                    thinkingConfig: { thinkingBudget: 24000 },
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            rows: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        date: { type: Type.STRING },
                                        description: { type: Type.STRING },
                                        amount: { type: Type.NUMBER },
                                        forma: { type: Type.STRING },
                                        tipo: { type: Type.STRING }
                                    },
                                    required: ["date", "description", "amount", "forma", "tipo"]
                                }
                            }
                        },
                        required: ["rows"]
                    }
                }
            });
            
            res.json(safeJsonParse(response.text));
        } catch (error) {
            console.error("[AI Route] Erro na extração:", error);
            res.status(500).json({ error: error.message || 'Erro na IA ao extrair transações.' });
        }
    });

    // 📄 STRUCTURAL DUMP (PROXY BACKEND)
    router.post('/structural-dump', async (req, res) => {
        if (!ai) {
            console.error("[AI Route] Erro: Cliente Gemini não está inicializado.");
            return res.status(500).json({ error: "Serviço de IA não configurado." });
        }
        
        console.log("[AI Route] Iniciando structural-dump no backend...");
        try {
            const { base64Data } = req.body;
            if (!base64Data) {
                console.warn("[AI Route] structural-dump chamado sem base64Data.");
                throw new Error("Dados Base64 ausentes.");
            }

            console.log("[AI Route] Chamando Gemini (flash-preview) para structural-dump...");
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: {
                    parts: [
                        { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
                        { text: "Extraia cada linha visual do documento literal. Mantenha espaços e capitalização. Retorne JSON 'rawLines'." }
                    ]
                },
                config: {
                    temperature: 0,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            rawLines: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                    }
                }
            });

            console.log("[AI Route] Gemini respondeu structural-dump com sucesso.");
            if (!response.text) {
                console.warn("[AI Route] Gemini retornou texto vazio no structural-dump.");
            }

            const result = JSON.parse(response.text || '{"rawLines": []}');
            res.json(result.rawLines || []);
        } catch (error) {
            console.error("[AI Route] CRÍTICO - Erro structural-dump no backend:");
            console.error("- Mensagem:", error.message);
            if (error.response) {
                console.error("- Status Google:", error.response.status);
                console.error("- Detalhes:", JSON.stringify(error.response.data, null, 2));
            }
            if (error.stack) console.error("- Stack:", error.stack);
            
            res.status(500).json({ 
                error: error.message,
                diagnostics: {
                    type: "GEMINI_BACKEND_ERROR",
                    hasAuth: !!process.env.API_KEY || !!process.env.VITE_GEMINI_API_KEY
                }
            });
        }
    });

    // 🧭 INFER MAPPING (PROXY BACKEND)
    router.post('/infer-mapping', async (req, res) => {
        if (!ai) return res.status(500).json({ error: "Serviço de IA não configurado." });
        
        try {
            const { sampleText } = req.body;
            if (!sampleText) throw new Error("Texto de amostra ausente.");

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Analise este texto: ${sampleText.substring(0, 3000)}`,
                config: { 
                    temperature: 0, 
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            extractionMode: { type: Type.STRING },
                            dateColumnIndex: { type: Type.INTEGER },
                            descriptionColumnIndex: { type: Type.INTEGER },
                            amountColumnIndex: { type: Type.INTEGER },
                            skipRowsStart: { type: Type.INTEGER }
                        }
                    }
                }
            });
            res.json(JSON.parse(response.text || "{}"));
        } catch (error) {
            console.error("[AI Route] Erro infer-mapping:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // 🎓 LEARN PATTERN (PROXY BACKEND)
    router.post('/learn-pattern', async (req, res) => {
        if (!ai) return res.status(500).json({ error: "Serviço de IA não configurado." });
        
        try {
            const { extractionMode, learnedPatternSource, gridDataContext } = req.body;
            const isBlockMode = extractionMode === 'BLOCK';
            
            const instruction = isBlockMode 
                ? `VOCÊ É UM EXECUTOR DE CONTRATOS RÍGIDOS. O Admin editou uma linha modelo que é sua ÚNICA VERDADE ABSOLUTA.
                
                --- LINHA MESTRA (GABARITO DO ADMIN) ---
                Texto Bruto no Documento: "${learnedPatternSource.originalRaw.join(' | ')}"
                Extração Correta Definida pelo Admin: 
                - Data: "${learnedPatternSource.corrected.date}" 
                - Descrição: "${learnedPatternSource.corrected.description}" 
                - Valor: "${learnedPatternSource.corrected.amount}" (Observe rigorosamente o sinal)
                - Forma: "${learnedPatternSource.corrected.paymentMethod}"
                
                --- TAREFA E REGRAS CRÍTICAS (BLINDADAS) ---
                1. PROIBIDO ADIVINHAR OU MELHORAR: Sua inteligência deve se limitar a replicar a relação física entre o Bruto e o Gabarito.
                2. CONVENÇÃO BANCÁRIA (DÉBITO): Se o Admin definiu um valor como NEGATIVO e no Bruto ele possui o sufixo "D" ou "DEBITO", aprenda que esse padrão significa multiplicação por -1.
                3. FORMA DE PAGAMENTO: ExtraIA a coluna "Forma" seguindo EXATAMENTE a lógica que o Admin aplicou na Linha Mestra.
                4. FIDELIDADE TOTAL: Gere uma "blockRecipe" JSON técnica que permita encontrar TODAS as linhas similares a esta no documento e transformá-las EXATAMENTE como no gabarito sem alterar um único caractere ou símbolo do texto original.`
                
                : `VOCÊ É UM IDENTIFICADOR DE POSIÇÕES FIXAS PARA DOCUMENTOS ESTRUTURADOS. 
                Exemplo Bruto: "${learnedPatternSource.originalRaw.join(' ; ')}"
                GABARITO ABSOLUTO: Data: "${learnedPatternSource.corrected.date}", Nome: "${learnedPatternSource.corrected.description}", Valor: "${learnedPatternSource.corrected.amount}", Forma: "${learnedPatternSource.corrected.paymentMethod}"
                
                TAREFA:
                1. Determine os índices de 0 a N correspondentes ao GABARITO.
                2. Não tente normalizar, corrigir ou reescrever o texto agora. 
                3. Identifique palavras que devem ser removidas (ignoredKeywords) apenas se for estritamente necessário para que o texto bruto resulte na Descrição do Gabarito.
                4. Se o Gabarito for identico ao Bruto em determinada coluna, não sugira nenhuma limpeza.`;

            const parts = [
                { text: `AMOSTRA DO DOCUMENTO (CONTEÚDO DA JANELA ESQUERDA):\n${gridDataContext}` },
                { text: instruction }
            ];

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview', 
                contents: { parts },
                config: { 
                    temperature: 0,
                    responseMimeType: "application/json",
                    responseSchema: isBlockMode ? {
                        type: Type.OBJECT,
                        properties: {
                            blockRecipe: { type: Type.STRING },
                            confidence: { type: Type.NUMBER }
                        },
                        required: ["blockRecipe"]
                    } : {
                        type: Type.OBJECT,
                        properties: {
                            dateColumnIndex: { type: Type.INTEGER },
                            descriptionColumnIndex: { type: Type.INTEGER },
                            amountColumnIndex: { type: Type.INTEGER },
                            paymentMethodColumnIndex: { type: Type.INTEGER },
                            ignoredKeywords: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["dateColumnIndex", "descriptionColumnIndex", "amountColumnIndex", "ignoredKeywords"]
                    }
                }
            });

            res.json(JSON.parse(response.text || "{}"));
        } catch (error) {
            console.error("[AI Route] Erro learn-pattern:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
