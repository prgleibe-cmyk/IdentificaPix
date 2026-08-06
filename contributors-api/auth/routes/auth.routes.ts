import { Router } from 'express';
import { AuthRepository } from '../repositories/auth.repository.js';
import { AuthService } from '../services/auth.service.js';
import { AuthController } from '../controllers/auth.controller.js';
import { createAuthenticateJwtMiddleware, authRateLimiter } from '../middlewares/auth.middleware.js';

export function createAuthRouter(pool: any): Router {
  const router = Router();

  const repo = new AuthRepository(pool);
  const service = new AuthService(repo);
  const controller = new AuthController(service);

  const authenticateJWT = createAuthenticateJwtMiddleware(repo);
  const rateLimiter = authRateLimiter(15 * 60 * 1000, 20); // 20 requests per 15 min

  // Public Auth Routes
  router.post('/login', rateLimiter, controller.login);
  router.post('/signup', rateLimiter, controller.signup);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/request-password-reset', rateLimiter, controller.requestPasswordReset);
  router.post('/reset-password', rateLimiter, controller.resetPassword);
  router.post('/verify-email', controller.verifyEmail);
  router.post('/google-oauth', rateLimiter, controller.googleOAuth);

  // Authenticated Auth Routes
  router.post('/me', authenticateJWT, controller.me);
  router.get('/me', authenticateJWT, controller.me);
  router.post('/change-password', authenticateJWT, controller.changePassword);

  return router;
}

export { AuthRepository };
