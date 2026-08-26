export type AuthProviderType = 'SUPABASE' | 'LOCAL' | 'HYBRID';

export interface AuthUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string;
  owner_id?: string | null;
  church_id?: string | null;
  permissions?: string[];
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

export interface AuthSession {
  access_token: string | null;
  provider_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
  user: AuthUser | null;
  provider: AuthProviderType;
}

export interface IAuthProvider {
  type: AuthProviderType;
  getToken(): Promise<string | null>;
  getSession(): Promise<AuthSession | null>;
  getUser(): Promise<AuthUser | null>;
  logout(): Promise<void>;
}
