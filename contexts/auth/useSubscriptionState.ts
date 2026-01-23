import React, { useState, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import { SubscriptionStatus } from '../../types';
import { SystemSettings } from './AuthContracts';

// Fix: Added React to imports and typed settingsRef as React.MutableRefObject
export const useSubscriptionState = (settingsRef: React.MutableRefObject<SystemSettings>) => {
    const [subscription, setSubscription] = useState<SubscriptionStatus>({
        plan: 'trial',
        daysRemaining: 10,
        totalDays: 10,
        isExpired: false,
        isBlocked: false,
        isLifetime: false,
        aiLimit: 100, 
        aiUsage: 0,
        maxChurches: 2, 
        maxBanks: 2
    });

    const lastProcessedUserId = useRef<string | null>(null);

    const calculateSubscription = useCallback(async (userId: string | null, force: boolean = false) => {
        if (!userId) return;
        if (!force && lastProcessedUserId.current === userId) return;
        
        lastProcessedUserId.current = userId;
        const settings = settingsRef.current;

        try {
            const fetchPromise = supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000));

            const { data: profileData } = await Promise.race([fetchPromise, timeoutPromise]) as any;
            const now = new Date();
            const p = (profileData as any) || {};
            
            const isBlocked = p.is_blocked === true;
            const isLifetime = p.is_lifetime === true || p.subscription_status === 'lifetime';
            let status = p.subscription_status || 'trial';
            let daysRemaining = 0;
            
            if (isLifetime) {
                status = 'lifetime';
                daysRemaining = 9999;
            } else if (status === 'active' && p.subscription_ends_at) {
                const diff = new Date(p.subscription_ends_at).getTime() - now.getTime();
                daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
                if (daysRemaining <= 0) { status = 'expired'; daysRemaining = 0; }
            } else {
                const trialEnd = p.trial_ends_at ? new Date(p.trial_ends_at) : new Date(now.getTime() + settings.defaultTrialDays * 86400000);
                const diff = trialEnd.getTime() - now.getTime();
                daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
                if (daysRemaining <= 0) { status = 'expired'; daysRemaining = 0; }
            }

            setSubscription({
                plan: status as any,
                daysRemaining: Math.max(0, daysRemaining),
                totalDays: status === 'trial' ? settings.defaultTrialDays : 30,
                isExpired: status === 'expired',
                isBlocked,
                isLifetime,
                aiLimit: p.limit_ai || settings.baseAiLimit,
                aiUsage: p.usage_ai || 0,
                maxChurches: p.max_churches || settings.baseSlots,
                maxBanks: p.max_banks || settings.baseSlots
            });
        } catch (e) {
            console.error("Erro assinatura (resgatando padrão):", e);
        }
    }, [settingsRef]);

    return { subscription, setSubscription, calculateSubscription, lastProcessedUserId };
};