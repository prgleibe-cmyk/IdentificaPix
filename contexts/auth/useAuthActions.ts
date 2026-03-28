
import React, { useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { SubscriptionStatus } from '../../types';

export const useAuthActions = (
    user: any, 
    // Fix: Added React to imports and typed setSubscription using React.Dispatch and React.SetStateAction
    setSubscription: React.Dispatch<React.SetStateAction<SubscriptionStatus>>,
    refreshSubscription: () => Promise<void>
) => {
    const addSubscriptionDays = useCallback(async (days: number) => {
        if (!user) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;

            const response = await fetch('/api/users/subscription/add-days', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ days, userId: user.id })
            });

            if (!response.ok) throw new Error("Erro ao adicionar dias via API");
            refreshSubscription();
        } catch (e) {
            console.error("[AuthActions] Falha ao adicionar dias via API", e);
        }
    }, [user, refreshSubscription]);

    const updateLimits = useCallback(async (slots: number) => {
        if (!user) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;

            const response = await fetch('/api/users/subscription/update-limits', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ slots, userId: user.id })
            });

            if (!response.ok) throw new Error("Erro ao atualizar limites via API");
            refreshSubscription();
        } catch (e) {
            console.error("[AuthActions] Falha ao atualizar limites via API", e);
        }
    }, [user, refreshSubscription]);

    const incrementAiUsage = useCallback(async () => {
        if (!user) return;
        setSubscription(s => ({ ...s, aiUsage: (s.aiUsage || 0) + 1 }));
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;

            await fetch('/api/users/subscription/increment-ai', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) {
            console.error("[AuthActions] Falha ao incrementar IA via API", e);
        }
    }, [user, setSubscription]);

    const registerPayment = useCallback(async (amount: number, method: string, notes?: string) => {
        if (!user) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;

            const response = await fetch('/api/users/payment/register', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ amount, notes: notes || `Via ${method}`, userId: user.id })
            });

            if (!response.ok) throw new Error("Erro ao registrar pagamento via API");
            await addSubscriptionDays(30);
        } catch (e) {
            console.error("[AuthActions] Falha ao registrar pagamento via API", e);
        }
    }, [user, addSubscriptionDays]);

    return { addSubscriptionDays, updateLimits, incrementAiUsage, registerPayment };
};
