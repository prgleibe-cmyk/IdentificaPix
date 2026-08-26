import { LocalUser, RefreshTokenRecord, AuthAuditLogInput } from '../types/auth.types.js';

export class AuthRepository {
  private pool: any;

  constructor(pool: any) {
    this.pool = pool;
  }

  getPool(): any {
    return this.pool;
  }

  async initTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Table: app_users
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name VARCHAR(255),
          role VARCHAR(50) NOT NULL DEFAULT 'user',
          church_id UUID,
          permissions JSONB DEFAULT '[]'::jsonb,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          is_verified BOOLEAN NOT NULL DEFAULT FALSE,
          totp_secret_encrypted TEXT,
          totp_temp_secret_encrypted TEXT,
          totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          totp_recovery_codes JSONB DEFAULT '[]'::jsonb,
          failed_attempts INT NOT NULL DEFAULT 0,
          lock_until TIMESTAMP,
          last_login TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMP
        );
      `);

      // Migration for existing table app_users
      await client.query(`
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS totp_secret_encrypted TEXT;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS totp_temp_secret_encrypted TEXT;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS totp_recovery_codes JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS owner_id UUID;
      `);

      // Indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_app_users_church_id ON app_users(church_id);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_app_users_owner_id ON app_users(owner_id);');

      // Table: app_refresh_tokens
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_refresh_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          revoked BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          ip_address VARCHAR(100),
          user_agent TEXT
        );
      `);
      await client.query('CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_hash ON app_refresh_tokens(token_hash);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_user ON app_refresh_tokens(user_id);');

      // Table: app_password_resets
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_password_resets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          used BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // Table: app_email_verifications
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_email_verifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          used BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // Table: app_auth_audit_logs
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_auth_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID,
          email VARCHAR(255),
          event VARCHAR(100) NOT NULL,
          ip_address VARCHAR(100),
          user_agent TEXT,
          details JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // Table: app_revoked_access_tokens
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_revoked_access_tokens (
          jti VARCHAR(255) PRIMARY KEY,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      await client.query('COMMIT');
      console.log('[AuthRepository] Auth tables initialized successfully.');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[AuthRepository] Error initializing auth tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findUserByEmail(email: string): Promise<LocalUser | null> {
    const res = await this.pool.query(
      `SELECT u.*, COALESCE(u.owner_id::text, p.owner_id::text) as resolved_owner_id 
       FROM app_users u 
       LEFT JOIN profiles p ON (p.id = u.id::text OR LOWER(p.email) = LOWER(u.email))
       WHERE LOWER(u.email) = LOWER($1) AND u.deleted_at IS NULL LIMIT 1`,
      [email]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    if (row.resolved_owner_id && !row.owner_id) {
      row.owner_id = row.resolved_owner_id;
    }
    return this.mapUserRow(row);
  }

  async findProfileByEmail(email: string): Promise<{ id: string; owner_id?: string; name?: string; role?: string } | null> {
    try {
      const res = await this.pool.query(
        'SELECT id, owner_id, name, role FROM profiles WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [email]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0];
    } catch {
      return null;
    }
  }

  async findUserById(id: string): Promise<LocalUser | null> {
    const res = await this.pool.query(
      `SELECT u.*, COALESCE(u.owner_id::text, p.owner_id::text) as resolved_owner_id 
       FROM app_users u 
       LEFT JOIN profiles p ON (p.id = u.id::text OR LOWER(p.email) = LOWER(u.email))
       WHERE u.id::text = $1 AND u.deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    if (row.resolved_owner_id && !row.owner_id) {
      row.owner_id = row.resolved_owner_id;
    }
    return this.mapUserRow(row);
  }

  async createUser(userData: {
    id?: string;
    email: string;
    password_hash: string;
    name?: string | null;
    role?: string;
    owner_id?: string | null;
    church_id?: string | null;
    permissions?: string[];
    is_active?: boolean;
    is_verified?: boolean;
  }): Promise<LocalUser> {
    const permissionsJson = JSON.stringify(userData.permissions || []);
    const res = await this.pool.query(
      `INSERT INTO app_users 
       (id, email, password_hash, name, role, owner_id, church_id, permissions, is_active, is_verified)
       VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, COALESCE($5, 'user'), $6, $7, $8::jsonb, COALESCE($9, true), COALESCE($10, false))
       RETURNING *`,
      [
        userData.id || null,
        userData.email.toLowerCase(),
        userData.password_hash,
        userData.name || null,
        userData.role || 'user',
        userData.owner_id || null,
        userData.church_id || null,
        permissionsJson,
        userData.is_active !== undefined ? userData.is_active : true,
        userData.is_verified !== undefined ? userData.is_verified : false
      ]
    );
    const createdUser = this.mapUserRow(res.rows[0]);
    try {
      const effectiveOwnerId = userData.owner_id || createdUser.id;
      const initialRole = userData.owner_id && userData.owner_id !== createdUser.id ? (userData.role || 'member') : 'owner';
      await this.pool.query(
        `INSERT INTO profiles (id, email, name, role, owner_id, subscription_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'trial', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [createdUser.id, createdUser.email, createdUser.name || null, initialRole, effectiveOwnerId]
      );
    } catch {
      // Ignore if profiles table does not exist yet
    }
    return createdUser;
  }

  async updateUserPassword(userId: string, newPasswordHash: string): Promise<void> {
    await this.pool.query(
      'UPDATE app_users SET password_hash = $1, updated_at = NOW(), failed_attempts = 0, lock_until = NULL WHERE id = $2',
      [newPasswordHash, userId]
    );
  }

  async updateUserLoginSuccess(userId: string): Promise<void> {
    await this.pool.query(
      'UPDATE app_users SET last_login = NOW(), failed_attempts = 0, lock_until = NULL, updated_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  async incrementFailedAttempts(userId: string, maxAttempts = 5, lockDurationMinutes = 15): Promise<{ locked: boolean; lockUntil?: Date }> {
    const res = await this.pool.query(
      'SELECT failed_attempts FROM app_users WHERE id = $1',
      [userId]
    );
    const currentAttempts = (res.rows[0]?.failed_attempts || 0) + 1;

    if (currentAttempts >= maxAttempts) {
      const lockUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
      await this.pool.query(
        'UPDATE app_users SET failed_attempts = $1, lock_until = $2, updated_at = NOW() WHERE id = $3',
        [currentAttempts, lockUntil, userId]
      );
      return { locked: true, lockUntil };
    } else {
      await this.pool.query(
        'UPDATE app_users SET failed_attempts = $1, updated_at = NOW() WHERE id = $2',
        [currentAttempts, userId]
      );
      return { locked: false };
    }
  }

  async setUserVerified(userId: string): Promise<void> {
    await this.pool.query(
      'UPDATE app_users SET is_verified = TRUE, updated_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  // Refresh tokens
  async saveRefreshToken(tokenData: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO app_refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenData.userId, tokenData.tokenHash, tokenData.expiresAt, tokenData.ipAddress || null, tokenData.userAgent || null]
    );
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const res = await this.pool.query(
      'SELECT * FROM app_refresh_tokens WHERE token_hash = $1 LIMIT 1',
      [tokenHash]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      token_hash: row.token_hash,
      expires_at: new Date(row.expires_at),
      revoked: Boolean(row.revoked),
      created_at: new Date(row.created_at),
      ip_address: row.ip_address,
      user_agent: row.user_agent
    };
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.pool.query(
      'UPDATE app_refresh_tokens SET revoked = TRUE WHERE token_hash = $1',
      [tokenHash]
    );
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.pool.query(
      'UPDATE app_refresh_tokens SET revoked = TRUE WHERE user_id = $1',
      [userId]
    );
  }

  // Access Token Blacklist
  async blacklistJti(jti: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      'INSERT INTO app_revoked_access_tokens (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING',
      [jti, expiresAt]
    );
  }

  async isJtiBlacklisted(jti: string): Promise<boolean> {
    const res = await this.pool.query(
      'SELECT 1 FROM app_revoked_access_tokens WHERE jti = $1 LIMIT 1',
      [jti]
    );
    return res.rows.length > 0;
  }

  // Reset Tokens
  async savePasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      'INSERT INTO app_password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );
  }

  async findPasswordResetToken(tokenHash: string): Promise<{ id: string; user_id: string; expires_at: Date; used: boolean } | null> {
    const res = await this.pool.query(
      'SELECT * FROM app_password_resets WHERE token_hash = $1 LIMIT 1',
      [tokenHash]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      expires_at: new Date(row.expires_at),
      used: Boolean(row.used)
    };
  }

  async markPasswordResetUsed(tokenId: string): Promise<void> {
    await this.pool.query(
      'UPDATE app_password_resets SET used = TRUE WHERE id = $1',
      [tokenId]
    );
  }

  // Verification Tokens
  async saveEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      'INSERT INTO app_email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );
  }

  async findEmailVerificationToken(tokenHash: string): Promise<{ id: string; user_id: string; expires_at: Date; used: boolean } | null> {
    const res = await this.pool.query(
      'SELECT * FROM app_email_verifications WHERE token_hash = $1 LIMIT 1',
      [tokenHash]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      expires_at: new Date(row.expires_at),
      used: Boolean(row.used)
    };
  }

  async markEmailVerificationUsed(tokenId: string): Promise<void> {
    await this.pool.query(
      'UPDATE app_email_verifications SET used = TRUE WHERE id = $1',
      [tokenId]
    );
  }

  // Audit Logs
  async createAuditLog(log: AuthAuditLogInput): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO app_auth_audit_logs (user_id, email, event, ip_address, user_agent, details)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          log.user_id || null,
          log.email || null,
          log.event,
          log.ip_address || null,
          log.user_agent || null,
          log.details ? JSON.stringify(log.details) : null
        ]
      );
    } catch (err) {
      console.error('[AuthRepository] Failed to write audit log:', err);
    }
  }

  async saveTotpTempSecret(userId: string, encryptedTempSecret: string): Promise<void> {
    await this.pool.query(
      'UPDATE app_users SET totp_temp_secret_encrypted = $1, updated_at = NOW() WHERE id = $2',
      [encryptedTempSecret, userId]
    );
  }

  async enableTotp(userId: string, encryptedSecret: string, hashedRecoveryCodes: string[]): Promise<void> {
    await this.pool.query(
      `UPDATE app_users 
       SET totp_secret_encrypted = $1, 
           totp_enabled = TRUE, 
           totp_temp_secret_encrypted = NULL, 
           totp_recovery_codes = $2::jsonb, 
           updated_at = NOW() 
       WHERE id = $3`,
      [encryptedSecret, JSON.stringify(hashedRecoveryCodes), userId]
    );
  }

  async disableTotp(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE app_users 
       SET totp_secret_encrypted = NULL, 
           totp_temp_secret_encrypted = NULL, 
           totp_enabled = FALSE, 
           totp_recovery_codes = '[]'::jsonb, 
           updated_at = NOW() 
       WHERE id = $1`,
      [userId]
    );
  }

  async updateTotpRecoveryCodes(userId: string, remainingHashedCodes: string[]): Promise<void> {
    await this.pool.query(
      `UPDATE app_users SET totp_recovery_codes = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(remainingHashedCodes), userId]
    );
  }

  async getTotpSecrets(userId: string): Promise<{
    totp_secret_encrypted: string | null;
    totp_temp_secret_encrypted: string | null;
    totp_enabled: boolean;
    totp_recovery_codes: string[];
  } | null> {
    const res = await this.pool.query(
      `SELECT totp_secret_encrypted, totp_temp_secret_encrypted, totp_enabled, totp_recovery_codes FROM app_users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    let codes: string[] = [];
    if (Array.isArray(row.totp_recovery_codes)) codes = row.totp_recovery_codes;
    else if (typeof row.totp_recovery_codes === 'string') {
      try { codes = JSON.parse(row.totp_recovery_codes); } catch { codes = []; }
    }
    return {
      totp_secret_encrypted: row.totp_secret_encrypted || null,
      totp_temp_secret_encrypted: row.totp_temp_secret_encrypted || null,
      totp_enabled: Boolean(row.totp_enabled),
      totp_recovery_codes: codes
    };
  }

  private mapUserRow(row: any): LocalUser {
    let permissionsArr: string[] = [];
    if (Array.isArray(row.permissions)) {
      permissionsArr = row.permissions;
    } else if (typeof row.permissions === 'string') {
      try { permissionsArr = JSON.parse(row.permissions); } catch { permissionsArr = []; }
    }

    return {
      id: row.id,
      email: row.email,
      password_hash: row.password_hash,
      name: row.name,
      role: row.role,
      owner_id: row.owner_id || null,
      church_id: row.church_id,
      permissions: permissionsArr,
      is_active: Boolean(row.is_active),
      is_verified: Boolean(row.is_verified),
      two_factor_enabled: Boolean(row.totp_enabled),
      failed_attempts: Number(row.failed_attempts || 0),
      lock_until: row.lock_until ? new Date(row.lock_until) : null,
      last_login: row.last_login ? new Date(row.last_login) : null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      deleted_at: row.deleted_at ? new Date(row.deleted_at) : null
    };
  }
}
