import { IAuthProvider, AuthProviderType, AuthSession, AuthUser } from '../types';

const ACCESS_TOKEN_KEY = 'iggestor_vps_access_token';
const REFRESH_TOKEN_KEY = 'iggestor_vps_refresh_token';
const USER_KEY = 'iggestor_vps_user';

export class LocalAuthProvider implements IAuthProvider {
  readonly type: AuthProviderType = 'LOCAL';

  async getToken(): Promise<string | null> {
    try {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!token) return null;

      // Check if JWT is expired without external lib if possible
      const isExpired = this.isTokenExpired(token);
      if (isExpired) {
        // Attempt refresh
        const refreshedToken = await this.tryRefreshToken();
        return refreshedToken;
      }

      return token;
    } catch (err) {
      console.warn('[LocalAuthProvider] Error getting token:', err);
      return null;
    }
  }

  async getSession(): Promise<AuthSession | null> {
    try {
      const token = await this.getToken();
      if (!token) return null;

      const user = await this.getUser();
      return {
        access_token: token,
        refresh_token: localStorage.getItem(REFRESH_TOKEN_KEY),
        user,
        provider: 'LOCAL',
      };
    } catch (err) {
      console.warn('[LocalAuthProvider] Error getting session:', err);
      return null;
    }
  }

  async getUser(): Promise<AuthUser | null> {
    try {
      const userStr = localStorage.getItem(USER_KEY);
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          return {
            id: userObj.id,
            email: userObj.email,
            name: userObj.name,
            role: userObj.role || 'user',
            owner_id: userObj.owner_id || null,
            church_id: userObj.church_id,
            permissions: userObj.permissions || [],
          };
        } catch {
          // ignore parse error
        }
      }

      // Fetch from API /me if token exists
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!token) return null;

      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.user) {
          const u = json.data.user;
          const authUser: AuthUser = {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role || 'user',
            owner_id: u.owner_id || null,
            church_id: u.church_id,
            permissions: u.permissions || [],
          };
          localStorage.setItem(USER_KEY, JSON.stringify(authUser));
          return authUser;
        }
      }

      return null;
    } catch (err) {
      console.warn('[LocalAuthProvider] Error getting user:', err);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

      if (token || refreshToken) {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ refreshToken })
        }).catch(() => {});
      }
    } finally {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      let base64Url = parts[1];
      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      const payload = JSON.parse(atob(base64));
      if (!payload.exp) return false;
      // Buffer of 30s
      return Date.now() >= (payload.exp * 1000 - 30000);
    } catch {
      return false;
    }
  }

  private async tryRefreshToken(): Promise<string | null> {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;

      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!res.ok) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        return null;
      }

      const json = await res.json();
      if (json.success && json.data?.accessToken) {
        localStorage.setItem(ACCESS_TOKEN_KEY, json.data.accessToken);
        if (json.data.refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, json.data.refreshToken);
        }
        return json.data.accessToken;
      }
    } catch {
      // refresh failed
    }
    return null;
  }
}
