export interface LocalUser {
  id: string;
  email: string;
  password_hash: string;
  name?: string | null;
  role: string;
  owner_id?: string | null;
  church_id?: string | null;
  permissions: string[];
  is_active: boolean;
  is_verified: boolean;
  two_factor_enabled: boolean;
  two_factor_secret?: string | null;
  two_factor_recovery_codes?: string[] | null;
  failed_attempts: number;
  lock_until?: Date | null;
  last_login?: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface UserResponse {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  owner_id?: string | null;
  church_id?: string | null;
  congregation_ids?: string[];
  allowed_church_ids?: string[];
  permissions: string[];
  is_active: boolean;
  is_verified: boolean;
  two_factor_enabled: boolean;
  last_login?: Date | null;
  created_at: Date;
}

export interface JwtPayload {
  user_id: string;
  email?: string;
  owner_id?: string | null;
  church_id?: string | null;
  congregation_ids?: string[];
  allowed_church_ids?: string[];
  role: string;
  permissions: string[];
  iss: string;
  aud: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  revoked_at?: Date | null;
  created_at: Date;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // in seconds
}

export interface LoginResult {
  requiresTwoFactor?: boolean;
  tempToken?: string;
  user?: UserResponse;
  tokens?: AuthTokens;
}

export interface AuthAuditLogInput {
  user_id?: string | null;
  email?: string | null;
  event: string;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Record<string, any> | null;
}

