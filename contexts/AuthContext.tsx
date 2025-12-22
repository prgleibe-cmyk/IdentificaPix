
import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { usePersistentState } from '../hooks/usePersistentState';
import { SubscriptionStatus } from '../types';
import { Logger } from '../services/monitoringService';

interface SystemSettings {
    defaultTrialDays: number;
    pixKey: string;
    monthlyPrice: number;
    pricePerExtra: number; 
    pricePerAiBlock: number;
    baseAiLimit: number; // New: Base AI limit for new trials/plans
    baseSlots: number;   // New: Base Slots for new trials/plans
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
  
  // Settings Version bumped to v5 to force new defaults
  const [systemSettings, setSystemSettings] = usePersistentState<SystemSettings>('identificapix-settings-v5', DEFAULT_SETTINGS);

  const [subscription, setSubscription] = useState<SubscriptionStatus>({
      plan: 'trial',
      daysRemaining: 10,
      totalDays: 10,
      isExpired: false,
      isBlocked: false,
      isLifetime: false,
      trialEndsAt: null,
      subscriptionEndsAt: null,
      customPrice: null,
      aiLimit: 100, 
      aiUsage: 0,
      maxChurches: 1, 
      maxBanks: 1
  });

  const addDays = (date: Date, days: number): Date => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
  };

  const updateSystemSettings = useCallback((newSettings: Partial<SystemSettings>) => {
      setSystemSettings(prev => ({ ...prev, ...newSettings }));
  }, [setSystemSettings]);

  const calculateSubscription = useCallback(async (currentUser: User | null) => {
      if (!currentUser) return;

      const TRIAL_DURATION_DAYS = systemSettings.defaultTrialDays;
      const BASE_AI = systemSettings.baseAiLimit;
      const BASE_SLOTS = systemSettings.baseSlots;

      let profileData: any = null;

      try {
          const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .maybeSingle();
          
          if (data) {
              profileData = data;
          } else {
              const now = new Date();
              const trialEnds = addDays(now, TRIAL_DURATION_DAYS);
              profileData = {
                  subscription_status: 'trial',
                  trial_ends_at: trialEnds.toISOString(),
                  is_blocked: false,
                  is_lifetime: false,
                  limit_ai: BASE_AI,
                  usage_ai: 0,
                  max_churches: BASE_SLOTS,
                  max_banks: BASE_SLOTS
              };
          }
      } catch (e) {
          console.error("Erro ao calcular assinatura:", e);
      }

      if (!profileData) profileData = {};

      const now = new Date();
      const isBlocked = profileData.is_blocked === true;
      const isLifetime = profileData.is_lifetime === true || profileData.subscription_status === 'lifetime';
      
      let status: 'trial' | 'active' | 'expired' | 'lifetime' = profileData.subscription_status || 'trial';
      let daysRemaining = 0;
      let totalDays = 30;
      
      if (isLifetime) {
          status = 'lifetime';
          daysRemaining = 9999;
          totalDays = 9999;
      } else if (status === 'active') {
          const subEnd = profileData.subscription_ends_at ? new Date(profileData.subscription_ends_at) : now;
          const diffTime = subEnd.getTime() - now.getTime();
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (daysRemaining <= 0) {
              status = 'expired';
              daysRemaining = 0;
          }
      } else {
          const trialEnd = profileData.trial_ends_at ? new Date(profileData.trial_ends_at) : now;
          const diffTime = trialEnd.getTime() - now.getTime();
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          totalDays = TRIAL_DURATION_DAYS; 
          if (daysRemaining <= 0) {
              status = 'expired';
              daysRemaining = 0;
          }
      }

      setSubscription(prev => {
          if (
              prev.plan === status &&
              prev.daysRemaining === Math.max(0, daysRemaining) &&
              prev.aiUsage === profileData.usage_ai &&
              prev.isBlocked === isBlocked &&
              prev.aiLimit === profileData.limit_ai &&
              prev.maxChurches === profileData.max_churches
          ) {
              return prev;
          }
          return {
              plan: status,
              daysRemaining: Math.max(0, daysRemaining),
              totalDays,
              isExpired: status === 'expired',
              isBlocked,
              isLifetime,
              trialEndsAt: profileData.trial_ends_at,
              subscriptionEndsAt: profileData.subscription_ends_at,
              customPrice: profileData.custom_price || null,
              aiLimit: profileData.limit_ai || BASE_AI,
              aiUsage: profileData.usage_ai || 0,
              maxChurches: profileData.max_churches || BASE_SLOTS,
              maxBanks: profileData.max_banks || BASE_SLOTS
          };
      });

  }, [systemSettings.defaultTrialDays, systemSettings.baseAiLimit, systemSettings.baseSlots]);

  const addSubscriptionDays = useCallback(async (days: number) => {
      if (!user) return;
      const now = new Date();
      let newEndDate: Date;

      const { data: profile } = await supabase.from('profiles').select('subscription_ends_at, subscription_status').eq('id', user.id).single();
      let currentSubEnd = null;
      if(profile && profile.subscription_status === 'active' && profile.subscription_ends_at) {
          currentSubEnd = new Date(profile.subscription_ends_at);
      }

      if (currentSubEnd && currentSubEnd > now) {
          newEndDate = addDays(currentSubEnd, days);
      } else {
          newEndDate = addDays(now, days);
      }

      const updatePayload = {
          subscription_status: 'active' as const,
          subscription_ends_at: newEndDate.toISOString(),
      };

      await supabase.from('profiles').upsert({ id: user.id, ...updatePayload });
      await calculateSubscription(user);
  }, [user, calculateSubscription]);

  const updateLimits = useCallback(async (slots: number, aiPacks: number) => {
      if (!user) return;
      try {
          const { data: currentProfile } = await supabase.from('profiles').select('limit_ai').eq('id', user.id).single();
          const currentLimit = currentProfile?.limit_ai || systemSettings.baseAiLimit;
          
          await supabase.from('profiles').update({ 
              limit_ai: currentLimit + (aiPacks * 1000),
              max_churches: slots,
              max_banks: slots
          }).eq('id', user.id);
          
      } catch (e) {
          console.error("Erro ao atualizar limites no DB:", e);
      }
      await calculateSubscription(user);
  }, [user, calculateSubscription, systemSettings.baseAiLimit]);

  const registerPayment = useCallback(async (amount: number, method: string, notes?: string, receiptUrl?: string) => {
      if (!user) return;
      try {
          await supabase.from('payments').insert({
              user_id: user.id,
              amount: amount,
              status: 'approved',
              notes: notes || `Pago via ${method}`,
              receipt_url: receiptUrl || null,
              created_at: new Date().toISOString()
          });
      } catch (error) {
          Logger.error("Failed to log payment to DB", error);
      }
      await addSubscriptionDays(30);
  }, [user, addSubscriptionDays]);

  const incrementAiUsage = useCallback(async () => {
        if (!user) return;
        setSubscription(prev => ({ ...prev, aiUsage: (prev.aiUsage || 0) + 1 }));
        try {
            const { data: currentProfile } = await supabase.from('profiles').select('usage_ai').eq('id', user.id).single();
            const currentUsage = currentProfile?.usage_ai || 0;
            await supabase.from('profiles').update({ usage_ai: currentUsage + 1 }).eq('id', user.id);
        } catch (error) {
            console.error("Failed to increment usage", error);
        }
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (mounted) {
                setSession(currentSession);
                const newUser = currentSession?.user ?? null;
                setUser(newUser);
                if (newUser) {
                    await calculateSubscription(newUser);
                }
            }
        } catch (error) {
            console.error("Auth init error:", error);
        } finally {
            if (mounted) setLoading(false);
        }
    };
    initAuth();
    
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      if (event === 'TOKEN_REFRESHED') return;

      setSession(newSession);
      const newUser = newSession?.user ?? null;
      setUser(newUser);

      if (newUser) {
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
              await calculateSubscription(newUser);
          }
      } else if (event === 'SIGNED_OUT') {
          setSubscription({
              plan: 'trial',
              daysRemaining: 10,
              totalDays: 10,
              isExpired: false,
              isBlocked: false,
              isLifetime: false,
              trialEndsAt: null,
              subscriptionEndsAt: null,
              customPrice: null,
              aiLimit: 100,
              aiUsage: 0,
              maxChurches: 1,
              maxBanks: 1
          });
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener?.unsubscribe();
    };
  }, [calculateSubscription]);

  const signOut = useCallback(async () => {
    // Immediate UI feedback
    setSession(null);
    setUser(null);

    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error("Error signing out:", error);
    } finally {
        // Redundancy: Ensure storage is cleared for Supabase keys
        Object.keys(localStorage).forEach(key => {
            if (key.includes('supabase.auth.token')) {
                localStorage.removeItem(key);
            }
        });

        setSubscription({
              plan: 'trial',
              daysRemaining: 10,
              totalDays: 10,
              isExpired: false,
              isBlocked: false,
              isLifetime: false,
              trialEndsAt: null,
              subscriptionEndsAt: null,
              customPrice: null,
              aiLimit: 100,
              aiUsage: 0,
              maxChurches: 1,
              maxBanks: 1
          });
    }
  }, []);

  const refreshSubscription = useCallback(async () => {
      await calculateSubscription(user);
  }, [calculateSubscription, user]);

  const value = useMemo(() => ({
    session,
    user,
    loading,
    signOut,
    subscription,
    refreshSubscription,
    addSubscriptionDays,
    registerPayment,
    incrementAiUsage,
    updateLimits,
    systemSettings,
    updateSystemSettings
  }), [session, user, loading, signOut, subscription, refreshSubscription, addSubscriptionDays, registerPayment, incrementAiUsage, updateLimits, systemSettings, updateSystemSettings]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
