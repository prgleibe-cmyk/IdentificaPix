import pg from 'pg';
import { Request } from 'express';

export interface AuditLogParams {
  userId?: string | null;
  churchId?: string | null;
  action: string; // e.g., 'CREATE', 'UPDATE', 'DELETE', 'CONFIRM', 'CANCEL'
  entity: string; // e.g., 'contributors', 'app_users', 'churches', 'financial_records', 'banks'
  entityId?: string | null;
  req?: Request | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export interface AuditQueryFilter {
  churchId?: string;
  userId?: string;
  entity?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordhash',
  'token',
  'secret',
  'jwt',
  'access_token',
  'refresh_token',
  'key',
  'api_key',
  'apikey',
  'private_key',
  'encryption_key',
  'backup_key',
  'card_number',
  'cvv',
  'pin',
  'code',
  'totp_code',
  'totp_secret',
  'recovery_code',
  'recovery_codes',
  'mfa_token'
]);

/**
 * Recursively sanitizes data objects to prevent logging passwords, secrets, or keys
 */
export function sanitizeAuditData(data: any): any {
  if (data === null || data === undefined) return null;
  
  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeAuditData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (
      SENSITIVE_KEYS.has(lowerKey) || 
      lowerKey.includes('password') || 
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      (lowerKey.includes('key') && lowerKey !== 'pix_key')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Extracts Client IP address handling proxies / X-Forwarded-For safely
 */
export function extractClientIp(req?: Request | null): string {
  if (!req) return '127.0.0.1';
  
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    const clientIp = ips.split(',')[0].trim();
    if (clientIp) return clientIp;
  }

  if (req.ip) return req.ip;
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;

  return '127.0.0.1';
}

/**
 * Extracts User-Agent string from request
 */
export function extractUserAgent(req?: Request | null): string {
  if (!req || !req.headers) return 'Unknown';
  const ua = req.headers['user-agent'];
  if (Array.isArray(ua)) return ua[0] || 'Unknown';
  return ua || 'Unknown';
}

/**
 * Initializes the audit_logs table and performance indices
 */
export async function initAuditDatabase(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255),
        church_id VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        entity VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255),
        ip_address VARCHAR(100),
        user_agent TEXT,
        old_values JSONB,
        new_values JSONB,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_church_id ON audit_logs(church_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_church_created ON audit_logs(church_id, created_at DESC);
    `);
    console.log('[AuditService] Centralized audit_logs table and indices initialized successfully.');
  } catch (err: any) {
    console.error('[AuditService] Error initializing audit_logs database:', err?.message || err);
  } finally {
    client.release();
  }
}

/**
 * Central Audit Logger function.
 * CRITICAL RULE: Failures in logging MUST NEVER block or crash operational business logic.
 */
export async function logAudit(pool: pg.Pool, params: AuditLogParams): Promise<boolean> {
  try {
    const ipAddress = params.ipAddress || extractClientIp(params.req);
    const userAgent = params.userAgent || extractUserAgent(params.req);

    // Try extracting userId and churchId from Express request context if not explicitly provided
    let userId = params.userId || null;
    let churchId = params.churchId || null;

    if (params.req) {
      const reqAny = params.req as any;
      if (!userId && reqAny.user) {
        userId = reqAny.user.id || reqAny.user.userId || reqAny.user.user_id || null;
      }
      if (!churchId && reqAny.user) {
        churchId = reqAny.user.churchId || reqAny.user.church_id || null;
      }
      if (!churchId && reqAny.headers && reqAny.headers['x-church-id']) {
        churchId = reqAny.headers['x-church-id'];
      }
    }

    const sanitizedOld = params.oldValues ? sanitizeAuditData(params.oldValues) : null;
    const sanitizedNew = params.newValues ? sanitizeAuditData(params.newValues) : null;
    const sanitizedMeta = params.metadata ? sanitizeAuditData(params.metadata) : null;

    await pool.query(`
      INSERT INTO audit_logs (
        user_id, church_id, action, entity, entity_id,
        ip_address, user_agent, old_values, new_values, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      userId ? String(userId) : null,
      churchId ? String(churchId) : null,
      params.action.toUpperCase(),
      params.entity.toLowerCase(),
      params.entityId ? String(params.entityId) : null,
      ipAddress,
      userAgent,
      sanitizedOld ? JSON.stringify(sanitizedOld) : null,
      sanitizedNew ? JSON.stringify(sanitizedNew) : null,
      sanitizedMeta ? JSON.stringify(sanitizedMeta) : null
    ]);

    return true;
  } catch (err: any) {
    // Fail safe: document audit logging error without disrupting business flow
    console.error('[AuditService] WARNING: Audit logging failed safely:', err?.message || err);
    return false;
  }
}

/**
 * Queries audit logs enforcing isolation per church
 */
export async function queryAuditLogs(pool: pg.Pool, filter: AuditQueryFilter): Promise<{ logs: any[]; total: number }> {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (filter.churchId) {
    conditions.push(`church_id = $${paramIdx++}`);
    values.push(filter.churchId);
  }

  if (filter.userId) {
    conditions.push(`user_id = $${paramIdx++}`);
    values.push(filter.userId);
  }

  if (filter.entity) {
    conditions.push(`entity = $${paramIdx++}`);
    values.push(filter.entity.toLowerCase());
  }

  if (filter.action) {
    conditions.push(`action = $${paramIdx++}`);
    values.push(filter.action.toUpperCase());
  }

  if (filter.startDate) {
    conditions.push(`created_at >= $${paramIdx++}`);
    values.push(filter.startDate);
  }

  if (filter.endDate) {
    conditions.push(`created_at <= $${paramIdx++}`);
    values.push(filter.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await pool.query(`SELECT COUNT(*)::int as total FROM audit_logs ${whereClause}`, values);
  const total = countRes.rows[0]?.total || 0;

  const limit = Math.min(filter.limit || 50, 200);
  const offset = filter.offset || 0;

  const querySql = `
    SELECT id, user_id, church_id, action, entity, entity_id, ip_address, user_agent, old_values, new_values, metadata, created_at
    FROM audit_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  values.push(limit, offset);

  const logsRes = await pool.query(querySql, values);

  return {
    logs: logsRes.rows,
    total
  };
}
