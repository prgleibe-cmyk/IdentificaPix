
import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { authService } from '../services/authService';
import { AuthContextType } from './auth/AuthContracts';
import { useSystemSettings } from './auth/useSystemSettings';
import { useSubscriptionState } from './auth/useSubscriptionState';
import { useAuthActions } from './auth/useAuthActions';
import { ResetPasswordModal } from '../components/auth/ResetPasswordModal';

const AuthContext = createContext<AuthContextType>(null!);

export const checkIsSecondaryUser = (user: any, subscription?: any): boolean => {
  if (!user) return false;
  const userEmail = String(user?.email || '').toLowerCase().trim();
  if (userEmail === 'identificapix@gmail.com') return false;

  const userRole = String(user?.role || '').toLowerCase().trim();
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

  const hasDifferentOwner = Boolean(
    (user?.owner_id && user.owner_id !== user?.id) ||
    (subscription?.ownerId && subscription.ownerId !== user?.id)
  );

  const isExplicitMemberRole = (
    userRole === 'member' || userRole === 'user' || userRole === 'operador' || userRole === 'secondary' ||
    subRole === 'member' || subRole === 'user' || subRole === 'operador' || subRole === 'secondary'
  );

  return hasDifferentOwner || isExplicitMemberRole;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const isSigningOut = useRef(false);

  const { systemSettings, updateSystemSettings, settingsRef } = useSystemSettings();
  const { subscription, setSubscription, calculateSubscription, lastProcessedUserId } = useSubscriptionState(settingsRef);

  const isSecondaryUser = useMemo(() => checkIsSecondaryUser(user, subscription), [user, subscription]);

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

    async function initAuth() {
      try {
        const u = authService.getUser();
        const token = authService.getAccessToken();

        if (token && u) {
          const s = { access_token: token, user: u };
          if (mounted && !isSigningOut.current) {
            setSession(s);
            setUser(u);
            calculateSubscription(u.id);
          }
          // Validate with /me in background
          authService.me().then(res => {
            if (res.success && res.data?.user && mounted) {
              const updatedUser = res.data.user;
              setUser(updatedUser);
              setSession({ access_token: authService.getAccessToken(), user: updatedUser });
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
    };
  }, [calculateSubscription]);

  const value = useMemo(() => ({
    session, user, loading, isSecondaryUser, signOut, subscription, refreshSubscription,
    ...authActions,
    systemSettings, updateSystemSettings
  }), [session, user, loading, isSecondaryUser, signOut, subscription, refreshSubscription, authActions, systemSettings, updateSystemSettings]);

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

