
import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { usePersistentState } from '../hooks/usePersistentState';
import { SubscriptionStatus } from '../types';

interface SystemSettings {
    defaultTrialDays: number;
    pixKey: string;
    monthlyPrice: number;
    pricePerExtra: number; 
    pricePerAiBlock: number;
    baseAiLimit: number;
    baseSlots: number;
    supportNumber: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  subscription: SubscriptionStatus;
  refreshSubscription: () => Promise<void>;
  addSubscriptionDays: (days: number) => Promise<void>;
  registerPayment: (amount: number, method: string, notes?: string, receiptUrl?: string) => Promise<void>;
  incrementAiUsage: () => Promise<void>;
  updateLimits: (slots: number, aiPacks: number) => Promise<void>;
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: Partial<SystemSettings>) => void;
}

const AuthContext = createContext<AuthContextType>(null!);

const DEFAULT_SETTINGS: SystemSettings = {
    defaultTrialDays: 10,
    pixKey: '',
    monthlyPrice: 79.90,
    pricePerExtra: 19.90, 
    pricePerAiBlock: 15.00,
    baseAiLimit: 100,
    baseSlots: 2,
    supportNumber: '5511999999999'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const isSigningOut = useRef(false);
  const lastProcessedUserId = useRef<string | null>(null);
  
  const [systemSettings, setSystemSettings] = usePersistentState<SystemSettings>('identificapix-settings-v5', DEFAULT_SETTINGS);
  const settingsRef = useRef(systemSettings);

  useEffect(() => {
    settingsRef.current = systemSettings;
  }, [systemSettings]);

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

  const calculateSubscription = useCallback(async (currentUser: User | null, force: boolean = false) => {
      if (!currentUser || isSigningOut.current) return;
      
      // Bloqueia re-calculos inúteis que causam loop
      if (!force && lastProcessedUserId.current === currentUser.id) return;
      lastProcessedUserId.current = currentUser.id;

      const settings = settingsRef.current;
      const TRIAL_DAYS = settings.defaultTrialDays;
      const BASE_AI = settings.baseAiLimit;
      const BASE_SLOTS = settings.baseSlots;

      try {
          const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .maybeSingle();
          
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
              const trialEnd = p.trial_ends_at ? new Date(p.trial_ends_at) : new Date(now.getTime() + TRIAL_DAYS * 86400000);
              const diff = trialEnd.getTime() - now.getTime();
              daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
              if (daysRemaining <= 0) { status = 'expired'; daysRemaining = 0; }
          }

          setSubscription({
              plan: status as any,
              daysRemaining: Math.max(0, daysRemaining),
              totalDays: status === 'trial' ? TRIAL_DAYS : 30,
              isExpired: status === 'expired',
              isBlocked,
              isLifetime,
              aiLimit: p.limit_ai || BASE_AI,
              aiUsage: p.usage_ai || 0,
              maxChurches: p.max_churches || BASE_SLOTS,
              maxBanks: p.max_banks || BASE_SLOTS
          });
      } catch (e) {
          console.error("Erro assinatura:", e);
      }
  }, []);

  const signOut = useCallback(async () => {
    if (isSigningOut.current) return;
    isSigningOut.current = true;
    setLoading(true);

    try {
        // Limpeza imediata dos estados para interromper qualquer efeito colateral
        lastProcessedUserId.current = null;
        setSession(null);
        setUser(null);
        
        await supabase.auth.signOut();
        
        // Limpeza agressiva de storage
        const storageKeys = Object.keys(localStorage);
        storageKeys.forEach(key => {
            if (key.includes('supabase.auth.token') || key.includes('identificapix-results')) {
                localStorage.removeItem(key);
            }
        });

        setSubscription({
            plan: 'trial',
            daysRemaining: 0,
            totalDays: 10,
            isExpired: false,
            isBlocked: false,
            isLifetime: false,
            aiLimit: 100,
            aiUsage: 0,
            maxChurches: 2,
            maxBanks: 2
        });
    } catch (e) {
        console.error("Erro ao sair:", e);
    } finally {
        isSigningOut.current = false;
        setLoading(false);
    }
  }, []);

  // Listener ÚNICO e ESTÁVEL. Não depende de funções que mudam.
  useEffect(() => {
    let mounted = true;

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!mounted || isSigningOut.current) return;

        if (newSession) {
            setSession(newSession);
            setUser(newSession.user);
            await calculateSubscription(newSession.user);
        } else {
            setSession(null);
            setUser(null);
            lastProcessedUserId.current = null;
        }
        setLoading(false);
    });

    // Hidratação inicial silenciosa
    supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (mounted && !isSigningOut.current) {
            if (s) {
                setSession(s);
                setUser(s.user);
                calculateSubscription(s.user);
            }
            setLoading(false);
        }
    });

    return () => {
      mounted = false;
      authListener?.unsubscribe();
    };
  }, [calculateSubscription]);

  const updateSystemSettings = useCallback((newSettings: Partial<SystemSettings>) => {
      setSystemSettings(prev => ({ ...prev, ...newSettings }));
  }, [setSystemSettings]);

  const refreshSubscription = useCallback(() => calculateSubscription(user, true), [calculateSubscription, user]);

  const addSubscriptionDays = useCallback(async (days: number) => {
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('subscription_ends_at').eq('id', user.id).single();
      const current = (p as any)?.subscription_ends_at ? new Date((p as any).subscription_ends_at) : new Date();
      const next = new Date(current.getTime() + days * 86400000);
      await supabase.from('profiles').update({ subscription_status: 'active', subscription_ends_at: next.toISOString() }).eq('id', user.id);
      await calculateSubscription(user, true);
  }, [user, calculateSubscription]);

  const updateLimits = useCallback(async (slots: number, aiPacks: number) => {
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('limit_ai').eq('id', user.id).single();
      const newLimit = ((p as any)?.limit_ai || 100) + (aiPacks * 1000);
      await supabase.from('profiles').update({ limit_ai: newLimit, max_churches: slots, max_banks: slots }).eq('id', user.id);
      await calculateSubscription(user, true);
  }, [user, calculateSubscription]);

  const incrementAiUsage = useCallback(async () => {
      if (!user) return;
      setSubscription(s => ({ ...s, aiUsage: (s.aiUsage || 0) + 1 }));
      const { data: p } = await supabase.from('profiles').select('usage_ai').eq('id', user.id).single();
      await supabase.from('profiles').update({ usage_ai: ((p as any)?.usage_ai || 0) + 1 }).eq('id', user.id);
  }, [user]);

  const registerPayment = useCallback(async (amount: number, method: string, notes?: string) => {
      if (!user) return;
      await supabase.from('payments').insert({ user_id: user.id, amount, status: 'approved', notes: notes || `Via ${method}` });
      await addSubscriptionDays(30);
  }, [user, addSubscriptionDays]);

  const value = useMemo(() => ({
    session, user, loading, signOut, subscription, refreshSubscription,
    addSubscriptionDays, registerPayment, incrementAiUsage, updateLimits,
    systemSettings, updateSystemSettings
  }), [session, user, loading, signOut, subscription, refreshSubscription, addSubscriptionDays, registerPayment, incrementAiUsage, updateLimits, systemSettings, updateSystemSettings]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
