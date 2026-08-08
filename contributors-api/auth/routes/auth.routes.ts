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

  const defaultWindow = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '', 10) || 15 * 60 * 1000;

  const loginMax = parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '', 10) || 10;
  const signupMax = parseInt(process.env.RATE_LIMIT_SIGNUP_MAX || '', 10) || 10;
  const resetMax = parseInt(process.env.RATE_LIMIT_RESET_MAX || '', 10) || 5;
  const refreshMax = parseInt(process.env.RATE_LIMIT_REFRESH_MAX || '', 10) || 30;
  const oauthMax = parseInt(process.env.RATE_LIMIT_OAUTH_MAX || '', 10) || 15;
  const changePassMax = parseInt(process.env.RATE_LIMIT_CHANGE_PASS_MAX || '', 10) || 10;

  const loginLimiter = authRateLimiter({ keyPrefix: 'login', windowMs: defaultWindow, maxRequests: loginMax, message: 'Muitas tentativas de login. Por favor, aguarde alguns minutos e tente novamente.' });
  const signupLimiter = authRateLimiter({ keyPrefix: 'signup', windowMs: defaultWindow, maxRequests: signupMax, message: 'Muitas tentativas de criação de conta. Por favor, aguarde alguns minutos e tente novamente.' });
  const resetLimiter = authRateLimiter({ keyPrefix: 'reset', windowMs: defaultWindow, maxRequests: resetMax, message: 'Muitas solicitações de redefinição de senha. Por favor, aguarde alguns minutos e tente novamente.' });
  const refreshLimiter = authRateLimiter({ keyPrefix: 'refresh', windowMs: defaultWindow, maxRequests: refreshMax, message: 'Muitas tentativas de renovação de sessão. Por favor, tente novamente mais tarde.' });
  const oauthLimiter = authRateLimiter({ keyPrefix: 'oauth', windowMs: defaultWindow, maxRequests: oauthMax });
  const changePassLimiter = authRateLimiter({ keyPrefix: 'changepass', windowMs: defaultWindow, maxRequests: changePassMax });

  // Public Auth Routes
  router.post('/login', loginLimiter, controller.login);
  router.post('/signup', signupLimiter, controller.signup);
  router.post('/refresh', refreshLimiter, controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/request-password-reset', resetLimiter, controller.requestPasswordReset);
  router.post('/reset-password', resetLimiter, controller.resetPassword);
  router.post('/verify-email', controller.verifyEmail);
  router.post('/google-oauth', oauthLimiter, controller.googleOAuth);

  // Authenticated Auth Routes
  router.post('/me', authenticateJWT, controller.me);
  router.get('/me', authenticateJWT, controller.me);
  router.post('/change-password', authenticateJWT, changePassLimiter, controller.changePassword);

  return router;
}

export { AuthRepository };
