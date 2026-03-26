
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
        const { data: p } = await supabase.from('profiles').select('subscription_ends_at').eq('id', user.id).single();
        const current = (p as any)?.subscription_ends_at ? new Date((p as any).subscription_ends_at) : new Date();
        const next = new Date(current.getTime() + days * 86400000);
        await supabase.from('profiles').update({ subscription_status: 'active', subscription_ends_at: next.toISOString() }).eq('id', user.id);
        refreshSubscription();
    }, [user, refreshSubscription]);

    const updateLimits = useCallback(async (slots: number) => {
        if (!user) return;
        
        // Ao realizar qualquer upgrade de slots, definimos o limite de IA para um valor 
        // virtualmente infinito (999.999 tokens/usos) para não barrar o usuário.
        const UNLIMITED_AI = 999999;
        
        await supabase.from('profiles').update({ 
            limit_ai: UNLIMITED_AI, 
            max_churches: slots, 
            max_banks: slots 
        }).eq('id', user.id);
        
        refreshSubscription();
    }, [user, refreshSubscription]);

    const incrementAiUsage = useCallback(async () => {
        if (!user) return;
        setSubscription(s => ({ ...s, aiUsage: (s.aiUsage || 0) + 1 }));
        const { data: p } = await supabase.from('profiles').select('usage_ai').eq('id', user.id).single();
        await supabase.from('profiles').update({ usage_ai: ((p as any)?.usage_ai || 0) + 1 }).eq('id', user.id);
    }, [user, setSubscription]);

    const registerPayment = useCallback(async (amount: number, method: string, notes?: string) => {
        if (!user) return;
        await supabase.from('payments').insert({ user_id: user.id, amount, status: 'approved', notes: notes || `Via ${method}` });
        await addSubscriptionDays(30);
    }, [user, addSubscriptionDays]);

    return { addSubscriptionDays, updateLimits, incrementAiUsage, registerPayment };
};
