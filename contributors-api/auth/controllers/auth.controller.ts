import { Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
  validateLoginInput,
  validateSignupInput,
  validatePasswordResetRequest,
  validateResetPassword,
  validateChangePassword
} from '../validators/auth.validators.js';

export class AuthController {
  private service: AuthService;

  constructor(service: AuthService) {
    this.service = service;
  }

  private getClientInfo(req: AuthenticatedRequest) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return { ip, userAgent };
  }

  login = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = validateLoginInput(req.body);
      if (!validation.valid) {
        return res.status(400).json({ success: false, errors: validation.errors });
      }

      const { email, password } = req.body;
      const { ip, userAgent } = this.getClientInfo(req);

      const result = await this.service.login(email, password, ip, userAgent);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Falha ao efetuar login.'
      });
    }
  };

  signup = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = validateSignupInput(req.body);
      if (!validation.valid) {
        return res.status(400).json({ success: false, errors: validation.errors });
      }

      const { email, password, name, role, church_id, owner_id, ownerId } = req.body;
      const { ip, userAgent } = this.getClientInfo(req);

      const result = await this.service.signup(email, password, name, role, church_id, owner_id || ownerId, ip, userAgent);

      return res.status(201).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Falha ao criar conta.'
      });
    }
  };

  refresh = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const refreshToken = req.body?.refreshToken || req.headers['x-refresh-token'];
      const { ip, userAgent } = this.getClientInfo(req);

      const tokens = await this.service.refresh(refreshToken, ip, userAgent);

      return res.status(200).json({
        success: true,
        data: tokens
      });
    } catch (err: any) {
      return res.status(401).json({
        success: false,
        error: err?.message || 'Sessão inválida ou expirada.'
      });
    }
  };

  logout = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const rawAccessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      const refreshToken = req.body?.refreshToken;
      const { ip, userAgent } = this.getClientInfo(req);

      await this.service.logout(rawAccessToken, refreshToken, ip, userAgent);

      return res.status(200).json({
        success: true,
        message: 'Logout realizado com sucesso.'
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao efetuar logout.'
      });
    }
  };

  me = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Não autenticado.' });
      }

      const user = await this.service.getCurrentUser(userId);

      return res.status(200).json({
        success: true,
        data: { user }
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erro ao carregar perfil do usuário.'
      });
    }
  };

  requestPasswordReset = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = validatePasswordResetRequest(req.body);
      if (!validation.valid) {
        return res.status(400).json({ success: false, errors: validation.errors });
      }

      const { email } = req.body;
      const { ip, userAgent } = this.getClientInfo(req);

      const result = await this.service.requestPasswordReset(email, ip, userAgent);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erro ao solicitar redefinição de senha.'
      });
    }
  };

  resetPassword = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = validateResetPassword(req.body);
      if (!validation.valid) {
        return res.status(400).json({ success: false, errors: validation.errors });
      }

      const { token, newPassword, password } = req.body;
      const { ip, userAgent } = this.getClientInfo(req);

      await this.service.resetPassword(token, newPassword || password, ip, userAgent);

      return res.status(200).json({
        success: true,
        message: 'Senha redefinida com sucesso. Faça login com a nova senha.'
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erro ao redefinir senha.'
      });
    }
  };

  changePassword = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = validateChangePassword(req.body);
      if (!validation.valid) {
        return res.status(400).json({ success: false, errors: validation.errors });
      }

      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Não autenticado.' });
      }

      const { currentPassword, newPassword } = req.body;
      const { ip, userAgent } = this.getClientInfo(req);

      await this.service.changePassword(userId, currentPassword, newPassword, ip, userAgent);

      return res.status(200).json({
        success: true,
        message: 'Senha alterada com sucesso.'
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erro ao alterar senha.'
      });
    }
  };

  verifyEmail = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, error: 'Token de verificação não informado.' });
      }

      const { ip, userAgent } = this.getClientInfo(req);
      await this.service.verifyEmail(token, ip, userAgent);

      return res.status(200).json({
        success: true,
        message: 'E-mail verificado com sucesso.'
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erro ao verificar e-mail.'
      });
    }
  };

  googleOAuth = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, name, googleId } = req.body;
      if (!email || !googleId) {
        return res.status(400).json({ success: false, error: 'Parâmetros de OAuth inválidos.' });
      }

      const { ip, userAgent } = this.getClientInfo(req);
      const result = await this.service.googleOAuthTokenExchange({ email, name, googleId }, ip, userAgent);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erro ao autenticar com Google OAuth.'
      });
    }
  };

  verifyLogin2fa = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tempToken, code } = req.body;
      if (!tempToken || !code) {
        return res.status(400).json({ success: false, error: 'Token temporário e código 2FA são obrigatórios.' });
      }

      const { ip, userAgent } = this.getClientInfo(req);
      const result = await this.service.verifyLogin2fa(tempToken, code, ip, userAgent);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erro na verificação do 2FA.'
      });
    }
  };

  setup2fa = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Não autenticado.' });
      }

      const result = await this.service.setup2fa(userId);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erro ao gerar chave de configuração 2FA.'
      });
    }
  };

  confirm2fa = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Não autenticado.' });
      }

      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ success: false, error: 'Código de verificação é obrigatório.' });
      }

      const { ip, userAgent } = this.getClientInfo(req);
      const result = await this.service.confirm2fa(userId, code, ip, userAgent);

      return res.status(200).json({
        success: true,
        data: result,
        message: '2FA ativado com sucesso. Guarde os códigos de recuperação em local seguro.'
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erro ao confirmar ativação de 2FA.'
      });
    }
  };

  disable2fa = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Não autenticado.' });
      }

      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ success: false, error: 'Confirmação de senha é obrigatória.' });
      }

      const { ip, userAgent } = this.getClientInfo(req);
      await this.service.disable2fa(userId, password, ip, userAgent);

      return res.status(200).json({
        success: true,
        message: '2FA desativado com sucesso.'
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erro ao desativar 2FA.'
      });
    }
  };
}
