import { Logger } from "../../services/monitoringService";

export interface GmailSyncResponse {
    csv: string;
    count: number;
}

export interface GmailTransaction {
    date: string;
    description: string;
    amount: number;
    type?: string;
}

export const gmailService = {
    /**
     * Solicita ao backend a leitura e conversão dos e-mails.
     * Retorna o conteúdo CSV pronto para ser injetado no sistema.
     * Nenhuma lógica de negócio ocorre aqui.
     */
    syncEmails: async (accessToken: string): Promise<GmailSyncResponse> => {
        try {
            const response = await fetch('/api/gmail/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro no servidor: ${errorText}`);
            }

            const data = await response.json();
            
            // Validação básica do contrato de resposta
            if (typeof data.csv !== 'string' || typeof data.count !== 'number') {
                throw new Error("Formato de resposta inválido do servidor.");
            }

            return data;
        } catch (error) {
            Logger.error("Erro ao sincronizar Gmail", error);
            throw error;
        }
    }
};