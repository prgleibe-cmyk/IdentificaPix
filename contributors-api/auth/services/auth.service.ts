import { AuthRepository } from '../repositories/auth.repository.js';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password.utils.js';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  hashRefreshToken, 
  verifyAccessToken, 
  generateResetToken,
  generate2faTempToken,
  verify2faTempToken,
  generateGoogleOAuthState,
  verifyGoogleOAuthState
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

function safeParsePermissions(raw: any): any {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return null;
}

function extractAllowedChurchIds(user: any): string[] {
  const ids = new Set<string>();
  if (!user) return [];

  const addIfValid = (val: any) => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length > 0) ids.add(trimmed);
    }
  };

  addIfValid(user.church_id);
  addIfValid(user.churchId);

  if (Array.isArray(user.congregation_ids)) user.congregation_ids.forEach(addIfValid);
  if (Array.isArray(user.congregationIds)) user.congregationIds.forEach(addIfValid);
  if (Array.isArray(user.allowed_church_ids)) user.allowed_church_ids.forEach(addIfValid);
  if (Array.isArray(user.allowedChurchIds)) user.allowedChurchIds.forEach(addIfValid);
  if (Array.isArray(user.churchIds)) user.churchIds.forEach(addIfValid);
  if (Array.isArray(user.church_ids)) user.church_ids.forEach(addIfValid);

  const parsedPerms = safeParsePermissions(user.permissions);
  if (Array.isArray(parsedPerms)) {
    parsedPerms.forEach((perm: any) => {
      if (typeof perm === 'string') {
        if (perm.startsWith('congregation:') || perm.startsWith('church:')) {
          addIfValid(perm.split(':')[1]);
        }
      }
    });
  } else if (parsedPerms && typeof parsedPerms === 'object') {
    if (Array.isArray(parsedPerms.congregationIds)) parsedPerms.congregationIds.forEach(addIfValid);
    if (Array.isArray(parsedPerms.congregation_ids)) parsedPerms.congregation_ids.forEach(addIfValid);
    if (Array.isArray(parsedPerms.churchIds)) parsedPerms.churchIds.forEach(addIfValid);
    if (Array.isArray(parsedPerms.church_ids)) parsedPerms.church_ids.forEach(addIfValid);
    if (Array.isArray(parsedPerms.allowedChurchIds)) parsedPerms.allowedChurchIds.forEach(addIfValid);
    if (Array.isArray(parsedPerms.allowed_church_ids)) parsedPerms.allowed_church_ids.forEach(addIfValid);
    addIfValid(parsedPerms.congregation);
    addIfValid(parsedPerms.churchId);
    addIfValid(parsedPerms.church_id);
  }

  return Array.from(ids);
}

function extractAllowedBankIds(user: any): string[] {
  const ids = new Set<string>();
  if (!user) return [];

  const addIfValid = (val: any) => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length > 0) ids.add(trimmed);
    }
  };

  if (Array.isArray(user.bank_ids)) user.bank_ids.forEach(addIfValid);
  if (Array.isArray(user.bankIds)) user.bankIds.forEach(addIfValid);
  if (Array.isArray(user.allowed_bank_ids)) user.allowed_bank_ids.forEach(addIfValid);
  if (Array.isArray(user.allowedBankIds)) user.allowedBankIds.forEach(addIfValid);

  const parsedPerms = safeParsePermissions(user.permissions);
  if (parsedPerms && typeof parsedPerms === 'object') {
    if (Array.isArray(parsedPerms.bankIds)) parsedPerms.bankIds.forEach(addIfValid);
    if (Array.isArray(parsedPerms.bank_ids)) parsedPerms.bank_ids.forEach(addIfValid);
    if (Array.isArray(parsedPerms.allowedBankIds)) parsedPerms.allowedBankIds.forEach(addIfValid);
    if (Array.isArray(parsedPerms.allowed_bank_ids)) parsedPerms.allowed_bank_ids.forEach(addIfValid);
  }
  if (Array.isArray(parsedPerms)) {
    parsedPerms.forEach((perm: any) => {
      if (typeof perm === 'string') {
        if (perm.startsWith('bank:') || perm.startsWith('bank_id:')) {
          addIfValid(perm.split(':')[1]);
        }
      }
    });
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
      subscription_status: user.subscription_status || 'trial',
      subscription_ends_at: user.subscription_ends_at || null,
      trial_ends_at: user.trial_ends_at || null,
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
      allowedChurchIds: extractAllowedChurchIds(user),
      bankIds: extractAllowedBankIds(user),
      allowedBankIds: extractAllowedBankIds(user)
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
      allowedChurchIds: extractAllowedChurchIds(user),
      bankIds: extractAllowedBankIds(user),
      allowedBankIds: extractAllowedBankIds(user)
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
    if (existing && existing.password_hash) {
      throw new Error('E-mail já cadastrado. Efetue login ou utilize a recuperação de senha.');
    }
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
      allowedChurchIds: extractAllowedChurchIds(userToAuth),
      bankIds: extractAllowedBankIds(userToAuth),
      allowedBankIds: extractAllowedBankIds(userToAuth)
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
      // Grace period de 30 segundos para acomodar requisições concorrentes em trânsito de SPAs
      const isWithinGracePeriod = tokenRecord.revoked_at && (Date.now() - tokenRecord.revoked_at.getTime() < 30000);
      if (isWithinGracePeriod) {
        const user = await this.repo.findUserById(tokenRecord.user_id);
        if (user && user.is_active) {
          const accessInfo = generateAccessToken({
            userId: user.id,
            email: user.email,
            ownerId: user.owner_id || user.id,
            churchId: user.church_id,
            role: user.role,
            permissions: user.permissions,
            congregationIds: extractAllowedChurchIds(user),
            allowedChurchIds: extractAllowedChurchIds(user),
            bankIds: extractAllowedBankIds(user),
            allowedBankIds: extractAllowedBankIds(user)
          });
          return {
            accessToken: accessInfo.token,
            refreshToken: rawRefreshToken,
            expiresIn: accessInfo.expiresIn
          };
        }
      }

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
      allowedChurchIds: extractAllowedChurchIds(user),
      bankIds: extractAllowedBankIds(user),
      allowedBankIds: extractAllowedBankIds(user)
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

  buildGoogleAuthUrl(redirectUri: string): string {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      throw new Error('Login com Google não configurado no servidor (GOOGLE_CLIENT_ID ausente).');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(redirectUri);
    } catch {
      throw new Error('URI de redirecionamento inválida.');
    }

    const isLocalHost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
    const isAllowedProtocol = parsedUrl.protocol === 'https:' || (parsedUrl.protocol === 'http:' && isLocalHost);
    if (!isAllowedProtocol || parsedUrl.pathname !== '/auth/google/callback') {
      throw new Error('URI de redirecionamento não permitida.');
    }

    const cleanRedirectUri = `${parsedUrl.origin}${parsedUrl.pathname}`;
    const state = generateGoogleOAuthState(cleanRedirectUri);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: cleanRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private async verifyGoogleIdToken(
    idToken: string,
    expectedClientId: string
  ): Promise<{ email: string; name?: string; googleId: string }> {
    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!infoRes.ok) {
      throw new Error('Token do Google inválido ou expirado.');
    }
    const info = await infoRes.json() as any;
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    const emailVerified = info.email_verified === true || info.email_verified === 'true';

    if (info.aud !== expectedClientId || !validIssuers.includes(info.iss) || !emailVerified || !info.email || !info.sub) {
      throw new Error('Falha na verificação de identidade da conta Google.');
    }

    return {
      email: String(info.email),
      name: info.name ? String(info.name) : undefined,
      googleId: String(info.sub)
    };
  }

  // Autenticação Google OAuth 2.0 validada criptograficamente junto aos servidores do Google
  async googleOAuthTokenExchange(
    oauthPayload: { code?: string; state?: string; redirectUri?: string; idToken?: string },
    ip?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      throw new Error('Login com Google não configurado no servidor (GOOGLE_CLIENT_ID ausente).');
    }

    let verifiedProfile: { email: string; name?: string; googleId: string };

    if (oauthPayload.code && oauthPayload.state && oauthPayload.redirectUri) {
      const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
      if (!clientSecret) {
        throw new Error('Login com Google não configurado no servidor (GOOGLE_CLIENT_SECRET ausente).');
      }

      let stateData: { redirectUri: string };
      try {
        stateData = verifyGoogleOAuthState(oauthPayload.state);
      } catch {
        throw new Error('Sessão de login Google expirada ou inválida. Tente novamente.');
      }

      if (stateData.redirectUri !== oauthPayload.redirectUri) {
        throw new Error('URI de redirecionamento divergente.');
      }

      const tokenBody = new URLSearchParams({
        code: oauthPayload.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: stateData.redirectUri,
        grant_type: 'authorization_code'
      });

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString()
      });

      const tokenData = await tokenRes.json().catch(() => ({})) as any;
      if (!tokenRes.ok || (!tokenData.id_token && !tokenData.access_token)) {
        console.warn('[AuthService:GoogleOAuth] Token exchange failed:', tokenData?.error || tokenRes.status);
        throw new Error('Não foi possível validar o código de autorização com o Google. Tente novamente.');
      }

      if (tokenData.id_token) {
        verifiedProfile = await this.verifyGoogleIdToken(tokenData.id_token, clientId);
      } else {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        if (!userInfoRes.ok) {
          throw new Error('Falha ao obter dados do usuário no Google.');
        }
        const userInfo = await userInfoRes.json() as any;
        if (!userInfo.email || !(userInfo.email_verified === true || userInfo.email_verified === 'true') || !userInfo.sub) {
          throw new Error('E-mail da conta Google não verificado.');
        }
        verifiedProfile = {
          email: String(userInfo.email),
          name: userInfo.name ? String(userInfo.name) : undefined,
          googleId: String(userInfo.sub)
        };
      }
    } else if (oauthPayload.idToken) {
      verifiedProfile = await this.verifyGoogleIdToken(oauthPayload.idToken, clientId);
    } else {
      throw new Error('Parâmetros de autenticação Google inválidos.');
    }

    const email = sanitizeEmail(verifiedProfile.email);
    let user = await this.repo.findUserByEmail(email);

    if (!user) {
      // Auto-register via Google OAuth preservando perfil migrado ou usuário secundário pré-cadastrado
      const crypto = await import('crypto');
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await hashPassword(randomPassword);
      const existingProfile = await this.repo.findProfileByEmail(email);

      const created = await this.repo.createUser({
        id: existingProfile?.id || undefined,
        email,
        password_hash: passwordHash,
        name: verifiedProfile.name || existingProfile?.name || null,
        role: existingProfile?.role || 'user',
        owner_id: existingProfile?.owner_id || null,
        church_id: null,
        permissions: [],
        is_active: true,
        is_verified: true
      });

      user = (await this.repo.findUserByEmail(email)) || created;
    }

    if (!user.is_active) {
      await this.repo.createAuditLog({
        user_id: user.id,
        email: user.email,
        event: 'GOOGLE_OAUTH_FAILED_INACTIVE',
        ip_address: ip,
        user_agent: userAgent
      });
      throw new Error('Conta inativa ou bloqueada.');
    }

    if (user.lock_until && user.lock_until > new Date()) {
      const remainingMinutes = Math.ceil((user.lock_until.getTime() - Date.now()) / 60000);
      await this.repo.createAuditLog({
        user_id: user.id,
        email: user.email,
        event: 'GOOGLE_OAUTH_FAILED_LOCKED',
        ip_address: ip,
        user_agent: userAgent
      });
      throw new Error(`Conta temporariamente bloqueada. Tente novamente em ${remainingMinutes} minuto(s).`);
    }

    if (!user.is_verified) {
      await this.repo.setUserVerified(user.id);
      user.is_verified = true;
    }

    const isAdminRole = user.role === 'superadmin' || user.role === 'admin' || user.role === 'owner';
    if (user.two_factor_enabled || isAdminRole) {
      const secrets = await this.repo.getTotpSecrets(user.id);
      if (secrets && secrets.totp_enabled) {
        const tempToken = generate2faTempToken(user.id);
        await this.repo.createAuditLog({
          user_id: user.id,
          email: user.email,
          event: 'GOOGLE_OAUTH_2FA_REQUIRED',
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
      allowedChurchIds: extractAllowedChurchIds(user),
      bankIds: extractAllowedBankIds(user),
      allowedBankIds: extractAllowedBankIds(user)
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
      user_agent: userAgent,
      details: { googleId: verifiedProfile.googleId }
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
