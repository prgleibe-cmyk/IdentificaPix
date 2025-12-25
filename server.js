
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

// Fix: Strictly initialized using process.env.API_KEY as per the guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

app.post('/api/ai/extract-data', async (req, res) => {
    try {
        const { text, example } = req.body;
        
        if (!text) return res.status(400).json({ error: "Texto vazio" });

        let instructions = "Extraia todas as transações financeiras deste extrato.";
        
        // Se o usuário forneceu um exemplo, criamos um prompt de "Few-Shot" muito forte
        if (example && (example.date || example.description || example.amount)) {
            instructions = `
            Você deve atuar como um extrator de dados cirúrgico. 
            O usuário limpou manualmente a PRIMEIRA LINHA como exemplo do que ele deseja.
            
            USE ESTE PADRÃO PARA TODO O RESTANTE DO ARQUIVO:
            - Data exemplo: "${example.date}"
            - Descrição limpa exemplo: "${example.description}"
            - Valor exemplo: "${example.amount}"
            
            REGRAS CRÍTICAS:
            1. Se o usuário removeu prefixos como 'PIX RECEBIDO', 'TED', ou códigos numéricos no exemplo, remova de todos os outros.
            2. Ignore linhas de SALDO, TOTAIS, ou CABEÇALHOS.
            3. Retorne a data sempre no formato DD/MM/AAAA.
            4. O campo 'amount' deve ser o valor numérico puro.
            `;
        }

        const prompt = `
            ${instructions}
            Analise o texto abaixo e retorne um ARRAY JSON de objetos.
            TEXTO:
            """
            ${text.substring(0, 35000)}
            """
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: "Você é um especialista em processamento de extratos bancários. Sua resposta deve ser exclusivamente um array JSON válido, sem explicações.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            date: { type: Type.STRING },
                            description: { type: Type.STRING },
                            amount: { type: Type.STRING },
                        },
                        required: ["date", "description", "amount"]
                    }
                }
            }
        });

        // Fix: Access .text property instead of .text() method
        const resultText = response.text;
        if (!resultText) throw new Error("IA retornou resposta vazia");
        
        res.json(JSON.parse(resultText));
    } catch (error) {
        console.error("Erro na extração IA:", error);
        res.status(500).json({ error: error.message });
    }
});

// Outras rotas permanecem iguais...
app.post('/api/ai/suggestion', async (req, res) => {
    try {
        const { transactionDescription, contributorNames } = req.body;
        const prompt = `Analise: "${transactionDescription}" vs [${contributorNames}]. Responda APENAS o name exato ou "Nenhuma sugestão clara".`;
        // Fix: accessing text property directly
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        res.json({ text: response.text ? response.text.trim() : "Erro na resposta da IA" });
    } catch (error) { res.status(500).json({ error: 'Erro na IA' }); }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'dist', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => { console.log(`✅ Servidor rodando na porta ${PORT}`); });
