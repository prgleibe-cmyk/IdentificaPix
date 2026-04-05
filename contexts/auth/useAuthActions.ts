
import React, { useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { SubscriptionStatus } from '../../types';

export const useAuthActions = (
    user: any, 
    subscription: any,
    setSubscription: React.Dispatch<React.SetStateAction<SubscriptionStatus>>,
    refreshSubscription: () => Promise<void>
) => {
    const effectiveUserId = subscription?.ownerId || user?.owner_id || user?.id;

    const addSubscriptionDays = useCallback(async (days: number) => {
        if (!effectiveUserId) return;
        const { data: p } = await (supabase.from('profiles') as any).select('subscription_ends_at').eq('id', effectiveUserId).single();
        const current = (p as any)?.subscription_ends_at ? new Date((p as any).subscription_ends_at) : new Date();
        const next = new Date(current.getTime() + days * 86400000);
        await (supabase.from('profiles') as any).update({ subscription_status: 'active', subscription_ends_at: next.toISOString() }).eq('id', effectiveUserId);
        refreshSubscription();
    }, [effectiveUserId, refreshSubscription]);

    const updateLimits = useCallback(async (slots: number) => {
        if (!effectiveUserId) return;
        
        // Ao realizar qualquer upgrade de slots, definimos o limite de IA para um valor 
        // virtualmente infinito (999.999 tokens/usos) para não barrar o usuário.
        const UNLIMITED_AI = 999999;
        
        await (supabase.from('profiles') as any).update({ 
            limit_ai: UNLIMITED_AI, 
            max_churches: slots, 
            max_banks: slots 
        }).eq('id', effectiveUserId);
        
        refreshSubscription();
    }, [effectiveUserId, refreshSubscription]);

    const incrementAiUsage = useCallback(async () => {
        if (!effectiveUserId) return;
        setSubscription(s => ({ ...s, aiUsage: (s.aiUsage || 0) + 1 }));
        const { data: p } = await (supabase.from('profiles') as any).select('usage_ai').eq('id', effectiveUserId).single();
        await (supabase.from('profiles') as any).update({ usage_ai: ((p as any)?.usage_ai || 0) + 1 }).eq('id', effectiveUserId);
    }, [effectiveUserId, setSubscription]);

    const registerPayment = useCallback(async (amount: number, method: string, notes?: string) => {
        if (!effectiveUserId) return;
        await (supabase.from('payments') as any).insert({ user_id: effectiveUserId, amount, status: 'approved', notes: notes || `Via ${method}` });
        await addSubscriptionDays(30);
    }, [effectiveUserId, addSubscriptionDays]);

    return { addSubscriptionDays, updateLimits, incrementAiUsage, registerPayment };
};
