import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Caminho para o logger (ajuste conforme sua estrutura real)
import { Logger, Metrics } from "../../src/services/monitoringService.js";

// Função principal
export const handler = async (event) => {
  try {
    Logger.info("Função getAISuggestion iniciada.");

    const body = JSON.parse(event.body || "{}");
    const { inputText } = body;

    if (!inputText) {
      Logger.warn("Requisição sem inputText.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Campo 'inputText' é obrigatório." }),
      };
    }

    const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      Logger.error("Chave GEMINI_API_KEY não configurada.");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Chave GEMINI_API_KEY ausente." }),
      };
    }

    // Faz a requisição para o endpoint da Gemini
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: inputText }] }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      Logger.error("Erro na API Gemini", data);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || "Erro desconhecido" }),
      };
    }

    Metrics.increment("apiErrors", 0);
    Logger.info("Resposta obtida com sucesso da API Gemini.");

    return {
      statusCode: 200,
      body: JSON.stringify({ suggestion: data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta." }),
    };

  } catch (error) {
    Logger.error("Erro interno na função getAISuggestion", error);
    Metrics.increment("apiErrors");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erro interno do servidor." }),
    };
  }
};
