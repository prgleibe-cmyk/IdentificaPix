import { AuthRepository } from '../repositories/auth.repository.js';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password.utils.js';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  hashRefreshToken, 
  verifyAccessToken, 
  generateResetToken,
  generate2faTempToken,
  verify2faTempToken
} from '../utils/jwt.utils.js';
import { 
  generateBase32Secret, 
  generateOtpauthUrl, 
  encryptSecret, 
  decryptSecret, 
  verifyTotpCode, 
  generateRecoveryCodes, 
  hashRecoveryCode 
} from '../utils/totp.utils.js';
import { sanitizeEmail } from '../validators/auth.validators.js';
import { UserResponse, LoginResult, AuthTokens } from '../types/auth.types.js';
import { logAudit } from '../../services/audit.service.js';

function extractAllowedChurchIds(user: any): string[] {
  const ids = new Set<string>();
  if (user.church_id && typeof user.church_id === 'string' && user.church_id.trim()) {
    ids.add(user.church_id.trim());
  }
  if (user.churchId && typeof user.churchId === 'string' && user.churchId.trim()) {
    ids.add(user.churchId.trim());
  }
  if (Array.isArray(user.congregation_ids)) {
    user.congregation_ids.forEach((id: any) => {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    });
  }
  if (Array.isArray(user.congregationIds)) {
    user.congregationIds.forEach((id: any) => {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    });
  }
  if (Array.isArray(user.allowed_church_ids)) {
    user.allowed_church_ids.forEach((id: any) => {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    });
  }
  if (Array.isArray(user.permissions)) {
    user.permissions.forEach((perm: any) => {
      if (typeof perm === 'string') {
        if (perm.startsWith('congregation:')) {
          const cid = perm.split(':')[1];
          if (cid && cid.trim()) ids.add(cid.trim());
        } else if (perm.startsWith('church:')) {
          const cid = perm.split(':')[1];
          if (cid && cid.trim()) ids.add(cid.trim());
        }
      }
    });
  } else if (user.permissions && typeof user.permissions === 'object') {
    if (Array.isArray(user.permissions.congregationIds)) {
      user.permissions.congregationIds.forEach((id: any) => {
        if (typeof id === 'string' && id.trim()) ids.add(id.trim());
      });
    }
  }
  return Array.from(ids);
}

export class AuthService {
  private repo: AuthRepository;

  constructor(repo: AuthRepository) {
    this.repo = repo;
  }

  private toUserResponse(user: any): UserResponse {
    const isMember = user.role === 'member' || user.role === 'user' || user.role === 'operador' || user.role === 'secondary' || user.role === 'colaborador';
    const hasSeparateOwner = Boolean(user.owner_id && user.owner_id !== user.id);
    const resolvedRole = (isMember || hasSeparateOwner) ? (user.role && user.role !== 'owner' ? user.role : 'member') : (user.role || 'owner');
    const resolvedOwnerId = user.owner_id || (resolvedRole === 'owner' ? user.id : null);
    const allowedChurches = extractAllowedChurchIds(user);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: resolvedRole,
      owner_id: resolvedOwnerId,
      church_id: user.church_id || (allowedChurches.length > 0 ? allowedChurches[0] : null),
      congregation_ids: allowedChurches,
      allowed_church_ids: allowedChurches,
      permissions: user.permissions || [],
      is_active: user.is_active,
      is_verified: user.is_verified,
      two_factor_enabled: Boolean(user.two_factor_enabled),
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
      throw new Error('Credenciais inválidas. Verifique seu e-mail e senha.');
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
      throw new Error('Senha incorreta. Se você migrou do Supabase, clique em "Criar conta" abaixo com este mesmo e-mail para cadastrar sua nova senha.');
    }

    const isAdminRole = user.role === 'superadmin' || user.role === 'admin' || user.role === 'owner';

    if (user.two_factor_enabled || isAdminRole) {
      const secrets = await this.repo.getTotpSecrets(user.id);
      if (secrets && secrets.totp_enabled) {
        const tempToken = generate2faTempToken(user.id);
        await this.repo.createAuditLog({
          user_id: user.id,
          email: user.email,
          event: 'LOGIN_2FA_REQUIRED',
          ip_address: ip,
          user_agent: userAgent
        });
        return {
          requiresTwoFactor: true,
          tempToken
        };
      }
    }

    await this.repo.updateUserLoginSuccess(user.id);

    const accessInfo = generateAccessToken({
      userId: user.id,
      email: user.email,
      ownerId: user.owner_id || user.id,
      churchId: user.church_id,
      role: user.role,
      permissions: user.permissions,
      congregationIds: extractAllowedChurchIds(user),
      allowedChurchIds: extractAllowedChurchIds(user)
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

  async verifyLogin2fa(
    tempToken: string,
    codeOrRecovery: string,
    ip?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    let payload: { user_id: string };
    try {
      payload = verify2faTempToken(tempToken);
    } catch {
      throw new Error('Sessão de verificação 2FA expirada ou inválida. Faça login novamente.');
    }

    const user = await this.repo.findUserById(payload.user_id);
    if (!user || !user.is_active) {
      throw new Error('Usuário inválido ou inativo.');
    }

    const secrets = await this.repo.getTotpSecrets(user.id);
    if (!secrets || !secrets.totp_enabled || !secrets.totp_secret_encrypted) {
      throw new Error('2FA não configurado para este usuário.');
    }

    let isValid = false;
    let usedRecoveryCode = false;

    try {
      const plainSecret = decryptSecret(secrets.totp_secret_encrypted);
      isValid = verifyTotpCode(plainSecret, codeOrRecovery);
    } catch (e) {
      isValid = false;
    }

    if (!isValid && secrets.totp_recovery_codes && secrets.totp_recovery_codes.length > 0) {
      const inputHash = hashRecoveryCode(codeOrRecovery);
      const codeIndex = secrets.totp_recovery_codes.indexOf(inputHash);
      if (codeIndex !== -1) {
        isValid = true;
        usedRecoveryCode = true;
        const updatedCodes = [...secrets.totp_recovery_codes];
        updatedCodes.splice(codeIndex, 1);
        await this.repo.updateTotpRecoveryCodes(user.id, updatedCodes);
      }
    }

    if (!isValid) {
      await this.repo.createAuditLog({
        user_id: user.id,
        email: user.email,
        event: '2FA_AUTH_FAILED',
        ip_address: ip,
        user_agent: userAgent,
        details: { reason: 'Código TOTP ou de recuperação inválido' }
      });
      throw new Error('Código de verificação 2FA ou código de recuperação inválido.');
    }

    await this.repo.updateUserLoginSuccess(user.id);

    const accessInfo = generateAccessToken({
      userId: user.id,
      email: user.email,
      ownerId: user.owner_id || user.id,
      churchId: user.church_id,
      role: user.role,
      permissions: user.permissions,
      congregationIds: extractAllowedChurchIds(user),
      allowedChurchIds: extractAllowedChurchIds(user)
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
      event: usedRecoveryCode ? '2FA_RECOVERY_CODE_USED' : '2FA_AUTH_SUCCESS',
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

  async setup2fa(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    const secretBase32 = generateBase32Secret(20);
    const encryptedSecret = encryptSecret(secretBase32);

    await this.repo.saveTotpTempSecret(userId, encryptedSecret);

    const otpauthUrl = generateOtpauthUrl(user.email, secretBase32);

    return {
      secret: secretBase32,
      otpauthUrl
    };
  }

  async confirm2fa(userId: string, code: string, ip?: string, userAgent?: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new Error('Usuário não encontrado.');

    const secrets = await this.repo.getTotpSecrets(userId);
    if (!secrets || !secrets.totp_temp_secret_encrypted) {
      throw new Error('Solicitação de configuração 2FA não iniciada. Solicite a chave novamente.');
    }

    let plainTempSecret: string;
    try {
      plainTempSecret = decryptSecret(secrets.totp_temp_secret_encrypted);
    } catch {
      throw new Error('Erro ao descriptografar chave temporária.');
    }

    const isValid = verifyTotpCode(plainTempSecret, code);
    if (!isValid) {
      await this.repo.createAuditLog({
        user_id: user.id,
        email: user.email,
        event: '2FA_CONFIRM_FAILED',
        ip_address: ip,
        user_agent: userAgent
      });
      throw new Error('Código TOTP fornecido é inválido. Verifique o aplicativo autenticador.');
    }

    const rawRecoveryCodes = generateRecoveryCodes(8);
    const hashedCodes = rawRecoveryCodes.map(c => hashRecoveryCode(c));

    await this.repo.enableTotp(userId, secrets.totp_temp_secret_encrypted, hashedCodes);

    await this.repo.createAuditLog({
      user_id: user.id,
      email: user.email,
      event: '2FA_ENABLED',
      ip_address: ip,
      user_agent: userAgent
    });

    await logAudit(this.repo.getPool(), {
      userId: user.id,
      churchId: user.church_id,
      action: 'UPDATE',
      entity: 'app_users',
      entityId: user.id,
      ipAddress: ip,
      userAgent: userAgent,
      newValues: { two_factor_enabled: true }
    });

    return {
      recoveryCodes: rawRecoveryCodes
    };
  }

  async disable2fa(userId: string, passwordConfirm: string, ip?: string, userAgent?: string): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new Error('Usuário não encontrado.');

    const isMatch = await comparePassword(passwordConfirm, user.password_hash);
    if (!isMatch) {
      throw new Error('Senha incorreta para confirmação de desativação de 2FA.');
    }

    await this.repo.disableTotp(userId);

    await this.repo.createAuditLog({
      user_id: user.id,
      email: user.email,
      event: '2FA_DISABLED',
      ip_address: ip,
      user_agent: userAgent
    });

    await logAudit(this.repo.getPool(), {
      userId: user.id,
      churchId: user.church_id,
      action: 'UPDATE',
      entity: 'app_users',
      entityId: user.id,
      ipAddress: ip,
      userAgent: userAgent,
      newValues: { two_factor_enabled: false }
    });
  }

  async signup(
    emailRaw: string,
    passwordRaw: string,
    name?: string,
    role?: string,
    churchId?: string,
    ownerId?: string,
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
      if (role || ownerId || name || churchId) {
        await this.repo.updateUserMetadata(existing.id, {
          name: name || undefined,
          role: role || undefined,
          owner_id: ownerId || undefined,
          church_id: churchId || undefined
        });
      }
      userToAuth = {
        ...existing,
        name: name || existing.name,
        role: role || existing.role,
        owner_id: ownerId || existing.owner_id,
        church_id: churchId || existing.church_id,
        password_hash: passwordHash
      };
    } else {
      const existingProfile = await this.repo.findProfileByEmail(email);
      userToAuth = await this.repo.createUser({
        id: existingProfile?.id || undefined,
        email,
        password_hash: passwordHash,
        name: name || existingProfile?.name || null,
        role: role || existingProfile?.role || 'user',
        owner_id: ownerId || existingProfile?.owner_id || null,
        church_id: churchId || null,
        permissions: [],
        is_active: true,
        is_verified: false
      });
    }

    const accessInfo = generateAccessToken({
      userId: userToAuth.id,
      email: userToAuth.email,
      ownerId: userToAuth.owner_id || userToAuth.id,
      churchId: userToAuth.church_id,
      role: userToAuth.role,
      permissions: userToAuth.permissions,
      congregationIds: extractAllowedChurchIds(userToAuth),
      allowedChurchIds: extractAllowedChurchIds(userToAuth)
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

    await logAudit(this.repo.getPool(), {
      userId: userToAuth.id,
      churchId: userToAuth.church_id,
      action: existing ? 'UPDATE' : 'CREATE',
      entity: 'app_users',
      entityId: userToAuth.id,
      ipAddress: ip,
      userAgent: userAgent,
      newValues: {
        id: userToAuth.id,
        email: userToAuth.email,
        name: userToAuth.name,
        role: userToAuth.role,
        church_id: userToAuth.church_id
      }
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
      email: user.email,
      ownerId: user.owner_id || user.id,
      churchId: user.church_id,
      role: user.role,
      permissions: user.permissions,
      congregationIds: extractAllowedChurchIds(user),
      allowedChurchIds: extractAllowedChurchIds(user)
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
      email: user.email,
      ownerId: user.owner_id || user.id,
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
