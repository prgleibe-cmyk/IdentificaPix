
import { Logger } from "./monitoringService";
import { supabase } from "./supabaseClient";

// Escopos necessários
const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

export const gmailService = {
    
    /**
     * Inicia o fluxo de autenticação para obter o token do Gmail.
     * Utiliza o Supabase Auth com escopos adicionais.
     */
    connect: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                scopes: GMAIL_SCOPES,
                redirectTo: window.location.origin,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent', // Força refresh token se necessário
                }
            }
        });
        if (error) throw error;
    },

    /**
     * Busca e-mails bancários recentes.
     * Requer que o usuário já tenha feito login com o escopo correto.
     * Aumentado para 400 para garantir recuperação pós-período desconectado ou eventos grandes.
     */
    fetchBankEmails: async (accessToken: string, maxResults = 400) => {
        try {
            // 1. Listar Mensagens (Filtro por keywords bancárias comuns)
            const query = 'subject:(pix OR transferência OR comprovante OR recebido OR enviado) -category:promotions -category:social';
            const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
            
            const listResponse = await fetch(listUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!listResponse.ok) {
                if (listResponse.status === 401) throw new Error("Token expirado ou inválido.");
                throw new Error("Falha ao listar e-mails.");
            }

            const listData = await listResponse.json();
            if (!listData.messages || listData.messages.length === 0) return [];

            // 2. Buscar Detalhes de cada mensagem (Batch requests seria ideal, mas fetch paralelo funciona para poucos itens)
            const messages = await Promise.all(listData.messages.map(async (msg: any) => {
                const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
                const detailResponse = await fetch(detailUrl, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                return detailResponse.json();
            }));

            // 3. Simplificar Payload para a IA
            return messages.map((msg: any) => {
                const headers = msg.payload.headers;
                const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
                const date = headers.find((h: any) => h.name === 'Date')?.value || '';
                const snippet = msg.snippet;
                
                // Tenta extrair corpo texto (preferência text/plain)
                let body = '';
                if (msg.payload.parts) {
                    const part = msg.payload.parts.find((p: any) => p.mimeType === 'text/plain');
                    if (part && part.body.data) {
                        body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                    }
                } else if (msg.payload.body.data) {
                    body = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                }

                return {
                    id: msg.id,
                    subject,
                    date,
                    snippet,
                    body
                };
            });

        } catch (error) {
            Logger.error("Erro no serviço Gmail", error);
            throw error;
        }
    }
};
