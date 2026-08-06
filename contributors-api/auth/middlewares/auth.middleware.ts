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

// In-Memory Rate Limiter Guard
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function authRateLimiter(windowMs: number = 15 * 60 * 1000, maxRequests: number = 20) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Muitas requisições enviadas. Por favor, aguarde alguns minutos e tente novamente.'
      });
    }

    record.count++;
    next();
  };
}
