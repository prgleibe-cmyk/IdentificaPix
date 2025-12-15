
import { Logger } from './monitoringService';

export interface PaymentResponse {
    id: string;
    status: 'PENDING' | 'RECEIVED' | 'OVERDUE' | 'CONFIRMED';
    pixCopiaECola?: string;
    qrCodeImage?: string; 
    barcode?: string;
    bankSlipUrl?: string;
    value: number;
    method: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
}

// REAL ADAPTER INTERFACE
// Connects to the local Node.js backend which proxies to Asaas

export const paymentService = {
    /**
     * Creates a payment order via Backend API.
     */
    createPayment: async (
        amount: number, 
        customerName: string, 
        description: string,
        method: 'PIX' | 'CREDIT_CARD' | 'BOLETO',
        email?: string,
        cpfCnpj?: string
    ): Promise<PaymentResponse> => {
        Logger.info(`Initiating Real Payment [${method}]...`, { amount, customerName, email });

        try {
            const response = await fetch('/api/payment/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    name: customerName,
                    email,
                    cpfCnpj,
                    description,
                    method,
                })
            });

            // Handle non-OK responses
            if (!response.ok) {
                // Try to parse JSON error first
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Erro da API: ${response.status}`);
                } else {
                    // Handle HTML/Text error (Common with Coolify/Nginx 404/500/502)
                    const text = await response.text();
                    console.error("Non-JSON API Error:", text.substring(0, 200)); // Log partial response for debug
                    throw new Error(`Erro HTTP ${response.status}: Falha de comunicação com o servidor.`);
                }
            }

            const data = await response.json();

            let result: PaymentResponse = {
                id: data.id,
                status: data.status === 'RECEIVED' || data.status === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING',
                value: amount,
                method
            };

            if (method === 'PIX') {
                result.pixCopiaECola = data.pixCopiaECola;
                result.qrCodeImage = data.pixQrCodeImage 
                    ? `data:image/png;base64,${data.pixQrCodeImage}`
                    : undefined;
            } else if (method === 'BOLETO') {
                result.bankSlipUrl = data.bankSlipUrl;
                result.barcode = "Ver Boleto no Link"; 
            }

            return result;

        } catch (error: any) {
            console.error("Payment Service Error:", error);
            throw new Error(error.message || "Erro desconhecido ao processar pagamento.");
        }
    },

    /**
     * Checks the status of a payment via Backend API.
     */
    checkPaymentStatus: async (paymentId: string): Promise<'PENDING' | 'RECEIVED' | 'OVERDUE' | 'CONFIRMED'> => {
        try {
            const response = await fetch(`/api/payment/status/${paymentId}`);
            if (!response.ok) return 'PENDING';
            
            const data = await response.json();
            
            if (data.status === 'RECEIVED' || data.status === 'CONFIRMED') return 'CONFIRMED';
            if (data.status === 'OVERDUE') return 'OVERDUE';
            
            return 'PENDING';
        } catch (error) {
            console.error("Status Check Error:", error);
            return 'PENDING';
        }
    }
};
