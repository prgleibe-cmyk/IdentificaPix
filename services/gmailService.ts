
import { supabase } from './supabaseClient';

export const gmailService = {
    connect: async () => {
        const { error } = await (supabase.auth as any).signInWithOAuth({
            provider: 'google',
            options: {
                scopes: 'https://www.googleapis.com/auth/gmail.readonly',
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
                redirectTo: window.location.origin
            },
        });
        if (error) throw error;
    },
    fetchBankEmails: async (accessToken: string, maxResults: number = 400) => {
        const query = 'subject:(pix OR transferência OR comprovante OR recebido OR enviado OR pagamento OR débito OR crédito OR extrato OR aviso OR notificação)';
        const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
        const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        
        if (!listRes.ok) throw new Error(`Gmail API Error: ${listRes.status}`);
        
        const listData = await listRes.json();
        if (!listData.messages || listData.messages.length === 0) return [];

        const details = await Promise.all(listData.messages.map(async (msg: any) => {
            try {
                const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
                const res = await fetch(detailUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
                return res.ok ? res.json() : null;
            } catch (e) { return null; }
        }));

        return details
            .filter(msg => msg?.payload?.headers)
            .map(msg => {
                const headers = msg.payload.headers;
                const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
                const date = headers.find((h: any) => h.name === 'Date')?.value || '';
                let body = '';
                if (msg.payload.parts) {
                    const part = msg.payload.parts.find((p: any) => p.mimeType === 'text/plain');
                    if (part?.body?.data) {
                        try {
                            body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                        } catch (e) {
                            body = '';
                        }
                    }
                } else if (msg.payload.body?.data) {
                    try {
                        body = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                    } catch (e) {
                        body = '';
                    }
                }
                return { 
                    id: msg.id, 
                    subject, 
                    date, 
                    body: body.substring(0, 1000),
                    snippet: body.substring(0, 200)
                };
            });
    }
};
