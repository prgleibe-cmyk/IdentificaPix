import jwt from 'jsonwebtoken';

const DEV_FALLBACK_JWT_SECRET = 'iggestor_vps_local_jwt_secret_key_2026';
let devFallbackWarned = false;

export function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Auth Middleware] FATAL: JWT_SECRET ou SUPABASE_JWT_SECRET não configurado em ambiente de produção.');
  }
  if (!devFallbackWarned) {
    console.warn('[Auth Middleware] WARNING: JWT_SECRET não definido. Usando segredo exclusivo de desenvolvimento.');
    devFallbackWarned = true;
  }
  return DEV_FALLBACK_JWT_SECRET;
}

export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Autenticação necessária. Token Bearer ausente.'
      });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Token Bearer vazio.'
      });
    }

    const secret = resolveJwtSecret();
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Token inválido ou expirado.'
      });
    }

    if (!decoded || typeof decoded !== 'object') {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Payload de token inválido.'
      });
    }

    const userId = decoded.user_id || decoded.sub || decoded.id;
    if (!userId) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Identificador de usuário ausente no token.'
      });
    }

    const ownerId = decoded.owner_id || userId;
    req.user = {
      ...decoded,
      id: userId,
      role: decoded.role || 'user',
      owner_id: ownerId,
      permissions: Array.isArray(decoded.permissions) || (decoded.permissions && typeof decoded.permissions === 'object') ? decoded.permissions : [],
      email: decoded.email || ''
    };
    return next();
  } catch (error) {
    console.error('[Auth Middleware] Erro crítico no processamento de autenticação:', error);
    return res.status(500).json({
      error: 'AUTH_CONFIGURATION_ERROR',
      message: 'Erro interno na validação de autenticação.'
    });
  }
};

export default authMiddleware;
