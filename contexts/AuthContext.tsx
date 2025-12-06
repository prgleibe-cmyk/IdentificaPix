
import React, { createContext, useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { usePersistentState } from '../hooks/usePersistentState';
import { SubscriptionStatus } from '../types';
import { Logger } from '../services/monitoringService';

interface SystemSettings {
    defaultTrialDays: number;
    pixKey: string;
    monthlyPrice: number;
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
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: Partial<SystemSettings>) => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // CHANGED: Use standard useState instead of usePersistentState for session/user.
  // Supabase SDK handles persistence internally (localStorage 'sb-<project>-auth-token').
  // Double persistence was causing race conditions and infinite loops.
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  // System Settings - These can remain persistent
  const [defaultTrialDays, setDefaultTrialDays] = usePersistentState<number>('identificapix-sys-trial-days', 10);
  const [pixKey, setPixKey] = usePersistentState<string>('identificapix-sys-pix-key', '');
  const [monthlyPrice, setMonthlyPrice] = usePersistentState<number>('identificapix-sys-price', 29.90);

  const [subscription, setSubscription] = useState<SubscriptionStatus>({
      plan: 'trial',
      daysRemaining: 10,
      totalDays: 10,
      isExpired: false,
      isBlocked: false,
      isLifetime: false,
      trialEndsAt: null,
      subscriptionEndsAt: null
  });
  
  const [loading, setLoading] = useState(true);

  // Helper to add days
  const addDays = (date: Date, days: number): Date => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
  };

  const updateSystemSettings = useCallback((settings: Partial<SystemSettings>) => {
      if (settings.defaultTrialDays !== undefined) {
          setDefaultTrialDays(settings.defaultTrialDays);
      }
      if (settings.pixKey !== undefined) {
          setPixKey(settings.pixKey);
      }
      if (settings.monthlyPrice !== undefined) {
          setMonthlyPrice(settings.monthlyPrice);
      }
  }, [setDefaultTrialDays, setPixKey, setMonthlyPrice]);

  // Logic to calculate subscription status
  const defaultTrialDaysRef = useRef(defaultTrialDays);
  useEffect(() => { defaultTrialDaysRef.current = defaultTrialDays; }, [defaultTrialDays]);

  const calculateSubscription = useCallback(async (currentUser: User | null) => {
      if (!currentUser) return;

      const TRIAL_DURATION_DAYS = defaultTrialDaysRef.current;
      let profileData: any = null;

      try {
          const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .single();
          
          if (!error && data) {
              profileData = data;
          }
      } catch (e) {
          // Table likely doesn't exist yet, proceed to fallback
      }

      if (!profileData) {
          const localKey = `identificapix_profile_v2_${currentUser.id}`;
          const localStored = localStorage.getItem(localKey);
          
          if (localStored) {
              profileData = JSON.parse(localStored);
          } else {
              const now = new Date();
              const trialEnds = addDays(now, TRIAL_DURATION_DAYS);
              profileData = {
                  subscription_status: 'trial',
                  trial_ends_at: trialEnds.toISOString(),
                  subscription_ends_at: null,
                  is_blocked: false,
                  is_lifetime: false
              };
              localStorage.setItem(localKey, JSON.stringify(profileData));
          }
      }

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

      setSubscription({
          plan: status,
          daysRemaining: Math.max(0, daysRemaining),
          totalDays,
          isExpired: status === 'expired',
          isBlocked,
          isLifetime,
          trialEndsAt: profileData.trial_ends_at,
          subscriptionEndsAt: profileData.subscription_ends_at
      });

  }, []);

  const addSubscriptionDays = useCallback(async (days: number) => {
      if (!user) return;
      const now = new Date();
      let newEndDate: Date;

      // Use current subscription state directly or re-fetch. Here we use state assuming it is fresh enough.
      // Ideally pass current values or fetch again.
      let currentSubEnd = null;
      // Re-read latest profile to be safe
      const { data: profile } = await supabase.from('profiles').select('subscription_ends_at, subscription_status').eq('id', user.id).single();
      if(profile && profile.subscription_status === 'active' && profile.subscription_ends_at) {
          currentSubEnd = new Date(profile.subscription_ends_at);
      }

      if (currentSubEnd && currentSubEnd > now) {
          newEndDate = addDays(currentSubEnd, days);
      } else {
          newEndDate = addDays(now, days);
      }

      const updatePayload = {
          subscription_status: 'active',
          subscription_ends_at: newEndDate.toISOString(),
      };

      const { error } = await supabase
          .from('profiles')
          .upsert({ 
              id: user.id, 
              ...updatePayload,
              updated_at: new Date().toISOString()
          });

      const localKey = `identificapix_profile_v2_${user.id}`;
      const existingLocal = localStorage.getItem(localKey) ? JSON.parse(localStorage.getItem(localKey)!) : {};
      localStorage.setItem(localKey, JSON.stringify({ ...existingLocal, ...updatePayload }));

      if (error) {
          Logger.warn("Failed to sync subscription to Supabase (using local fallback)", error);
      }
      await calculateSubscription(user);
  }, [user, calculateSubscription]);

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

  // Auth Initialization Effect
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (mounted) {
                // Ensure we only set state if mounted
                setSession(currentSession);
                setUser(currentSession?.user ?? null);
                
                if (currentSession?.user) {
                    await calculateSubscription(currentSession.user);
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
      if (mounted) {
          // Careful handling of state updates to avoid unnecessary renders
          setSession(newSession);
          setUser(newSession?.user ?? null);
          
          if (newSession?.user) {
              await calculateSubscription(newSession.user);
          } else {
              // Reset subscription if logged out
              setSubscription({
                  plan: 'trial',
                  daysRemaining: 10,
                  totalDays: 10,
                  isExpired: false,
                  isBlocked: false,
                  isLifetime: false,
                  trialEndsAt: null,
                  subscriptionEndsAt: null
              });
          }
          setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener?.unsubscribe();
    };
  }, [calculateSubscription]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSubscription({
      plan: 'trial',
      daysRemaining: 0,
      totalDays: 10,
      isExpired: false,
      isBlocked: false,
      isLifetime: false
    });
  }, []);

  const refreshSubscription = useCallback(async () => await calculateSubscription(user), [calculateSubscription, user]);

  const value = useMemo(() => ({
    session,
    user,
    loading,
    signOut,
    subscription,
    refreshSubscription,
    addSubscriptionDays,
    registerPayment,
    systemSettings: { defaultTrialDays, pixKey, monthlyPrice },
    updateSystemSettings
  }), [session, user, loading, signOut, subscription, refreshSubscription, addSubscriptionDays, registerPayment, defaultTrialDays, pixKey, monthlyPrice, updateSystemSettings]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
