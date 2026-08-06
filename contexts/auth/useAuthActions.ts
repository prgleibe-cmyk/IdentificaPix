import React, { useCallback } from 'react';
import { profileService } from '../../services/profileService';
import { paymentService } from '../../services/paymentService';
import { SubscriptionStatus } from '../../types';

export const useAuthActions = (
    user: any, 
    setSubscription: React.Dispatch<React.SetStateAction<SubscriptionStatus>>,
    refreshSubscription: () => Promise<void>
) => {
    const addSubscriptionDays = useCallback(async (days: number) => {
        if (!user) return;
        const p = await profileService.getProfile(user.id);
        const now = new Date();
        const currentEnd = p?.subscription_ends_at ? new Date(p.subscription_ends_at) : now;
        const baseDate = currentEnd.getTime() < now.getTime() ? now : currentEnd;
        const next = new Date(baseDate.getTime() + days * 86400000);
        await profileService.updateProfile(user.id, {
            subscription_status: 'active',
            subscription_ends_at: next.toISOString()
        });
        await refreshSubscription();
    }, [user, refreshSubscription]);

    const updateLimits = useCallback(async (slots: number) => {
        if (!user) return;
        
        const UNLIMITED_AI = 999999;
        
        await profileService.updateProfile(user.id, { 
            limit_ai: UNLIMITED_AI, 
            max_churches: slots, 
            max_banks: slots 
        });
        
        refreshSubscription();
    }, [user, refreshSubscription]);

    const incrementAiUsage = useCallback(async () => {
        if (!user) return;
        setSubscription(s => ({ ...s, aiUsage: (s.aiUsage || 0) + 1 }));
        const p = await profileService.getProfile(user.id);
        const currentUsage = p?.usage_ai || 0;
        await profileService.updateProfile(user.id, { usage_ai: currentUsage + 1 });
    }, [user, setSubscription]);

    const registerPayment = useCallback(async (amount: number, method: string, notes?: string) => {
        if (!user) return;
        await paymentService.recordPaymentInDb(user.id, amount, 'approved', notes || `Via ${method}`, method);
        await addSubscriptionDays(30);
    }, [user, addSubscriptionDays]);

    return { addSubscriptionDays, updateLimits, incrementAiUsage, registerPayment };
};
