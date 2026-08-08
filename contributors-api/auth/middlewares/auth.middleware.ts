import { Request, Response, NextFunction } from 'express';
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

// In-Memory Rate Limiter Guard with proxy IP extraction & route key isolation
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Periodic cleanup of expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
  message?: string;
}

export function authRateLimiter(options?: RateLimiterOptions | number, defaultMax?: number) {
  let windowMs = 15 * 60 * 1000;
  let maxRequests = 20;
  let keyPrefix = 'auth';
  let message = 'Muitas requisições enviadas. Por favor, aguarde alguns minutos e tente novamente.';

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
  }

  // Override windowMs and maxRequests with env variables if set
  if (process.env.AUTH_RATE_LIMIT_WINDOW_MS) {
    const envWin = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10);
    if (!isNaN(envWin) && envWin > 0) windowMs = envWin;
  }

  return (req: Request, res: Response, next: NextFunction) => {
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

    let record = rateLimitMap.get(routeKey);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(routeKey, record);
      
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: retryAfterSeconds
      });
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    next();
  };
}

export function resetRateLimitStore() {
  rateLimitMap.clear();
}
