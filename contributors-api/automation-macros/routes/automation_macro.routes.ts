import { Router, Request, Response, NextFunction } from 'express';
import { AutomationMacroRepository } from '../repositories/automation_macro.repository.js';
import { AutomationMacroService } from '../services/automation_macro.service.js';
import { AutomationMacroController } from '../controllers/automation_macro.controller.js';
import { AuthRepository } from '../../auth/repositories/auth.repository.js';
import { verifyAccessToken } from '../../auth/utils/jwt.utils.js';

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
        console.warn('[AutomationMacroRoutes] Token JWT inválido ou expirado:', err);
      }
    }
    next();
  };
}

export function createAutomationMacroRouter(pool: any): Router {
  const router = Router();

  const repo = new AutomationMacroRepository(pool);
  const service = new AutomationMacroService(repo);
  const controller = new AutomationMacroController(service);

  const authMiddleware = optionalOrJwtAuth(pool);

  repo.ensureTableExists().catch((err) => {
    console.warn('[AutomationMacroRouter] Falha na auto-inicialização da tabela automation_macros:', err);
  });

  router.get('/', authMiddleware, controller.getAll);
  router.get('/:id', authMiddleware, controller.getById);
  router.post('/', authMiddleware, controller.create);
  router.put('/:id', authMiddleware, controller.update);
  router.patch('/:id', authMiddleware, controller.update);
  router.delete('/:id', authMiddleware, controller.delete);
  router.post('/migrate', authMiddleware, controller.migrate);

  return router;
}

export { AutomationMacroRepository, AutomationMacroService, AutomationMacroController };
