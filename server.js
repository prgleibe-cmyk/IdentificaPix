
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// A chave de API DEVE ser obtida de process.env.API_KEY.
// O arquivo vite.config.ts garante que VITE_GEMINI_API_KEY ou API_KEY seja injetado corretamente.
let ai;
try {
    if (!process.env.API_KEY) {
        console.error("CRITICAL: Gemini API Key is missing from environment variables.");
        // Não encerra o processo, apenas loga e a API Gemini não será inicializada corretamente
        // Isso permite que outras partes do servidor funcionem, mas as chamadas de IA falharão.
        // throw new Error("API_KEY environment variable is not set.");
    } else {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
} catch (e) {
    console.error("Failed to initialize GoogleGenAI client:", e.message);
}


app.post('/api/ai/extract-data', async (req, res) => {
    if (!ai) {
        return res.status(500).json({ error: "Serviço de IA não configurado (Falta API Key)." });
    }

    try {
        const { text, example } = req.body;
        
        if (!text) return res.status(400).json({ error: "Texto vazio" });

        let instructions = `
            EXTRATOR FINANCEIRO. Retorne um array JSON de objetos.
            REGRAS GERAIS:
            1. Ignore linhas de cabeçalho, saldo ou totais.
            2. Converta datas para DD/MM/AAAA.
            3. Converta valores para string numérica padrão americano (ex: "1250.50"). Saídas devem ser negativas.
            4. Se o usuário forneceu um exemplo, use-o como guia rigoroso.
        `;
        
        // Se o usuário forneceu um exemplo, criamos um prompt de "Few-Shot" muito forte
        if (example && (example.date || example.description || example.amount)) {
            instructions += `
            Você é um extrator de dados financeiro. O usuário forneceu um exemplo manual de como uma linha DEVE SER EXTRAÍDA e formatada.
            
            USE ESTE PADRÃO DE REFERÊNCIA (EXEMPLO DE APRENDIZADO):
            - Data esperada (formato): "${example.date}"
            - Descrição limpa esperada: "${example.description}"
            - Valor esperado (formato): "${example.amount}"
            
            APLIQUE ESTE PADRÃO RIGOROSAMENTE para o restante do arquivo.
            REGRAS CRÍTICAS:
            1. Se o usuário removeu prefixos como 'PIX RECEBIDO', 'TED', 'COMPROVANTE', ou códigos numéricos (ex: IDs de transação) no exemplo, remova de todas as outras linhas.
            2. Ignore linhas de SALDO, TOTAIS, ou CABEÇALHOS que não sejam transações.
            3. Retorne a data sempre no formato DD/MM/AAAA.
            4. O campo 'amount' deve ser o valor numérico puro em string (ex: "1250.50"). Saídas devem ser valores negativos.
            `;
        }

        const prompt = `
            ${instructions}
            
            Analise o TEXTO BRUTO abaixo e retorne um ARRAY JSON de objetos correspondente.
            
            TEXTO:
            """
            ${text.substring(0, 35000)}
            """
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash', 
            contents: prompt,
            config: {
                systemInstruction: "Você é um especialista em processamento de extratos bancários. Sua resposta deve ser EXCLUSIVAMENTE um array JSON válido.",
                temperature: 0, // Rigidez para extração de dados
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            date: { type: Type.STRING },
                            name: { type: Type.STRING },
                            amount: { type: Type.STRING },
                            originalIndex: { type: Type.INTEGER }
                        },
                        required: ["date", "name", "amount", "originalIndex"]
                    }
                }
            }
        });

        let jsonStr = response.text ? response.text.trim() : "[]";
        // Remove blocos de código markdown se o modelo os gerar (fallback)
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.substring(7, jsonStr.lastIndexOf('```')).trim();
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.substring(3, jsonStr.lastIndexOf('```')).trim();
        }

        const parsedData = JSON.parse(jsonStr);
        res.json(parsedData);

    } catch (error) {
        console.error("Erro na extração IA (backend):", error);
        res.status(500).json({ error: 'Erro na IA ao extrair dados.' });
    }
});

app.post('/api/ai/suggestion', async (req, res) => {
    if (!ai) {
        return res.status(500).json({ error: "Serviço de IA não configurado." });
    }
    try {
        const { transactionDescription, contributorNames } = req.body;
        const prompt = `Analise a descrição da transação: "${transactionDescription}". Qual nome de contribuinte da lista abaixo se encaixa melhor? Responda APENAS o nome exato do contribuinte ou "Nenhuma sugestão clara". Lista: [${contributorNames.join(', ')}].`;
        
        const response = await ai.models.generateContent({ 
            model: 'gemini-1.5-flash', 
            contents: prompt,
            config: {
                temperature: 0.1, // Um pouco de flexibilidade para nomes
                systemInstruction: "Você é um assistente de identificação de nomes. Responda apenas o nome sugerido ou 'Nenhuma sugestão clara'."
            }
        });
        res.json({ text: response.text ? response.text.trim() : "Nenhuma sugestão clara" });
    } catch (error) { 
        console.error("Erro na sugestão IA (backend):", error);
        res.status(500).json({ error: 'Erro na IA ao gerar sugestão.' }); 
    }
});

// Implementação do endpoint de pagamento MOCK
// Em produção, isso seria substituído por uma integração real com Asaas, Stripe, etc.
const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

app.post('/api/payment/create', async (req, res) => {
    const { amount, name, email, description, method, userId } = req.body;

    console.log(`[MOCK PAYMENT] Recebido: ${method} para ${name} (${email}) - Valor: ${amount}`);

    try {
        // Simulação de delay para API externa
        await new Promise(resolve => setTimeout(resolve, 1500));

        let paymentStatus = 'PENDING';
        let pixCopiaECola = null;
        let qrCodeImage = null; // Mocked base64 QR would go here if needed
        let barcode = null;
        let bankSlipUrl = null;

        if (method === 'PIX') {
            pixCopiaECola = `00020126330014BR.GOV.BCB.PIX011112345678901520400005303986540${amount.toFixed(2)}5802BR590${name.length}${name}6007BRASIL62250521identificapix-mock6304CA77`;
            // Mock QR Code Image (Placeholder Base64 - 1x1 Pixel Transparent)
            qrCodeImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        } else if (method === 'BOLETO') {
            barcode = "23790.50400 44100.120004 02002.324009 1 92340000000000";
            bankSlipUrl = "https://example.com/boleto-mock.pdf";
        } else if (method === 'CREDIT_CARD') {
            paymentStatus = 'CONFIRMED';
        }

        const responseData = {
            id: `pay-${Date.now()}`,
            status: paymentStatus,
            value: amount,
            method: method,
            pixCopiaECola,
            pixQrCodeImage: qrCodeImage,
            barcode,
            bankSlipUrl
        };

        res.json(responseData);

    } catch (error) {
        console.error("Erro no mock de pagamento:", error);
        res.status(500).json({ error: "Erro ao processar pagamento simulado." });
    }
});

app.get('/api/payment/status/:id', async (req, res) => {
    // Simula que o pagamento foi recebido após 5 segundos
    // Em produção, isso consultaria o gateway de pagamento
    const shouldBePaid = Math.random() > 0.3; // 70% chance de "sucesso" no mock após polling
    
    res.json({
        id: req.params.id,
        status: shouldBePaid ? 'CONFIRMED' : 'PENDING'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
