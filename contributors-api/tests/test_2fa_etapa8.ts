import pg from 'pg';
import dotenv from 'dotenv';
import { AuthRepository } from '../auth/repositories/auth.repository.js';
import { AuthService } from '../auth/services/auth.service.js';
import { 
  generateBase32Secret, 
  generateTotpCode, 
  verifyTotpCode, 
  encryptSecret, 
  decryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode
} from '../auth/utils/totp.utils.js';
import { sanitizeAuditData } from '../services/audit.service.js';

dotenv.config();

class InMemoryAuthRepo {
  private users: Map<string, any> = new Map();
  private auditLogs: any[] = [];

  getPool(): any {
    return {
      query: async () => ({ rows: [] })
    };
  }

  async initTables(): Promise<void> {}

  async findUserByEmail(email: string): Promise<any | null> {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase() && !u.deleted_at) {
        return u;
      }
    }
    return null;
  }

  async findUserById(id: string): Promise<any | null> {
    return this.users.get(id) || null;
  }

  async findProfileByEmail(email: string): Promise<any | null> {
    return null;
  }

  async createUser(userData: any): Promise<any> {
    const id = userData.id || `user_${Date.now()}_${Math.random()}`;
    const user = {
      id,
      email: userData.email.toLowerCase(),
      password_hash: userData.password_hash,
      name: userData.name || null,
      role: userData.role || 'user',
      church_id: userData.church_id || null,
      permissions: userData.permissions || [],
      is_active: userData.is_active !== undefined ? userData.is_active : true,
      is_verified: userData.is_verified !== undefined ? userData.is_verified : false,
      totp_secret_encrypted: null,
      totp_temp_secret_encrypted: null,
      totp_enabled: false,
      totp_recovery_codes: [],
      failed_attempts: 0,
      lock_until: null,
      last_login: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserPassword(userId: string, newPasswordHash: string): Promise<void> {
    const u = this.users.get(userId);
    if (u) {
      u.password_hash = newPasswordHash;
      u.failed_attempts = 0;
      u.lock_until = null;
    }
  }

  async updateUserLoginSuccess(userId: string): Promise<void> {
    const u = this.users.get(userId);
    if (u) {
      u.last_login = new Date();
      u.failed_attempts = 0;
      u.lock_until = null;
    }
  }

  async incrementFailedAttempts(userId: string): Promise<{ locked: boolean }> {
    const u = this.users.get(userId);
    if (u) {
      u.failed_attempts += 1;
      if (u.failed_attempts >= 5) {
        u.lock_until = new Date(Date.now() + 15 * 60 * 1000);
        return { locked: true };
      }
    }
    return { locked: false };
  }

  async saveRefreshToken(): Promise<void> {}

  async createAuditLog(log: any): Promise<void> {
    this.auditLogs.push(log);
  }

  async saveTotpTempSecret(userId: string, encryptedTempSecret: string): Promise<void> {
    const u = this.users.get(userId);
    if (u) {
      u.totp_temp_secret_encrypted = encryptedTempSecret;
    }
  }

  async enableTotp(userId: string, encryptedSecret: string, hashedRecoveryCodes: string[]): Promise<void> {
    const u = this.users.get(userId);
    if (u) {
      u.totp_secret_encrypted = encryptedSecret;
      u.totp_enabled = true;
      u.totp_temp_secret_encrypted = null;
      u.totp_recovery_codes = hashedRecoveryCodes;
    }
  }

  async disableTotp(userId: string): Promise<void> {
    const u = this.users.get(userId);
    if (u) {
      u.totp_secret_encrypted = null;
      u.totp_temp_secret_encrypted = null;
      u.totp_enabled = false;
      u.totp_recovery_codes = [];
    }
  }

  async updateTotpRecoveryCodes(userId: string, remainingHashedCodes: string[]): Promise<void> {
    const u = this.users.get(userId);
    if (u) {
      u.totp_recovery_codes = remainingHashedCodes;
    }
  }

  async getTotpSecrets(userId: string): Promise<any> {
    const u = this.users.get(userId);
    if (!u) return null;
    return {
      totp_secret_encrypted: u.totp_secret_encrypted || null,
      totp_temp_secret_encrypted: u.totp_temp_secret_encrypted || null,
      totp_enabled: Boolean(u.totp_enabled),
      totp_recovery_codes: u.totp_recovery_codes || []
    };
  }
}

async function runEtapa8Tests() {
  console.log('=== EXECUTANDO BATERIA DE TESTES DA ETAPA 8 — 2FA PARA ADMINISTRADORES ===\n');

  let repo: any;
  let pool: pg.Pool | null = null;

  try {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/iggestor_contributors';
    pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 2000 });
    const realRepo = new AuthRepository(pool);
    await realRepo.initTables();
    repo = realRepo;
    console.log('[INFO] Conectado ao banco de dados PostgreSQL com sucesso.');
  } catch (err: any) {
    console.log('[INFO] Banco de dados não disponível diretamente no ambiente de teste sandbox. Utilizando Repositório em Memória para validação das regras da Etapa 8.');
    repo = new InMemoryAuthRepo();
  }

  const authService = new AuthService(repo as any);

  const testAdminEmail = `admin_2fa_test_${Date.now()}@iggestor.test`;
  const testUserEmail = `user_normal_test_${Date.now()}@iggestor.test`;
  const defaultPassword = 'Password123!';

  try {
    // -------------------------------------------------------------
    // SETUP: Criar usuário admin e usuário normal
    // -------------------------------------------------------------
    console.log('[SETUP] Criando usuário admin e usuário normal...');
    await authService.signup(testAdminEmail, defaultPassword, 'Admin Test 2FA', 'admin');
    await authService.signup(testUserEmail, defaultPassword, 'Normal User Test', 'user');

    const adminRefetched = await repo.findUserByEmail(testAdminEmail);
    console.log('Admin criado:', adminRefetched?.email, '| Role:', adminRefetched?.role);
    console.log('Usuário comum criado:', testUserEmail, '| Role: user\n');

    // -------------------------------------------------------------
    // TESTE 1: Administrador sem 2FA ativado
    // -------------------------------------------------------------
    console.log('[TESTE 1] Administrador sem 2FA configurado realiza login sem ativacao prévia');
    const loginResult1 = await authService.login(testAdminEmail, defaultPassword);
    const pass1 = Boolean(loginResult1.user && loginResult1.tokens?.accessToken && !loginResult1.user.two_factor_enabled);
    console.log('✓ Login de admin sem 2FA ativado concluído com sucesso:', pass1);

    // -------------------------------------------------------------
    // TESTE 2: Ativação do 2FA - Geração do segredo TOTP
    // -------------------------------------------------------------
    console.log('\n[TESTE 2] Geração do segredo TOTP (Setup 2FA)');
    const setupRes = await authService.setup2fa(adminRefetched!.id);
    const pass2 = Boolean(setupRes.secret && setupRes.otpauthUrl && setupRes.otpauthUrl.includes('otpauth://totp/'));
    console.log('✓ Segredo TOTP e URL otpauth gerados com sucesso:', pass2);
    console.log('  URL otpauth gerada:', setupRes.otpauthUrl.substring(0, 45) + '...');

    // -------------------------------------------------------------
    // TESTE 3: Confirmação com código TOTP inválido
    // -------------------------------------------------------------
    console.log('\n[TESTE 3] Tentativa de ativação com código TOTP inválido');
    let pass3 = false;
    try {
      await authService.confirm2fa(adminRefetched!.id, '000000');
    } catch (err: any) {
      pass3 = err.message.includes('inválido');
    }
    console.log('✓ Código TOTP inválido rejeitado corretamente:', pass3);

    // -------------------------------------------------------------
    // TESTE 4: Confirmação com código TOTP válido
    // -------------------------------------------------------------
    console.log('\n[TESTE 4] Confirmação e ativação do 2FA com código TOTP válido');
    const validCode = generateTotpCode(setupRes.secret);
    const confirmRes = await authService.confirm2fa(adminRefetched!.id, validCode);
    const pass4 = Array.isArray(confirmRes.recoveryCodes) && confirmRes.recoveryCodes.length === 8;
    console.log('✓ 2FA ativado com sucesso. Códigos de recuperação retornados:', pass4);
    console.log('  Qtd de códigos de recuperação gerados:', confirmRes.recoveryCodes.length);

    // -------------------------------------------------------------
    // TESTE 5: Login administrativo exigindo 2FA (Desafio 2FA)
    // -------------------------------------------------------------
    console.log('\n[TESTE 5] Login administrativo exigindo desafio 2FA');
    const loginResult2faReq = await authService.login(testAdminEmail, defaultPassword);
    const pass5 = Boolean(loginResult2faReq.requiresTwoFactor && loginResult2faReq.tempToken && !loginResult2faReq.tokens);
    console.log('✓ Login exigiu 2FA e retornou token temporário mfa:', pass5);

    // -------------------------------------------------------------
    // TESTE 6: Verificação de código TOTP no login administrativo
    // -------------------------------------------------------------
    console.log('\n[TESTE 6] Validação de código TOTP válido no login');
    const validCodeLogin = generateTotpCode(setupRes.secret);
    const verifyLoginRes = await authService.verifyLogin2fa(loginResult2faReq.tempToken!, validCodeLogin);
    const pass6 = Boolean(verifyLoginRes.user && verifyLoginRes.tokens?.accessToken);
    console.log('✓ Validação do TOTP no login concluída e JWT emitido:', pass6);

    // -------------------------------------------------------------
    // TESTE 7: Usuário comum continuando com fluxo normal
    // -------------------------------------------------------------
    console.log('\n[TESTE 7] Usuário comum realiza login direto (não afetado pelo 2FA de admin)');
    const normalUserLogin = await authService.login(testUserEmail, defaultPassword);
    const pass7 = Boolean(normalUserLogin.tokens?.accessToken && !normalUserLogin.requiresTwoFactor);
    console.log('✓ Fluxo de login de usuário comum intacto:', pass7);

    // -------------------------------------------------------------
    // TESTE 8: Uso de código de recuperação de emergência
    // -------------------------------------------------------------
    console.log('\n[TESTE 8] Login com código de recuperação de emergência');
    const recoveryCodeToUse = confirmRes.recoveryCodes[0];
    const loginResult2faReqRec = await authService.login(testAdminEmail, defaultPassword);
    const verifyRecoveryRes = await authService.verifyLogin2fa(loginResult2faReqRec.tempToken!, recoveryCodeToUse);
    const pass8 = Boolean(verifyRecoveryRes.tokens?.accessToken);
    console.log('✓ Login com código de recuperação bem-sucedido:', pass8);

    // Tentar reusar o mesmo código de recuperação (deve falhar pois foi consumido)
    let pass8Reuse = false;
    try {
      const loginReq2 = await authService.login(testAdminEmail, defaultPassword);
      await authService.verifyLogin2fa(loginReq2.tempToken!, recoveryCodeToUse);
    } catch {
      pass8Reuse = true;
    }
    console.log('✓ Código de recuperação reutilizado foi recusado corretamente:', pass8Reuse);

    // -------------------------------------------------------------
    // TESTE 9: Desativação protegida do 2FA
    // -------------------------------------------------------------
    console.log('\n[TESTE 9] Desativação protegida do 2FA com confirmação de senha');
    let pass9WrongPass = false;
    try {
      await authService.disable2fa(adminRefetched!.id, 'SenhaIncorreta!');
    } catch {
      pass9WrongPass = true;
    }

    await authService.disable2fa(adminRefetched!.id, defaultPassword);
    const adminDisabled = await repo.findUserByEmail(testAdminEmail);
    const pass9 = pass9WrongPass && !adminDisabled?.two_factor_enabled;
    console.log('✓ 2FA desativado com segurança mediante confirmação de senha:', pass9);

    // -------------------------------------------------------------
    // TESTE 10: Proteção do segredo e sanitização de dados nos logs/respostas
    // -------------------------------------------------------------
    console.log('\n[TESTE 10] Criptografia do segredo TOTP via AES-256-GCM e sanitização de logs');
    const sampleEncrypted = encryptSecret('TEST_SECRET_BASE32');
    const decrypted = decryptSecret(sampleEncrypted);
    const isCryptoValid = decrypted === 'TEST_SECRET_BASE32' && sampleEncrypted.includes(':');

    const auditDataToSanitize = {
      totp_code: '123456',
      totp_secret: 'SECRET_XYZ',
      recovery_code: 'REC123456',
      user_email: testAdminEmail
    };
    const sanitized = sanitizeAuditData(auditDataToSanitize);
    const isSanitized = sanitized.totp_code === '[REDACTED]' &&
                        sanitized.totp_secret === '[REDACTED]' &&
                        sanitized.recovery_code === '[REDACTED]' &&
                        sanitized.user_email === testAdminEmail;

    const pass10 = isCryptoValid && isSanitized;
    console.log('✓ Segredo protegido via AES-256-GCM e dados sanitizados em logs de auditoria:', pass10);

    // Final result check
    const allPassed = pass1 && pass2 && pass3 && pass4 && pass5 && pass6 && pass7 && pass8 && pass8Reuse && pass9 && pass10;
    console.log('\n=============================================================');
    if (allPassed) {
      console.log('Resultados dos testes: TODOS OS TESTES PASSARAM COM SUCESSO (10/10)!');
    } else {
      console.error('Resultados dos testes: ALGUNS TESTES FALHARAM.');
    }
    console.log('=============================================================\n');

  } catch (err) {
    console.error('Erro durante execução dos testes da Etapa 8:', err);
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}

runEtapa8Tests();
