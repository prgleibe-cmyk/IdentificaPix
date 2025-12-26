
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

        let instructions = `
            EXTRATOR FINANCEIRO. Retorne um array JSON de objetos: { date: "DD/MM/AAAA", name: "Texto Limpo", amount: "0.00" }.
            REGRAS GERAIS:
            1. Ignore linhas de cabeçalho, saldo ou totais.
            2. Converta datas para DD/MM/AAAA.
            3. Converta valores para string numérica padrão americano (ex: "1250.50"). Saídas devem ser negativas.
            4. Se o usuário forneceu um exemplo, use-o como guia rigoroso.
        `;
        
        // Se o usuário forneceu um exemplo, criamos um prompt de "Few-Shot" muito forte
        if (example && (example.date || example.description || example.amount)) {
            instructions = `
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
            5. Sua resposta deve ser EXCLUSIVAMENTE um array JSON de objetos com as chaves: 'date', 'name', 'amount'.
            `;
        }

        const prompt = `
            ${instructions}
            
            Analise o TEXTO BRUTO abaixo e retorne um ARRAY JSON de objetos.
            TEXTO:
            """
            ${text.substring(0, 35000)}
            """
        `;

        const response = await ai.models.generateContent({
            // MUDANÇA CRÍTICA: Usando o modelo estável para respeitar billing
            model: 'gemini-1.5-flash', 
            contents: prompt,
            config: {
                systemInstruction: "Você é um especialista em processamento de extratos bancários. Sua resposta deve ser EXCLUSIVAMENTE um array JSON válido, sem qualquer texto adicional ou explicações.",
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
                        },
                        required: ["date", "name", "amount"]
                    }
                }
            }
        });

        // Fix: Access .text property instead of .text() method
        const resultText = response.text;
        if (!resultText) throw new Error("IA retornou resposta vazia");
        
        // Tentativa de limpar a string JSON caso o modelo adicione lixo
        let cleanJsonString = resultText.trim();
        // Remove blocos de código markdown se o modelo os gerar
        if (cleanJsonString.startsWith('```json')) {
            cleanJsonString = cleanJsonString.substring(7, cleanJsonString.lastIndexOf('```')).trim();
        }

        res.json(JSON.parse(cleanJsonString));

    } catch (error) {
        console.error("Erro na extração IA (backend):", error);
        // Garante que o erro seja serializável para o cliente
        res.status(500).json({ error: error.message || "Erro desconhecido na extração da IA." });
    }
});

// Outras rotas permanecem iguais...
app.post('/api/ai/suggestion', async (req, res) => {
    try {
        const { transactionDescription, contributorNames } = req.body;
        const prompt = `Analise a descrição da transação: "${transactionDescription}". Qual nome de contribuinte da lista abaixo se encaixa melhor? Responda APENAS o nome exato do contribuinte ou "Nenhuma sugestão clara". Lista: [${contributorNames.join(', ')}].`;
        // MUDANÇA CRÍTICA: Usando o modelo estável
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

// Serve os arquivos estáticos da build do Vite
app.use(express.static(path.join(__dirname, 'dist')));

// Rota fallback para o index.html, importante para apps SPA
app.get('*', (req, res) => { 
    res.sendFile(path.join(__dirname, 'dist', 'index.html')); 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => { console.log(`✅ Servidor rodando na porta ${PORT}`); });
