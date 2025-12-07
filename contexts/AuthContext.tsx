import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../services/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { usePersistentState } from '../hooks/usePersistentState';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use persistent state to load session immediately from localStorage if available.
  // This enables "Optimistic Auth", allowing the UI to render instantly before the network request completes.
  const [session, setSession] = usePersistentState<Session | null>('identificapix-auth-session', null);
  const [user, setUser] = usePersistentState<User | null>('identificapix-auth-user', null);
  
  // If we have a cached session, we skip the initial loading state.
  const [loading, setLoading] = useState(!session);

  useEffect(() => {
    const getSession = async () => {
        // We still fetch the session to validate it, but the UI is already rendered.
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
    }
    
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [setSession, setUser]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  const value = {
    session,
    user,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};