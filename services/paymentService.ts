
import { Logger } from './monitoringService';

export interface PaymentResponse {
    id: string;
    status: 'PENDING' | 'RECEIVED' | 'OVERDUE';
    pixCopiaECola: string;
    qrCodeImage: string; // Base64 or URL
    value: number;
}

// PRODUCTION ADAPTER INTERFACE
// This service simulates the interaction with a payment gateway (e.g., Asaas, Stripe, MercadoPago).
// In a production environment, these calls should be routed to a secure backend (Supabase Edge Functions)
// to handle API keys securely.

export const paymentService = {
    /**
     * Creates a Pix payment order.
     * In Production: Call backend function 'create-pix-charge'.
     */
    createPixPayment: async (
        amount: number, 
        customerName: string, 
        description: string
    ): Promise<PaymentResponse> => {
        Logger.info('Initiating Payment Gateway Transaction...', { amount, customerName });

        // Simulate Network Latency
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Generate a transaction ID
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // Generate a valid visual QR Code for demonstration.
        // In production, `pixCopiaECola` and `qrCodeImage` come from the bank API.
        const mockPixString = `00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540${amount.toFixed(2).replace('.', '')}5802BR5913IdentificaPix6008SaoPaulo62070503***6304ABCD`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mockPixString)}`;
        
        return {
            id: transactionId,
            status: 'PENDING',
            pixCopiaECola: mockPixString,
            qrCodeImage: qrCodeUrl,
            value: amount
        };
    },

    /**
     * Checks the status of a payment.
     * In Production: Poll backend or use Webhooks.
     */
    checkPaymentStatus: async (paymentId: string): Promise<'PENDING' | 'RECEIVED' | 'OVERDUE'> => {
        // Mock Logic: Auto-approve after 10 seconds for user experience testing
        const timestamp = parseInt(paymentId.split('_')[1]);
        const elapsed = Date.now() - timestamp;

        if (elapsed > 10000) { 
            return 'RECEIVED';
        }
        
        return 'PENDING';
    }
};
