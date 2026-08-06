export interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    user?: any;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  };
}

const ACCESS_TOKEN_KEY = 'iggestor_vps_access_token';
const REFRESH_TOKEN_KEY = 'iggestor_vps_refresh_token';
const USER_KEY = 'iggestor_vps_user';

export const authService = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  getUser(): any | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setAuthData(data: { user?: any; accessToken?: string; refreshToken?: string }) {
    if (data.accessToken) {
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    }
    if (data.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    if (data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
  },

  clearAuthData() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase.auth.token') || key.includes('identificapix')) {
        localStorage.removeItem(key);
      }
    });
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (json.success && json.data) {
      this.setAuthData(json.data);
    }
    return json;
  },

  async signup(email: string, password: string, name?: string): Promise<AuthResponse> {
    const res = await fetch('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    const json = await res.json();
    if (json.success && json.data) {
      this.setAuthData(json.data);
    }
    return json;
  },

  async googleOAuth(idToken: string): Promise<AuthResponse> {
    const res = await fetch('/api/v1/auth/google-oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const json = await res.json();
    if (json.success && json.data) {
      this.setAuthData(json.data);
    }
    return json;
  },

  async requestPasswordReset(email: string): Promise<AuthResponse> {
    const res = await fetch('/api/v1/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return res.json();
  },

  async resetPassword(token: string, newPassword: string): Promise<AuthResponse> {
    const res = await fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken: token, newPassword })
    });
    return res.json();
  },

  async me(): Promise<AuthResponse> {
    const token = this.getAccessToken();
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }
    const res = await fetch('/api/v1/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const json = await res.json();
    if (json.success && json.data?.user) {
      this.setAuthData({ user: json.data.user });
    }
    return json;
  },

  async logout(): Promise<void> {
    const token = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
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
    this.clearAuthData();
  }
};
