import { Request, Response, NextFunction } from 'express';
import pg from 'pg';
import { verifyAccessToken } from '../utils/jwt.utils.js';
import { AuthRepository } from '../repositories/auth.repository.js';
import { JwtPayload } from '../types/auth.types.js';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export function createAuthenticateJwtMiddleware(repo: AuthRepository) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Acesso não autorizado. Token ausente.' });
      }

      const token = authHeader.substring(7).trim();
      const decoded = verifyAccessToken(token);

      if (decoded.jti) {
        const isBlacklisted = await repo.isJtiBlacklisted(decoded.jti);
        if (isBlacklisted) {
          return res.status(401).json({ success: false, error: 'Token revogado ou sessão encerrada.' });
        }
      }

      req.user = decoded;
      next();
    } catch (err: any) {
      return res.status(401).json({ success: false, error: 'Token inválido ou expirado: ' + (err?.message || '') });
    }
  };
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado.' });
    }

    if (!allowedRoles.includes(req.user.role) && req.user.role !== 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Acesso negado. Permissão de perfil insuficiente.' });
    }

    next();
  };
}

export function requirePermission(...requiredPermissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado.' });
    }

    if (req.user.role === 'admin' || req.user.role === 'owner') {
      return next();
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.some(p => userPermissions.includes(p));

    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Acesso negado. Permissão insuficiente.' });
    }

    next();
  };
}

// Shared PostgreSQL-backed Rate Limiter
let sharedRateLimitPool: pg.Pool | null = null;
const fallbackStore = new Map<string, { count: number; reset_time: number }>();

function getRateLimitPool(customPool?: any): pg.Pool {
  if (customPool) return customPool;
  if (!sharedRateLimitPool) {
    const connStr = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.PG_CONN_STRING;
    if (connStr) {
      sharedRateLimitPool = new pg.Pool({ connectionString: connStr, connectionTimeoutMillis: 2000 });
    } else {
      sharedRateLimitPool = new pg.Pool({
        host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
        port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
        user: process.env.PGUSER || process.env.DB_USER || 'postgres',
        password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
        database: process.env.PGDATABASE || process.env.DB_DATABASE || 'contributors',
        connectionTimeoutMillis: 2000
      });
    }
  }
  return sharedRateLimitPool;
}

let tableEnsured = false;
async function ensureRateLimitTable(pool: pg.Pool): Promise<boolean> {
  if (tableEnsured) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key VARCHAR(255) PRIMARY KEY,
        count INT NOT NULL DEFAULT 1,
        reset_time BIGINT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    tableEnsured = true;
    return true;
  } catch (err) {
    return false;
  }
}

// Periodic passive cleanup of expired entries every 5 minutes
setInterval(() => {
  if (sharedRateLimitPool) {
    const now = Date.now();
    sharedRateLimitPool.query('DELETE FROM rate_limits WHERE reset_time < $1', [now]).catch(() => {});
  }
  const now = Date.now();
  for (const [key, val] of fallbackStore.entries()) {
    if (now > val.reset_time) fallbackStore.delete(key);
  }
}, 5 * 60 * 1000).unref();

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
  message?: string;
  pool?: any;
}

export function authRateLimiter(options?: RateLimiterOptions | number, defaultMax?: number, poolArg?: any) {
  let windowMs = 15 * 60 * 1000;
  let maxRequests = 20;
  let keyPrefix = 'auth';
  let message = 'Muitas requisições enviadas. Por favor, aguarde alguns minutos e tente novamente.';
  let customPool: any = poolArg || null;

  if (typeof options === 'number') {
    windowMs = options;
    if (typeof defaultMax === 'number') {
      maxRequests = defaultMax;
    }
  } else if (typeof options === 'object' && options !== null) {
    if (options.windowMs) windowMs = options.windowMs;
    if (options.maxRequests) maxRequests = options.maxRequests;
    if (options.keyPrefix) keyPrefix = options.keyPrefix;
    if (options.message) message = options.message;
    if (options.pool) customPool = options.pool;
  }

  // Override windowMs and maxRequests with env variables if set
  if (process.env.AUTH_RATE_LIMIT_WINDOW_MS) {
    const envWin = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10);
    if (!isNaN(envWin) && envWin > 0) windowMs = envWin;
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    const pool = getRateLimitPool(customPool || (req.app && req.app.get && req.app.get('pool')));

    // Extract IP taking x-forwarded-for into account for reverse proxy / Nginx
    const xForwardedFor = req.headers['x-forwarded-for'];
    let ip = '127.0.0.1';
    if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
      ip = ips.split(',')[0].trim();
    } else {
      ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    }

    const routeKey = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const resetTime = now + windowMs;

    let currentCount = 1;
    let currentResetTime = resetTime;
    let dbSuccess = false;

    try {
      const dbReady = await ensureRateLimitTable(pool);
      if (dbReady) {
        const query = `
          INSERT INTO rate_limits (key, count, reset_time, updated_at)
          VALUES ($1, 1, $2, NOW())
          ON CONFLICT (key) DO UPDATE
          SET
            count = CASE 
              WHEN rate_limits.reset_time <= $3 THEN 1
              ELSE rate_limits.count + 1
            END,
            reset_time = CASE
              WHEN rate_limits.reset_time <= $3 THEN $2
              ELSE rate_limits.reset_time
            END,
            updated_at = NOW()
          RETURNING count, reset_time;
        `;

        const result = await pool.query(query, [routeKey, resetTime, now]);
        if (result && result.rows && result.rows.length > 0) {
          const record = result.rows[0];
          currentCount = Number(record.count);
          currentResetTime = Number(record.reset_time);
          dbSuccess = true;
        }
      }
    } catch (err) {
      dbSuccess = false;
    }

    if (!dbSuccess) {
      let record = fallbackStore.get(routeKey);
      if (!record || now > record.reset_time) {
        record = { count: 1, reset_time: resetTime };
      } else {
        record.count++;
      }
      fallbackStore.set(routeKey, record);
      currentCount = record.count;
      currentResetTime = record.reset_time;
    }

    if (currentCount > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((currentResetTime - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(currentResetTime / 1000));

      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: retryAfterSeconds
      });
    }

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount));
    res.setHeader('X-RateLimit-Reset', Math.ceil(currentResetTime / 1000));

    return next();
  };
}

export function resetRateLimitStore(poolToReset?: any) {
  fallbackStore.clear();
  try {
    const pool = getRateLimitPool(poolToReset);
    pool.query('TRUNCATE TABLE rate_limits;').catch(() => {
      pool.query('DELETE FROM rate_limits;').catch(() => {});
    });
  } catch (e) {}
}

