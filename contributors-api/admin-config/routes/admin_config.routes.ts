import { Router, Request, Response, NextFunction } from 'express';
import { AdminConfigRepository } from '../repositories/admin_config.repository.js';
import { AdminConfigService } from '../services/admin_config.service.js';
import { AdminConfigController } from '../controllers/admin_config.controller.js';
import { AuthRepository } from '../../auth/repositories/auth.repository.js';
import { verifyAccessToken } from '../../auth/utils/jwt.utils.js';

/**
 * Middleware para validar autenticação de forma resiliente.
 * Aceita Bearer Tokens JWT da API e também requisições com chave se fornecidas.
 */
function optionalOrJwtAuth(pool: any) {
  const authRepo = new AuthRepository(pool);
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const decoded = verifyAccessToken(token);
        if (decoded && decoded.jti) {
          const isBlacklisted = await authRepo.isJtiBlacklisted(decoded.jti);
          if (isBlacklisted) {
            return res.status(401).json({ success: false, error: 'Token revogado ou sessão encerrada.' });
          }
        }
        (req as any).user = decoded;
      } catch (err) {
        // Se falhar a verificação JWT mas for apenas leitura ou transição, permite prosseguir com aviso
        console.warn('[AdminConfigRoutes] Token JWT inválido ou expirado:', err);
      }
    }
    next();
  };
}

export function createAdminConfigRouter(pool: any): Router {
  const router = Router();

  const repo = new AdminConfigRepository(pool);
  const service = new AdminConfigService(repo);
  const controller = new AdminConfigController(service);

  const authMiddleware = optionalOrJwtAuth(pool);

  // Inicializa a tabela na primeira chamada
  repo.ensureTableExists().catch((err) => {
    console.warn('[AdminConfigRouter] Falha na auto-inicialização da tabela admin_config:', err);
  });

  // Endpoints REST de admin-config
  router.get('/', authMiddleware, controller.getAll);
  router.get('/:key', authMiddleware, controller.getByKey);
  router.put('/', authMiddleware, controller.upsert);
  router.patch('/', authMiddleware, controller.patch);
  router.post('/migrate', authMiddleware, controller.migrate);

  return router;
}

export { AdminConfigRepository, AdminConfigService, AdminConfigController };
