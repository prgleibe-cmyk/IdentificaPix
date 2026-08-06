import { Logger } from './monitoringService';
import { getAuthToken } from './auth/authAdapter';

export interface PaymentResponse {
    id: string;
    status: 'PENDING' | 'RECEIVED' | 'OVERDUE' | 'CONFIRMED';
    pixCopiaECola?: string;
    qrCodeImage?: string; 
    barcode?: string;
    bankSlipUrl?: string;
    invoiceUrl?: string;
    value: number;
    method: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
}

export interface PaymentRecord {
    id?: string;
    user_id: string;
    amount: number;
    status?: string;
    notes?: string | null;
    payment_method?: string | null;
    created_at?: string;
}

async function getHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const paymentService = {
    recordPaymentInDb: async (
        userId: string,
        amount: number,
        status: string = 'approved',
        notes?: string,
        paymentMethod?: string
    ): Promise<PaymentRecord | null> => {
        try {
            const headers = await getHeaders();
            const response = await fetch('/api/v1/payments', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    user_id: userId,
                    amount,
                    status,
                    notes: notes || null,
                    payment_method: paymentMethod || null
                })
            });
            if (!response.ok) return null;
            const json = await response.json();
            return json.success ? json.data : null;
        } catch (err) {
            console.error('[PaymentService] Erro ao registrar pagamento no banco:', err);
            return null;
        }
    },

    getPaymentsFromDb: async (userId?: string): Promise<PaymentRecord[]> => {
        try {
            const headers = await getHeaders();
            const url = userId ? `/api/v1/payments?user_id=${encodeURIComponent(userId)}` : '/api/v1/payments';
            const response = await fetch(url, { method: 'GET', headers });
            if (!response.ok) return [];
            const json = await response.json();
            return json.success && Array.isArray(json.data) ? json.data : [];
        } catch (err) {
            console.error('[PaymentService] Erro ao listar pagamentos do banco:', err);
            return [];
        }
    },

    /**
     * Creates a payment order via Backend API.
     */
    createPayment: async (
        amount: number, 
        customerName: string, 
        description: string,
        method: 'PIX' | 'CREDIT_CARD' | 'BOLETO',
        email?: string,
        cpfCnpj?: string,
        userId?: string
    ): Promise<PaymentResponse> => {
        Logger.info(`Initiating Real Payment [${method}]...`, { amount, customerName, email });

        try {
            const token = await getAuthToken();

            const response = await fetch('/api/payment/create', {
                method: 'POST',
                cache: 'no-store',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    amount,
                    name: customerName,
                    email,
                    cpfCnpj,
                    description,
                    method,
                    userId
                })
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Erro da API: ${response.status}`);
                } else {
                    const text = await response.text();
                    console.error("Non-JSON API Error:", text.substring(0, 200));
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
            } else if (method === 'BOLETO' || method === 'CREDIT_CARD') {
                result.bankSlipUrl = data.bankSlipUrl;
                result.invoiceUrl = data.invoiceUrl;
                result.barcode = method === 'BOLETO' ? "Ver Boleto no Link" : "Ver Fatura no Link"; 
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
            const token = await getAuthToken();

            const response = await fetch(`/api/payment/status/${paymentId}`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
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
