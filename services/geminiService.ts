
import { GoogleGenAI, Type } from "@google/genai";

const getAIClient = () => {
    if (!process.env.API_KEY) throw new Error("Chave de API do Gemini não configurada.");
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

let isAIBusy = false;

/**
 * 🛡️ PARSER RESILIENTE (V4 - ULTRA RECOVERY)
 */
const safeJsonParse = (input: any, fallback: any = []) => {
    if (!input) return fallback;
    let sanitized = String(input).trim();
    
    sanitized = sanitized.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');

    const tryParse = (str: string) => {
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

/**
 * 🎯 MOTOR DE EXTRAÇÃO SEMÂNTICA (MODO PRESERVAÇÃO LITERAL ABSOLUTA)
 */
export const extractTransactionsWithModel = async (
    rawText: string, 
    modelContext?: string, 
    base64Data?: string,
    limit?: number
): Promise<any> => {
    if (isAIBusy) return { rows: [] };
    isAIBusy = true;

    try {
        const response = await fetch('/api/ai/extract-transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rawText, modelContext, base64Data, limit })
        });
        
        if (!response.ok) {
            throw new Error(`Erro na ponte backend (Extract): ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("[GeminiService] Erro na extração via backend:", error);
        throw error;
    } finally {
        isAIBusy = false;
    }
};

export const getRawStructuralDump = async (base64Data: string): Promise<any[]> => {
    if (isAIBusy) return [];
    isAIBusy = true;
    try {
        const response = await fetch('/api/ai/structural-dump', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Data })
        });
        
        if (!response.ok) {
            throw new Error(`Erro na ponte backend (StructuralDump): ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("[GeminiService] Erro ao extrair dump via backend:", error);
        throw error;
    } finally {
        isAIBusy = false;
    }
};

export const inferMappingFromSample = async (sampleText: string): Promise<any> => {
    if (isAIBusy) return null;
    isAIBusy = true;
    try {
        const response = await fetch('/api/ai/infer-mapping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sampleText })
        });
        
        if (!response.ok) {
            throw new Error(`Erro na ponte backend: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("[GeminiService] Erro ao inferir mapeamento via backend:", error);
        throw error;
    } finally {
        isAIBusy = false;
    }
};

export const learnPattern = async (
    extractionMode: 'COLUMNS' | 'BLOCK', 
    learnedPatternSource: any, 
    gridDataContext: string
): Promise<any> => {
    if (isAIBusy) return null;
    isAIBusy = true;
    try {
        const response = await fetch('/api/ai/learn-pattern', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extractionMode, learnedPatternSource, gridDataContext })
        });
        
        if (!response.ok) {
            throw new Error(`Erro na ponte backend (LearnPattern): ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("[GeminiService] Erro no aprendizado via backend:", error);
        throw error;
    } finally {
        isAIBusy = false;
    }
};
