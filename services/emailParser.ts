import { Transaction } from "../types";
import { Logger } from "./monitoringService";
import { NameResolver } from "../core/processors/NameResolver";

export const parseEmailBatch = async (emails: { id: string, snippet: string, body: string, date: string, subject: string }[]): Promise<Transaction[]> => {
    if (emails.length === 0) return [];

    try {
        const emailData = emails.map(e => `ID: ${e.id} | ASSUNTO: ${e.subject} | CORPO: ${e.body.substring(0, 500)}`).join('\n---\n');

        const response = await fetch('/api/ai/extract-transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rawText: emailData,
                modelContext: "Extração de transações bancárias de e-mails. Entradas positivas, Saídas negativas.",
                limit: emails.length
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na ponte backend (Email): ${response.statusText}`);
        }

        const data = await response.json();
        const extracted = data.rows || [];

        return extracted.map((item: any, index: number) => {
            const cleanedDesc = NameResolver.clean(item.description || "");
            return {
                id: `gmail-${emails[index]?.id || Math.random()}`,
                date: item.date,
                description: cleanedDesc,
                rawDescription: cleanedDesc,
                cleanedDescription: cleanedDesc, 
                amount: item.amount,
                originalAmount: String(item.amount),
                contributionType: item.tipo || 'PIX'
            };
        });

    } catch (error) {
        Logger.error("Erro ao parsear e-mails com IA via backend", error);
        return [];
    }
};
