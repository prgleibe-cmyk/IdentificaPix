import { Router, Request, Response, NextFunction } from 'express';
import { PaymentRepository } from '../repositories/payment.repository.js';
import { PaymentService } from '../services/payment.service.js';
import { PaymentController } from '../controllers/payment.controller.js';
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
        console.warn('[PaymentRoutes] Token JWT inválido ou expirado:', err);
      }
    }
    next();
  };
}

export function createPaymentRouter(pool: any): Router {
  const router = Router();

  const repo = new PaymentRepository(pool);
  const service = new PaymentService(repo);
  const controller = new PaymentController(service);

  const authMiddleware = optionalOrJwtAuth(pool);

  repo.ensureTableExists().catch((err) => {
    console.warn('[PaymentRouter] Falha na auto-inicialização da tabela payments:', err);
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

export { PaymentRepository, PaymentService, PaymentController };
