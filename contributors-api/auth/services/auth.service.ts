import { AuthRepository } from '../repositories/auth.repository.js';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password.utils.js';
import { generateAccessToken, generateRefreshToken, hashRefreshToken, verifyAccessToken, generateResetToken } from '../utils/jwt.utils.js';
import { sanitizeEmail } from '../validators/auth.validators.js';
import { UserResponse, LoginResult, AuthTokens } from '../types/auth.types.js';

export class AuthService {
  private repo: AuthRepository;

  constructor(repo: AuthRepository) {
    this.repo = repo;
  }

  private toUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      church_id: user.church_id,
      permissions: user.permissions || [],
      is_active: user.is_active,
      is_verified: user.is_verified,
      last_login: user.last_login,
      created_at: user.created_at
    };
  }

  async login(
    emailRaw: string,
    passwordRaw: string,
    ip?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    const email = sanitizeEmail(emailRaw);

    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      await this.repo.createAuditLog({
        email,
        event: 'LOGIN_FAILED_NOT_FOUND',
        ip_address: ip,
        user_agent: userAgent
      });
      throw new Error('Credenciais inválidas.');
    }

    if (!user.is_active) {
      await this.repo.createAuditLog({
        user_id: user.id,
        email,
        event: 'LOGIN_FAILED_INACTIVE',
        ip_address: ip,
        user_agent: userAgent
      });
      throw new Error('Conta inativa ou bloqueada.');
    }

    if (user.lock_until && user.lock_until > new Date()) {
      const remainingMinutes = Math.ceil((user.lock_until.getTime() - Date.now()) / 60000);
      await this.repo.createAuditLog({
        user_id: user.id,
        email,
        event: 'LOGIN_FAILED_LOCKED',
        ip_address: ip,
        user_agent: userAgent
      });
      throw new Error(`Conta temporariamente bloqueada. Tente novamente em ${remainingMinutes} minuto(s).`);
    }

    const isMatch = await comparePassword(passwordRaw, user.password_hash);
    if (!isMatch) {
      const lockStatus = await this.repo.incrementFailedAttempts(user.id);
      await this.repo.createAuditLog({
        user_id: user.id,
        email,
        event: lockStatus.locked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED_WRONG_PASSWORD',
        ip_address: ip,
        user_agent: userAgent
      });

      if (lockStatus.locked) {
        throw new Error('Muitas tentativas malsucedidas. Conta bloqueada por 15 minutos.');
      }
      throw new Error('Credenciais inválidas.');
    }

    await this.repo.updateUserLoginSuccess(user.id);

    const accessInfo = generateAccessToken({
      userId: user.id,
      churchId: user.church_id,
      role: user.role,
      permissions: user.permissions
    });

    const refreshInfo = generateRefreshToken();
    await this.repo.saveRefreshToken({
      userId: user.id,
      tokenHash: refreshInfo.tokenHash,
      expiresAt: refreshInfo.expiresAt,
      ipAddress: ip,
      userAgent: userAgent
    });

    await this.repo.createAuditLog({
      user_id: user.id,
      email: user.email,
      event: 'LOGIN_SUCCESS',
      ip_address: ip,
      user_agent: userAgent
    });

    return {
      user: this.toUserResponse(user),
      tokens: {
        accessToken: accessInfo.token,
        refreshToken: refreshInfo.rawToken,
        expiresIn: accessInfo.expiresIn
      }
    };
  }

  async signup(
    emailRaw: string,
    passwordRaw: string,
    name?: string,
    role?: string,
    churchId?: string,
    ip?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    const email = sanitizeEmail(emailRaw);

    const passCheck = validatePasswordStrength(passwordRaw);
    if (!passCheck.valid) {
      throw new Error(passCheck.message || 'Senha fraca.');
    }

    const existing = await this.repo.findUserByEmail(email);
    const passwordHash = await hashPassword(passwordRaw);

    let userToAuth = existing;
    if (existing) {
      await this.repo.updateUserPassword(existing.id, passwordHash);
      userToAuth = { ...existing, password_hash: passwordHash };
    } else {
      userToAuth = await this.repo.createUser({
        email,
        password_hash: passwordHash,
        name,
        role: role || 'user',
        church_id: churchId || null,
        permissions: [],
        is_active: true,
        is_verified: false
      });
    }

    const accessInfo = generateAccessToken({
      userId: userToAuth.id,
      churchId: userToAuth.church_id,
      role: userToAuth.role,
      permissions: userToAuth.permissions
    });

    const refreshInfo = generateRefreshToken();
    await this.repo.saveRefreshToken({
      userId: userToAuth.id,
      tokenHash: refreshInfo.tokenHash,
      expiresAt: refreshInfo.expiresAt,
      ipAddress: ip,
      userAgent: userAgent
    });

    await this.repo.createAuditLog({
      user_id: userToAuth.id,
      email: userToAuth.email,
      event: existing ? 'SIGNUP_UPDATE_PASSWORD_SUCCESS' : 'SIGNUP_SUCCESS',
      ip_address: ip,
      user_agent: userAgent
    });

    return {
      user: this.toUserResponse(userToAuth),
      tokens: {
        accessToken: accessInfo.token,
        refreshToken: refreshInfo.rawToken,
        expiresIn: accessInfo.expiresIn
      }
    };
  }

  async refresh(
    rawRefreshToken: string,
    ip?: string,
    userAgent?: string
  ): Promise<AuthTokens> {
    if (!rawRefreshToken) {
      throw new Error('Refresh token não fornecido.');
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);
    const tokenRecord = await this.repo.findRefreshToken(tokenHash);

    if (!tokenRecord) {
      throw new Error('Refresh token inválido ou não encontrado.');
    }

    if (tokenRecord.revoked) {
      await this.repo.revokeAllUserRefreshTokens(tokenRecord.user_id);
      await this.repo.createAuditLog({
        user_id: tokenRecord.user_id,
        event: 'REFRESH_TOKEN_REUSE_DETECTED',
        ip_address: ip,
        user_agent: userAgent
      });
      throw new Error('Refresh token revogado. Todas as sessões foram encerradas por segurança.');
    }

    if (tokenRecord.expires_at < new Date()) {
      throw new Error('Refresh token expirado.');
    }

    const user = await this.repo.findUserById(tokenRecord.user_id);
    if (!user || !user.is_active) {
      throw new Error('Usuário associado inválido ou inativo.');
    }

    // Revoke old refresh token (Token Rotation)
    await this.repo.revokeRefreshToken(tokenHash);

    // Generate new pair
    const accessInfo = generateAccessToken({
      userId: user.id,
      churchId: user.church_id,
      role: user.role,
      permissions: user.permissions
    });

    const newRefreshInfo = generateRefreshToken();
    await this.repo.saveRefreshToken({
      userId: user.id,
      tokenHash: newRefreshInfo.tokenHash,
      expiresAt: newRefreshInfo.expiresAt,
      ipAddress: ip,
      userAgent: userAgent
    });

    await this.repo.createAuditLog({
      user_id: user.id,
      email: user.email,
      event: 'TOKEN_REFRESH_SUCCESS',
      ip_address: ip,
      user_agent: userAgent
    });

    return {
      accessToken: accessInfo.token,
      refreshToken: newRefreshInfo.rawToken,
      expiresIn: accessInfo.expiresIn
    };
  }

  async logout(
    rawAccessToken?: string,
    rawRefreshToken?: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    let userId: string | null = null;

    if (rawAccessToken) {
      try {
        const decoded = verifyAccessToken(rawAccessToken);
        userId = decoded.user_id;
        if (decoded.jti && decoded.exp) {
          const expiresAt = new Date(decoded.exp * 1000);
          await this.repo.blacklistJti(decoded.jti, expiresAt);
        }
      } catch (err) {
        // Ignora erro de verificação de expiração no logout
      }
    }

    if (rawRefreshToken) {
      const tokenHash = hashRefreshToken(rawRefreshToken);
      await this.repo.revokeRefreshToken(tokenHash);
    }

    await this.repo.createAuditLog({
      user_id: userId,
      event: 'LOGOUT_SUCCESS',
      ip_address: ip,
      user_agent: userAgent
    });
  }

  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }
    return this.toUserResponse(user);
  }

  async requestPasswordReset(
    emailRaw: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ message: string; debugToken?: string }> {
    const email = sanitizeEmail(emailRaw);
    const user = await this.repo.findUserByEmail(email);

    if (!user) {
      // Retorna sucesso genérico para não expor se o e-mail existe
      return { message: 'Se o e-mail constar no sistema, as instruções foram enviadas.' };
    }

    const { rawToken, tokenHash, expiresAt } = generateResetToken();
    await this.repo.savePasswordResetToken(user.id, tokenHash, expiresAt);

    await this.repo.createAuditLog({
      user_id: user.id,
      email: user.email,
      event: 'PASSWORD_RESET_REQUESTED',
      ip_address: ip,
      user_agent: userAgent
    });

    return {
      message: 'Instruções para redefinição de senha enviadas.',
      debugToken: process.env.NODE_ENV !== 'production' ? rawToken : undefined
    };
  }

  async resetPassword(
    rawToken: string,
    newPasswordRaw: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const passCheck = validatePasswordStrength(newPasswordRaw);
    if (!passCheck.valid) {
      throw new Error(passCheck.message || 'Senha fraca.');
    }

    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record = await this.repo.findPasswordResetToken(tokenHash);

    if (!record || record.used || record.expires_at < new Date()) {
      throw new Error('Token de redefinição de senha inválido ou expirado.');
    }

    const newHash = await hashPassword(newPasswordRaw);
    await this.repo.updateUserPassword(record.user_id, newHash);
    await this.repo.markPasswordResetUsed(record.id);
    await this.repo.revokeAllUserRefreshTokens(record.user_id);

    await this.repo.createAuditLog({
      user_id: record.user_id,
      event: 'PASSWORD_RESET_SUCCESS',
      ip_address: ip,
      user_agent: userAgent
    });
  }

  async changePassword(
    userId: string,
    currentPasswordRaw: string,
    newPasswordRaw: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    const isMatch = await comparePassword(currentPasswordRaw, user.password_hash);
    if (!isMatch) {
      throw new Error('Senha atual incorreta.');
    }

    const passCheck = validatePasswordStrength(newPasswordRaw);
    if (!passCheck.valid) {
      throw new Error(passCheck.message || 'Nova senha não atende aos requisitos.');
    }

    const newHash = await hashPassword(newPasswordRaw);
    await this.repo.updateUserPassword(userId, newHash);
    await this.repo.revokeAllUserRefreshTokens(userId);

    await this.repo.createAuditLog({
      user_id: userId,
      event: 'PASSWORD_CHANGE_SUCCESS',
      ip_address: ip,
      user_agent: userAgent
    });
  }

  async verifyEmail(
    rawToken: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record = await this.repo.findEmailVerificationToken(tokenHash);

    if (!record || record.used || record.expires_at < new Date()) {
      throw new Error('Token de verificação inválido ou expirado.');
    }

    await this.repo.setUserVerified(record.user_id);
    await this.repo.markEmailVerificationUsed(record.id);

    await this.repo.createAuditLog({
      user_id: record.user_id,
      event: 'EMAIL_VERIFICATION_SUCCESS',
      ip_address: ip,
      user_agent: userAgent
    });
  }

  // Abstração de Google OAuth
  async googleOAuthTokenExchange(
    googlePayload: { email: string; name?: string; googleId: string },
    ip?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    const email = sanitizeEmail(googlePayload.email);
    let user = await this.repo.findUserByEmail(email);

    if (!user) {
      // Auto-register via Google OAuth
      const crypto = await import('crypto');
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await hashPassword(randomPassword);

      user = await this.repo.createUser({
        email,
        password_hash: passwordHash,
        name: googlePayload.name,
        role: 'user',
        is_active: true,
        is_verified: true
      });
    }

    const accessInfo = generateAccessToken({
      userId: user.id,
      churchId: user.church_id,
      role: user.role,
      permissions: user.permissions
    });

    const refreshInfo = generateRefreshToken();
    await this.repo.saveRefreshToken({
      userId: user.id,
      tokenHash: refreshInfo.tokenHash,
      expiresAt: refreshInfo.expiresAt,
      ipAddress: ip,
      userAgent
    });

    await this.repo.createAuditLog({
      user_id: user.id,
      email: user.email,
      event: 'GOOGLE_OAUTH_SUCCESS',
      ip_address: ip,
      user_agent: userAgent
    });

    return {
      user: this.toUserResponse(user),
      tokens: {
        accessToken: accessInfo.token,
        refreshToken: refreshInfo.rawToken,
        expiresIn: accessInfo.expiresIn
      }
    };
  }
}
