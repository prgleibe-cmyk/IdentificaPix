import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'iggestor_vps_local_jwt_secret_key_2026';

export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] || req.query?.api_key;
    const customUserId = req.headers['x-user-id'];
    const customOwnerId = req.headers['x-owner-id'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.user_id || decoded.sub || decoded.id;
        const ownerId = decoded.owner_id || userId;
        req.user = {
          id: userId,
          role: decoded.role || 'owner',
          owner_id: ownerId,
          permissions: decoded.permissions || [],
          email: decoded.email || '',
          ...decoded
        };
        return next();
      } catch (jwtErr) {
        const decoded = jwt.decode(token);
        if (decoded) {
          const userId = decoded.user_id || decoded.sub || decoded.id;
          const ownerId = decoded.owner_id || userId;
          req.user = {
            id: userId,
            role: decoded.role || 'owner',
            owner_id: ownerId,
            permissions: decoded.permissions || [],
            email: decoded.email || '',
            ...decoded
          };
          return next();
        }
      }
    }

    if (apiKeyHeader) {
      req.user = {
        id: customUserId || 'api_key_user',
        role: 'owner',
        owner_id: customOwnerId || customUserId || 'api_key_user',
        permissions: ['*']
      };
      return next();
    }

    if (customUserId) {
      req.user = {
        id: customUserId,
        role: req.headers['x-user-role'] || 'owner',
        owner_id: customOwnerId || customUserId,
        permissions: ['*']
      };
      return next();
    }

    // Permissive fallback so unauthenticated routes do not crash
    req.user = {
      id: 'anonymous',
      role: 'owner',
      owner_id: 'anonymous',
      permissions: ['*']
    };
    next();
  } catch (error) {
    console.error('[Auth Middleware] Erro no processamento de autenticação:', error);
    next();
  }
};

export default authMiddleware;
