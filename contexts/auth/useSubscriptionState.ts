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
        maxBanks: 2,
        role: 'owner',
        ownerId: ''
    });

    const lastProcessedUserId = useRef<string | null>(null);

    const calculateSubscription = useCallback(async (userId: string | null, force: boolean = false) => {
        if (!userId) return;
        if (!force && lastProcessedUserId.current === userId) return;
        
        lastProcessedUserId.current = userId;
        const settings = settingsRef.current;

        try {
            // Usar a nova API segura para buscar dados de assinatura (resolve problemas de RLS)
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            
            if (!token) {
                console.warn('[Subscription] Token não encontrado, abortando cálculo.');
                return;
            }

            const response = await fetch(`/api/users/subscription/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Erro na API de assinatura: ${response.statusText}`);
            }

            const p = await response.json();
            const now = new Date();
            
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

            const congregationRaw = p.congregation;
            let permissions = p.permissions || {};
            
            // Garantir que permissions seja um objeto
            if (typeof permissions === 'string') {
                try {
                    permissions = JSON.parse(permissions);
                } catch (e) {
                    console.error("Erro ao parsear permissões:", e);
                    permissions = {};
                }
            }
            
            let congregationIds: string[] = [];
            let bankIds: string[] = [];
            
            if (permissions && Array.isArray(permissions.congregationIds)) {
                congregationIds = permissions.congregationIds;
            } 
            else if (Array.isArray(congregationRaw)) {
                congregationIds = congregationRaw;
            } else if (typeof congregationRaw === 'string' && congregationRaw.length > 0) {
                if (congregationRaw.includes(',')) {
                    congregationIds = congregationRaw.split(',').map(id => id.trim()).filter(id => !!id);
                } else {
                    congregationIds = [congregationRaw];
                }
            }

            if (permissions && Array.isArray(permissions.bankIds)) {
                bankIds = permissions.bankIds;
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
                maxBanks: p.max_banks || settings.baseSlots,
                role: p.role || 'owner',
                ownerId: p.owner_id || userId,
                congregationId: congregationIds[0] || undefined,
                congregationIds: congregationIds,
                bankIds: bankIds,
                permissions: permissions
            });
            console.log(`[Subscription] Sucesso para ${userId}. Role: ${p.role}, Owner: ${p.owner_id || userId}`);
        } catch (e) {
            console.error("Erro assinatura (resgatando padrão):", e);
        }
    }, [settingsRef]);

    return { subscription, setSubscription, calculateSubscription, lastProcessedUserId };
};