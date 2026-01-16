
export interface GmailSyncStatus {
  isSyncing: boolean;
  totalEmails: number;
  processedEmails: number;
  foundTransactions: number;
  status: 'idle' | 'authenticating' | 'fetching' | 'analyzing' | 'complete' | 'error';
  error?: string;
}

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

export interface SubscriptionStatus {
  plan: 'trial' | 'active' | 'expired' | 'lifetime';
  daysRemaining: number;
  totalDays: number;
  isExpired: boolean;
  isBlocked: boolean;
  isLifetime: boolean;
  aiLimit: number;
  aiUsage: number;
  maxChurches: number;
  maxBanks: number;
  customPrice?: number;
}
