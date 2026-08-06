export interface PaymentItem {
  id?: string;
  user_id: string;
  amount: number;
  status?: string;
  notes?: string | null;
  payment_method?: string | null;
  created_at?: string;
}

export interface CreatePaymentDTO {
  user_id: string;
  amount: number;
  status?: string;
  notes?: string | null;
  payment_method?: string | null;
}

export interface UpdatePaymentDTO {
  amount?: number;
  status?: string;
  notes?: string | null;
  payment_method?: string | null;
}
