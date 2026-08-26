import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JwtPayload } from '../types/auth.types.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'iggestor_vps_local_jwt_secret_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'iggestor_vps_local_refresh_secret_key_2026';

const ISSUER = 'iggestor-vps-auth';
const AUDIENCE = 'iggestor-vps-api';
const ACCESS_TOKEN_EXPIRY = '1h'; // 1 hour
const ACCESS_TOKEN_EXPIRY_SECONDS = 3600;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export function generateAccessToken(payload: {
  userId: string;
  ownerId?: string | null;
  churchId?: string | null;
  role: string;
  permissions: string[];
}): { token: string; jti: string; expiresIn: number } {
  const jti = crypto.randomUUID();
  const claims: Omit<JwtPayload, 'iat' | 'exp'> = {
    user_id: payload.userId,
    owner_id: payload.ownerId || payload.userId,
    church_id: payload.churchId || null,
    role: payload.role,
    permissions: payload.permissions || [],
    iss: ISSUER,
    aud: AUDIENCE,
    jti
  };

  const token = jwt.sign(claims, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY
  });

  return { token, jti, expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS };
}

export function generateRefreshToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  return { rawToken, tokenHash, expiresAt };
}

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHmac('sha256', JWT_REFRESH_SECRET).update(rawToken).digest('hex');
}

export function generateResetToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  return { rawToken, tokenHash, expiresAt };
}

export function generate2faTempToken(userId: string): string {
  const claims = {
    user_id: userId,
    type: '2fa_temp',
    iss: ISSUER,
    aud: AUDIENCE,
    jti: crypto.randomUUID()
  };
  return jwt.sign(claims, JWT_SECRET, { expiresIn: '5m' });
}

export function verify2faTempToken(token: string): { user_id: string } {
  const decoded = jwt.verify(token, JWT_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE
  }) as any;
  if (decoded.type !== '2fa_temp') {
    throw new Error('Token temporário inválido');
  }
  return { user_id: decoded.user_id };
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE
  }) as JwtPayload;

  return decoded;
}
