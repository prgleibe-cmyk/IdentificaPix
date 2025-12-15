
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
        method: 'PIX' | 'CREDIT_CARD' | 'BOLETO'
    ): Promise<PaymentResponse> => {
        Logger.info(`Initiating Real Payment [${method}]...`, { amount, customerName });

        try {
            const response = await fetch('/api/payment/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    name: customerName,
                    description,
                    method,
                    // TODO: In a future update, pass email/cpf from auth context
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao criar pagamento');
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
                // If the backend returns raw base64 without prefix, add it. If it returns url, use it.
                // Assuming Asaas returns Base64 for encodedImage.
                result.qrCodeImage = data.pixQrCodeImage 
                    ? `data:image/png;base64,${data.pixQrCodeImage}`
                    : undefined;
            } else if (method === 'BOLETO') {
                result.bankSlipUrl = data.bankSlipUrl;
                // Asaas API v3 create doesn't always return barcode directly in main response, 
                // typically provided in bankSlipUrl or separate call. 
                // For MVP we use the URL.
                result.barcode = "Ver Boleto no Link"; 
            }

            return result;

        } catch (error) {
            console.error("Payment Service Error:", error);
            throw error;
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
            
            // Map Asaas statuses to internal types
            // Asaas: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, etc.
            if (data.status === 'RECEIVED' || data.status === 'CONFIRMED') return 'CONFIRMED';
            if (data.status === 'OVERDUE') return 'OVERDUE';
            
            return 'PENDING';
        } catch (error) {
            console.error("Status Check Error:", error);
            return 'PENDING';
        }
    }
};
