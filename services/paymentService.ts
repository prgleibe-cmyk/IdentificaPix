
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

// PRODUCTION ADAPTER INTERFACE
// This service simulates the interaction with Asaas.
// In a production environment, these calls should be routed to a secure backend (Supabase Edge Functions).

export const paymentService = {
    /**
     * Creates a payment order via Asaas (Simulated).
     */
    createPayment: async (
        amount: number, 
        customerName: string, 
        description: string,
        method: 'PIX' | 'CREDIT_CARD' | 'BOLETO'
    ): Promise<PaymentResponse> => {
        Logger.info(`Initiating Asaas Payment [${method}]...`, { amount, customerName });

        // Simulate Network Latency
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Generate a transaction ID
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        let response: PaymentResponse = {
            id: transactionId,
            status: 'PENDING',
            value: amount,
            method
        };

        if (method === 'PIX') {
            const mockPixString = `00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540${amount.toFixed(2).replace('.', '')}5802BR5913IdentificaPix6008SaoPaulo62070503***6304ABCD`;
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mockPixString)}`;
            response.pixCopiaECola = mockPixString;
            response.qrCodeImage = qrCodeUrl;
        } 
        else if (method === 'BOLETO') {
            response.barcode = `34191.79001 01043.510047 91020.150008 8 845200000${amount.toString().replace('.', '')}`;
            response.bankSlipUrl = "#"; // Would be a real PDF URL
        }
        else if (method === 'CREDIT_CARD') {
            // Cards are usually approved instantly or rejected
            response.status = 'CONFIRMED';
        }
        
        return response;
    },

    /**
     * Checks the status of a payment.
     */
    checkPaymentStatus: async (paymentId: string): Promise<'PENDING' | 'RECEIVED' | 'OVERDUE' | 'CONFIRMED'> => {
        // Mock Logic: Auto-approve after 10 seconds for user experience testing
        const timestamp = parseInt(paymentId.split('_')[1]);
        const elapsed = Date.now() - timestamp;

        if (elapsed > 10000) { 
            return 'RECEIVED';
        }
        
        return 'PENDING';
    }
};
