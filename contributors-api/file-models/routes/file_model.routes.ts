import { Router, Request, Response, NextFunction } from 'express';
import { FileModelRepository } from '../repositories/file_model.repository.js';
import { FileModelService } from '../services/file_model.service.js';
import { FileModelController } from '../controllers/file_model.controller.js';
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
        console.warn('[FileModelRoutes] Token JWT inválido ou expirado:', err);
      }
    }
    next();
  };
}

export function createFileModelRouter(pool: any): Router {
  const router = Router();

  const repo = new FileModelRepository(pool);
  const service = new FileModelService(repo);
  const controller = new FileModelController(service);

  const authMiddleware = optionalOrJwtAuth(pool);

  repo.ensureTableExists().catch((err) => {
    console.warn('[FileModelRouter] Falha na auto-inicialização da tabela file_models:', err);
  });

  router.get('/', authMiddleware, controller.getUserModels);
  router.get('/admin/all', authMiddleware, controller.getAllAdmin);
  router.get('/:id', authMiddleware, controller.getById);
  router.post('/', authMiddleware, controller.create);
  router.put('/:id', authMiddleware, controller.update);
  router.patch('/:id', authMiddleware, controller.update);
  router.delete('/:id', authMiddleware, controller.delete);
  router.post('/migrate', authMiddleware, controller.migrate);

  return router;
}

export { FileModelRepository, FileModelService, FileModelController };
