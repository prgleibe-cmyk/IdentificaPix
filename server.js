
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Configuração para __dirname em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Aumentar limite para aceitar imagens em Base64
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Inicializa o cliente Gemini com a chave segura do servidor
// A chave deve estar no arquivo .env como API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Rota de Health Check (Para o Coolify saber que o app está online) ---
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// --- Rota 1: Sugestão de Conciliação (Transação vs Lista) ---
app.post('/api/ai/suggestion', async (req, res) => {
    try {
        const { transactionDescription, contributorNames } = req.body;

        const prompt = `
            Você é um assistente de conciliação financeira para uma igreja.
            Dada a seguinte descrição de uma transação PIX e uma lista de contribuintes, identifique o contribuinte mais provável.
            
            Descrição da Transação: "${transactionDescription}"
            
            Lista de Contribuintes:
            ${contributorNames}
            
            Analise o nome na descrição da transação e encontre a correspondência mais próxima na lista de contribuintes. 
            Responda APENAS com o nome completo do contribuinte da lista que você identificou.
            Se nenhum contribuinte parecer uma correspondência razoável, responda com "Nenhuma sugestão clara".
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        res.json({ text: response.text ? response.text.trim() : "Erro na resposta da IA" });
    } catch (error) {
        console.error('Erro na rota /suggestion:', error);
        res.status(500).json({ error: 'Erro interno ao processar IA' });
    }
});

// --- Rota 2: Análise de Comprovantes (Imagem) ---
app.post('/api/ai/analyze-receipt', async (req, res) => {
    try {
        const { imageBase64, mimeType } = req.body;

        const prompt = `
          Você é um auditor financeiro rigoroso. Analise a imagem fornecida.
          Sua tarefa é verificar se este arquivo é um Comprovante de Pagamento Bancário Brasileiro (PIX, TED, DOC ou Boleto) VÁLIDO e LEGÍTIMO.
          Regras:
          1. Se não for financeiro, isValid = false.
          2. Extraia valor (amount), data (YYYY-MM-DD), destinatário e remetente.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: imageBase64 } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isValid: { type: Type.BOOLEAN },
                        amount: { type: Type.NUMBER, description: "Valor numérico. Ex: 29.90" },
                        date: { type: Type.STRING, description: "Formato YYYY-MM-DD" },
                        recipient: { type: Type.STRING },
                        sender: { type: Type.STRING },
                        reason: { type: Type.STRING }
                    },
                    required: ["isValid"]
                }
            }
        });

        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error('Erro na rota /analyze-receipt:', error);
        res.status(500).json({ error: 'Erro ao analisar comprovante' });
    }
});

// --- Rota 3: Extração de Dados (Texto Puro) ---
app.post('/api/ai/extract-data', async (req, res) => {
    try {
        const { text, examples } = req.body;
        
        // Truncar texto para evitar estourar tokens se for muito grande
        const truncatedText = text.substring(0, 30000);

        const prompt = `
            Extraia transações financeiras do texto abaixo.
            ${examples ? `Siga este padrão aproximado: ${JSON.stringify(examples)}` : 'Busque padrões de Data, Descrição e Valor.'}
            
            TEXTO:
            """
            ${truncatedText}
            """
            
            Retorne JSON array.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            date: { type: Type.STRING },
                            description: { type: Type.STRING },
                            amount: { type: Type.STRING },
                        }
                    }
                }
            }
        });

        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error('Erro na rota /extract-data:', error);
        res.status(500).json({ error: 'Erro ao extrair dados' });
    }
});

// --- Servir Frontend em Produção ---
// O comando 'npm run build' cria a pasta 'dist'. O servidor Node serve essa pasta.
app.use(express.static(path.join(__dirname, 'dist')));

// Qualquer rota que não seja /api, retorna o index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
