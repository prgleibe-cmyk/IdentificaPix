
import { SubscriptionStatus } from '../../types';

export interface SystemSettings {
    defaultTrialDays: number;
    pixKey: string;
    monthlyPrice: number;
    pricePerExtra: number; 
    pricePerAiBlock: number;
    baseAiLimit: number;
    baseSlots: number;
    supportNumber: string;
    ignoredKeywords: string[];
}

export interface AuthContextType {
  session: any | null;
  user: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
  subscription: SubscriptionStatus;
  refreshSubscription: () => Promise<void>;
  addSubscriptionDays: (days: number) => Promise<void>;
  registerPayment: (amount: number, method: string, notes?: string, receiptUrl?: string) => Promise<void>;
  incrementAiUsage: () => Promise<void>;
  updateLimits: (slots: number) => Promise<void>;
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: Partial<SystemSettings>) => Promise<void>;
}

export const DEFAULT_SETTINGS: SystemSettings = {
    defaultTrialDays: 10,
    pixKey: '',
    monthlyPrice: 49.90,
    pricePerExtra: 6.90,
    pricePerAiBlock: 15.00,
    baseAiLimit: 100,
    baseSlots: 2,
    supportNumber: '5565996835098',
    ignoredKeywords: ['PIX', 'TED', 'DOC', 'TRANSFERENCIA', 'RECEBIMENTO', 'PAGAMENTO']
};
