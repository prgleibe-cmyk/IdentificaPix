
import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { authService } from '../services/authService';
import { getAuthToken } from '../services/auth/authAdapter';
import { AuthContextType } from './auth/AuthContracts';
import { useSystemSettings } from './auth/useSystemSettings';
import { useSubscriptionState } from './auth/useSubscriptionState';
import { useAuthActions } from './auth/useAuthActions';
import { ResetPasswordModal } from '../components/auth/ResetPasswordModal';

const isLocalJwtExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const payload = JSON.parse(atob(base64));
    if (!payload.exp) return false;
    return Date.now() >= (payload.exp * 1000 - 30000);
  } catch {
    return true;
  }
};

const AuthContext = createContext<AuthContextType>(null!);

export const checkIsSecondaryUser = (user: any, subscription?: any): boolean => {
  if (!user && !subscription) return false;

  let localUser: any = null;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('iggestor_vps_user') : null;
    if (raw) localUser = JSON.parse(raw);
  } catch {}

  const activeUser = user || localUser;
  const userEmail = String(activeUser?.email || '').toLowerCase().trim();
  if (userEmail === 'identificapix@gmail.com') return false;

  const userRole = String(activeUser?.role || '').toLowerCase().trim();
  const subRole = String(subscription?.role || '').toLowerCase().trim();

  if (
    userRole === 'super_admin' || 
    userRole === 'administrador_geral' || 
    userRole === 'superadmin' || 
    userRole === 'admin' ||
    subRole === 'superadmin' ||
    subRole === 'admin'
  ) {
    return false;
  }

  const activeUserId = activeUser?.id || activeUser?.userId;
  const activeOwnerId = activeUser?.owner_id || activeUser?.ownerId;
  const subOwnerId = subscription?.ownerId;

  const hasDifferentOwner = Boolean(
    (activeOwnerId && activeUserId && activeOwnerId !== activeUserId) ||
    (subOwnerId && activeUserId && subOwnerId !== activeUserId)
  );

  const isExplicitMemberRole = (
    userRole === 'member' || userRole === 'operador' || userRole === 'secondary' || userRole === 'colaborador' ||
    subRole === 'member' || subRole === 'operador' || subRole === 'secondary' || subRole === 'colaborador'
  );

  return hasDifferentOwner || isExplicitMemberRole;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any | null>(() => {
    try {
      const u = authService.getUser();
      const token = authService.getAccessToken();
      if (token && u && !isLocalJwtExpired(token)) return { access_token: token, user: u };
      return null;
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<any | null>(() => {
    try {
      const u = authService.getUser();
      const token = authService.getAccessToken();
      if (token && u && !isLocalJwtExpired(token)) return u;
      return null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const token = authService.getAccessToken();
      const u = authService.getUser();
      if (!token || !u) return false;
      // If token is expired, hold loading while initAuth attempts refresh before mounting SessionProvider
      return isLocalJwtExpired(token);
    } catch {
      return false;
    }
  });
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const isSigningOut = useRef(false);

  const { systemSettings, updateSystemSettings, settingsRef } = useSystemSettings();
  const { subscription, setSubscription, calculateSubscription, lastProcessedUserId, isSubscriptionReady } = useSubscriptionState(settingsRef);

  const isSecondaryUser = useMemo(() => checkIsSecondaryUser(user, subscription), [user, subscription]);
  const isAuthReady = useMemo(() => !loading && (!user || isSubscriptionReady), [loading, user, isSubscriptionReady]);

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
        await authService.logout();
    } catch (e) {
        console.error("Erro logout:", e);
    } finally {
        isSigningOut.current = false;
        setLoading(false);
    }
  }, [lastProcessedUserId]);

  useEffect(() => {
    let mounted = true;

    const handleAuthExpired = () => {
      if (!mounted || isSigningOut.current) return;
      if (lastProcessedUserId) lastProcessedUserId.current = null;
      setSession(null);
      setUser(null);
    };

    window.addEventListener('iggestor:auth-expired', handleAuthExpired);

    async function initAuth() {
      try {
        const u = authService.getUser();
        const rawToken = authService.getAccessToken();

        if (rawToken && u) {
          const validToken = await getAuthToken();
          if (!validToken) {
            authService.clearAuthData();
            if (mounted) {
              setSession(null);
              setUser(null);
            }
            return;
          }

          const s = { access_token: validToken, user: u };
          if (mounted && !isSigningOut.current) {
            setSession(s);
            setUser(u);
            calculateSubscription(u.id);
          }

          // Validate with /me in background
          authService.me().then(res => {
            if (!mounted || isSigningOut.current) return;
            if (res.success && res.data?.user) {
              const updatedUser = res.data.user;
              setUser(updatedUser);
              setSession({ access_token: authService.getAccessToken(), user: updatedUser });
              calculateSubscription(updatedUser.id, true);
            } else if (res.status === 401 || res.status === 403) {
              authService.clearAuthData();
              if (lastProcessedUserId) lastProcessedUserId.current = null;
              setSession(null);
              setUser(null);
            }
          }).catch(() => {});
        } else {
          // Check if token in query string or URL (e.g. reset-password)
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('type') === 'recovery' || urlParams.get('resetToken')) {
            setIsResettingPassword(true);
          }
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
      window.removeEventListener('iggestor:auth-expired', handleAuthExpired);
    };
  }, [calculateSubscription, lastProcessedUserId]);

  const value = useMemo(() => ({
    session, user, loading, isSecondaryUser, signOut, subscription, isSubscriptionReady, isAuthReady, refreshSubscription,
    ...authActions,
    systemSettings, updateSystemSettings
  }), [session, user, loading, isSecondaryUser, signOut, subscription, isSubscriptionReady, isAuthReady, refreshSubscription, authActions, systemSettings, updateSystemSettings]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {isResettingPassword && (
        <ResetPasswordModal onClose={() => setIsResettingPassword(false)} />
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

