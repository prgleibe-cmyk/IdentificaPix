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
        const nextIso = next.toISOString();

        await profileService.updateProfile(user.id, {
            subscription_status: 'active',
            subscription_ends_at: nextIso
        });

        // 🛡️ Salva também imediatamente no cache local do usuário e assinatura para resiliência total contra deploys
        try {
            const rawUser = localStorage.getItem('iggestor_vps_user');
            if (rawUser) {
                const u = JSON.parse(rawUser);
                u.subscription_status = 'active';
                u.subscription_ends_at = nextIso;
                localStorage.setItem('iggestor_vps_user', JSON.stringify(u));
            }
            const rawSub = localStorage.getItem('iggestor_vps_subscription');
            const prevSub = rawSub ? JSON.parse(rawSub) : {};
            const diffDays = Math.ceil((next.getTime() - now.getTime()) / 86400000);
            localStorage.setItem('iggestor_vps_subscription', JSON.stringify({
                ...prevSub,
                plan: 'active',
                subscription_status: 'active',
                subscription_ends_at: nextIso,
                daysRemaining: Math.max(0, diffDays),
                totalDays: 30,
                isExpired: false
            }));
            setSubscription(s => ({
                ...s,
                plan: 'active',
                daysRemaining: Math.max(0, diffDays),
                totalDays: 30,
                isExpired: false
            }));
        } catch (_) {}

        await refreshSubscription();
    }, [user, setSubscription, refreshSubscription]);

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
