
import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { AuthContextType } from './auth/AuthContracts';
import { useSystemSettings } from './auth/useSystemSettings';
import { useSubscriptionState } from './auth/useSubscriptionState';
import { useAuthActions } from './auth/useAuthActions';

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const isSigningOut = useRef(false);

  const { systemSettings, updateSystemSettings, settingsRef } = useSystemSettings();
  const { subscription, setSubscription, calculateSubscription, lastProcessedUserId } = useSubscriptionState(settingsRef);

  const refreshSubscription = useCallback(async () => {
    if (user) await calculateSubscription(user.id, true);
  }, [user, calculateSubscription]);

  const authActions = useAuthActions(user, setSubscription, refreshSubscription);

  const signOut = useCallback(async () => {
    if (isSigningOut.current) return;
    isSigningOut.current = true;
    setLoading(true);
    try {
        if (lastProcessedUserId) lastProcessedUserId.current = null;
        setSession(null);
        setUser(null);
        await (supabase.auth as any).signOut();
        Object.keys(localStorage).forEach(key => {
            if (key.includes('supabase.auth.token') || key.includes('identificapix')) {
                localStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.error("Erro logout:", e);
    } finally {
        isSigningOut.current = false;
        setLoading(false);
    }
  }, [lastProcessedUserId]);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription: authListener } } = (supabase.auth as any).onAuthStateChange(async (event: any, newSession: any) => {
        if (!mounted || isSigningOut.current) return;
        if (newSession) {
            setSession(newSession);
            setUser(newSession.user);
            calculateSubscription(newSession.user.id);
        } else {
            setSession(null);
            setUser(null);
        }
        setLoading(false);
    });

    (supabase.auth as any).getSession().then(({ data: { session: s } }: any) => {
        if (mounted && !isSigningOut.current) {
            if (s) {
                setSession(s);
                setUser(s.user);
                calculateSubscription(s.user.id);
            }
            setLoading(false);
        }
    });

    return () => {
      mounted = false;
      authListener?.unsubscribe();
    };
  }, [calculateSubscription]);

  const value = useMemo(() => ({
    session, user, loading, signOut, subscription, refreshSubscription,
    ...authActions,
    systemSettings, updateSystemSettings
  }), [session, user, loading, signOut, subscription, refreshSubscription, authActions, systemSettings, updateSystemSettings]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
