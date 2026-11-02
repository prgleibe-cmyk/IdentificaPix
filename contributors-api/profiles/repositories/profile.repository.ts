import { ProfileItem, CreateProfileDTO, UpdateProfileDTO } from '../models/profile.model.js';

export class ProfileRepository {
  private pool: any;

  constructor(pool: any) {
    this.pool = pool;
  }

  async ensureTableExists(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        role TEXT DEFAULT 'owner',
        owner_id TEXT,
        subscription_status TEXT DEFAULT 'trial',
        subscription_ends_at TIMESTAMPTZ,
        trial_ends_at TIMESTAMPTZ,
        limit_ai INT DEFAULT 100,
        usage_ai INT DEFAULT 0,
        max_churches INT DEFAULT 2,
        max_banks INT DEFAULT 2,
        custom_price NUMERIC,
        is_blocked BOOLEAN DEFAULT false,
        is_lifetime BOOLEAN DEFAULT false,
        permissions JSONB,
        congregation TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    try {
      await this.pool.query(sql);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_owner_id ON profiles(owner_id);`).catch(() => {});
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);`).catch(() => {});
      // 🛡️ Garante colunas de assinatura em app_users para redundância e resiliência total contra resets em deploy
      await this.pool.query(`ALTER TABLE app_users ADD COLUMN subscription_status TEXT DEFAULT 'trial';`).catch(() => {});
      await this.pool.query(`ALTER TABLE app_users ADD COLUMN subscription_ends_at TIMESTAMPTZ;`).catch(() => {});
      await this.pool.query(`ALTER TABLE app_users ADD COLUMN trial_ends_at TIMESTAMPTZ;`).catch(() => {});
    } catch (err: any) {
      console.warn('[ProfileRepository] Aviso ao verificar/criar tabela profiles:', err?.message || err);
    }
  }

  private parseRow(row: any): ProfileItem {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role || 'owner',
      owner_id: row.owner_id,
      subscription_status: row.subscription_status || 'trial',
      subscription_ends_at: row.subscription_ends_at,
      trial_ends_at: row.trial_ends_at,
      limit_ai: row.limit_ai !== null && row.limit_ai !== undefined ? Number(row.limit_ai) : 100,
      usage_ai: row.usage_ai !== null && row.usage_ai !== undefined ? Number(row.usage_ai) : 0,
      max_churches: row.max_churches !== null && row.max_churches !== undefined ? Number(row.max_churches) : 2,
      max_banks: row.max_banks !== null && row.max_banks !== undefined ? Number(row.max_banks) : 2,
      custom_price: row.custom_price !== null && row.custom_price !== undefined ? Number(row.custom_price) : null,
      is_blocked: Boolean(row.is_blocked),
      is_lifetime: Boolean(row.is_lifetime),
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      congregation: row.congregation,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async getAll(): Promise<ProfileItem[]> {
    await this.ensureTableExists();
    const query = `
      WITH combined_all AS (
        -- 1. Todos os usuários de app_users combinados com profiles
        SELECT 
          COALESCE(p.id, u.id::text) AS id,
          COALESCE(u.email, p.email) AS email,
          COALESCE(p.name, u.name, split_part(COALESCE(u.email, p.email, ''), '@', 1)) AS name,
          COALESCE(p.role, u.role::text, 'owner') AS role,
          COALESCE(p.owner_id, u.owner_id::text, u.id::text) AS owner_id,
          COALESCE(p.subscription_status, 'trial') AS subscription_status,
          p.subscription_ends_at,
          p.trial_ends_at,
          COALESCE(p.limit_ai, 100) AS limit_ai,
          COALESCE(p.usage_ai, 0) AS usage_ai,
          COALESCE(p.max_churches, 2) AS max_churches,
          COALESCE(p.max_banks, 2) AS max_banks,
          p.custom_price,
          COALESCE(p.is_blocked, NOT COALESCE(u.is_active, true), false) AS is_blocked,
          COALESCE(p.is_lifetime, false) AS is_lifetime,
          COALESCE(p.permissions, u.permissions, '{}'::jsonb) AS permissions,
          COALESCE(p.congregation, u.church_id::text, '') AS congregation,
          COALESCE(p.created_at, u.created_at, NOW()) AS created_at,
          COALESCE(p.updated_at, u.updated_at, NOW()) AS updated_at
        FROM app_users u
        LEFT JOIN profiles p ON (p.id = u.id::text OR (p.email IS NOT NULL AND u.email IS NOT NULL AND LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))))
        WHERE u.deleted_at IS NULL

        UNION ALL

        -- 2. Perfis em profiles sem correspondência em app_users
        SELECT 
          p.id,
          p.email,
          p.name,
          COALESCE(p.role, 'owner') AS role,
          COALESCE(p.owner_id, p.id) AS owner_id,
          COALESCE(p.subscription_status, 'trial') AS subscription_status,
          p.subscription_ends_at,
          p.trial_ends_at,
          COALESCE(p.limit_ai, 100) AS limit_ai,
          COALESCE(p.usage_ai, 0) AS usage_ai,
          COALESCE(p.max_churches, 2) AS max_churches,
          COALESCE(p.max_banks, 2) AS max_banks,
          p.custom_price,
          COALESCE(p.is_blocked, false) AS is_blocked,
          COALESCE(p.is_lifetime, false) AS is_lifetime,
          COALESCE(p.permissions, '{}'::jsonb) AS permissions,
          COALESCE(p.congregation, '') AS congregation,
          COALESCE(p.created_at, NOW()) AS created_at,
          COALESCE(p.updated_at, NOW()) AS updated_at
        FROM profiles p
        WHERE p.id NOT IN (SELECT u.id::text FROM app_users u WHERE u.deleted_at IS NULL)
          AND (p.email IS NULL OR LOWER(TRIM(p.email)) NOT IN (SELECT LOWER(TRIM(u.email)) FROM app_users u WHERE u.deleted_at IS NULL))
      )
      SELECT DISTINCT ON (COALESCE(LOWER(TRIM(email)), id)) *
      FROM combined_all
      ORDER BY COALESCE(LOWER(TRIM(email)), id), created_at DESC;
    `;
    const result = await this.pool.query(query);
    return (result.rows || []).map((row: any) => this.parseRow(row));
  }

  async getById(id: string): Promise<ProfileItem | null> {
    await this.ensureTableExists();
    const query = `
      SELECT * FROM profiles 
      WHERE id = $1 
         OR LOWER(email) = LOWER($1)
         OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1)
      LIMIT 1
    `;
    const result = await this.pool.query(query, [id]);
    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    // 🛡️ Fallback de Resiliência: se o registro não estiver na tabela profiles,
    // busca diretamente em app_users para permitir exclusão e resolução completa
    try {
      const userRes = await this.pool.query(
        `SELECT id::text AS id, email, name, role, owner_id, church_id, permissions, is_active, 
                subscription_status, subscription_ends_at, trial_ends_at, created_at, updated_at
         FROM app_users
         WHERE id::text = $1 OR LOWER(email) = LOWER($1)
         LIMIT 1`,
        [id]
      );
      if (userRes.rows && userRes.rows.length > 0) {
        const uRow = userRes.rows[0];
        let perms = uRow.permissions;
        if (typeof perms === 'string') {
          try { perms = JSON.parse(perms); } catch (_) { perms = {}; }
        }
        return {
          id: uRow.id,
          email: uRow.email,
          name: uRow.name || (uRow.email ? uRow.email.split('@')[0] : null),
          role: uRow.role || 'member',
          owner_id: uRow.owner_id || uRow.id,
          subscription_status: uRow.subscription_status || 'trial',
          subscription_ends_at: uRow.subscription_ends_at || null,
          trial_ends_at: uRow.trial_ends_at || null,
          limit_ai: 100,
          usage_ai: 0,
          max_churches: 2,
          max_banks: 2,
          custom_price: null,
          is_blocked: Boolean(uRow.is_active === 0 || uRow.is_active === false),
          is_lifetime: uRow.subscription_status === 'lifetime',
          permissions: perms || {},
          congregation: uRow.church_id || '',
          created_at: uRow.created_at,
          updated_at: uRow.updated_at
        };
      }
    } catch (err: any) {
      console.warn('[ProfileRepository] Erro no fallback de getById em app_users:', err?.message || err);
    }

    return null;
  }

  async getByOwnerId(ownerId: string): Promise<ProfileItem[]> {
    await this.ensureTableExists();
    const query = `
      WITH target_identities AS (
        SELECT id::text AS uid, email, owner_id::text AS owner_ref FROM app_users 
        WHERE id::text = $1 
           OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($1)))
           OR (email IS NOT NULL AND LOWER(TRIM(email)) = (SELECT LOWER(TRIM(email)) FROM profiles WHERE id = $1 LIMIT 1))
        UNION
        SELECT id AS uid, email, owner_id AS owner_ref FROM profiles 
        WHERE id = $1 
           OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($1)))
           OR (email IS NOT NULL AND LOWER(TRIM(email)) = (SELECT LOWER(TRIM(email)) FROM app_users WHERE id::text = $1 LIMIT 1))
        UNION
        SELECT $1 AS uid, NULL AS email, NULL AS owner_ref
      ),
      all_owner_keys AS (
        SELECT uid AS key_val FROM target_identities WHERE uid IS NOT NULL
        UNION
        SELECT LOWER(TRIM(uid)) AS key_val FROM target_identities WHERE uid IS NOT NULL
        UNION
        SELECT email AS key_val FROM target_identities WHERE email IS NOT NULL
        UNION
        SELECT LOWER(TRIM(email)) AS key_val FROM target_identities WHERE email IS NOT NULL
        UNION
        SELECT split_part(LOWER(TRIM(email)), '@', 1) AS key_val FROM target_identities WHERE email IS NOT NULL
        UNION
        SELECT owner_ref AS key_val FROM target_identities WHERE owner_ref IS NOT NULL
        UNION
        SELECT LOWER(TRIM(owner_ref)) AS key_val FROM target_identities WHERE owner_ref IS NOT NULL
        UNION
        SELECT $1 AS key_val
        UNION
        SELECT LOWER(TRIM($1)) AS key_val
      ),
      owner_self_identities AS (
        SELECT uid AS id_val FROM target_identities WHERE uid IS NOT NULL
        UNION
        SELECT LOWER(TRIM(uid)) AS id_val FROM target_identities WHERE uid IS NOT NULL
        UNION
        SELECT email AS id_val FROM target_identities WHERE email IS NOT NULL
        UNION
        SELECT LOWER(TRIM(email)) AS id_val FROM target_identities WHERE email IS NOT NULL
        UNION
        SELECT $1 AS id_val
        UNION
        SELECT LOWER(TRIM($1)) AS id_val
      ),
      combined_users AS (
        -- 1. Usuários secundários de app_users (fonte primária autoritativa) complementados por profiles
        SELECT 
          COALESCE(p.id, u.id::text) AS id,
          COALESCE(u.email, p.email) AS email,
          COALESCE(p.name, u.name, split_part(COALESCE(u.email, p.email, ''), '@', 1)) AS name,
          COALESCE(p.role, u.role::text, 'member') AS role,
          COALESCE(p.owner_id, u.owner_id::text, $1) AS owner_id,
          p.subscription_status,
          p.subscription_ends_at,
          p.trial_ends_at,
          p.limit_ai,
          p.usage_ai,
          p.max_churches,
          p.max_banks,
          p.custom_price,
          COALESCE(p.is_blocked, NOT COALESCE(u.is_active, true), false) AS is_blocked,
          p.is_lifetime,
          COALESCE(p.permissions, u.permissions, '{}'::jsonb) AS permissions,
          COALESCE(p.congregation, u.church_id::text, '') AS congregation,
          COALESCE(p.created_at, u.created_at, NOW()) AS created_at,
          COALESCE(p.updated_at, u.updated_at, NOW()) AS updated_at
        FROM app_users u
        LEFT JOIN profiles p ON (p.id = u.id::text OR (p.email IS NOT NULL AND u.email IS NOT NULL AND LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))))
        WHERE u.deleted_at IS NULL
          AND (
            u.owner_id::text IN (SELECT key_val FROM all_owner_keys WHERE key_val IS NOT NULL)
            OR LOWER(TRIM(u.owner_id::text)) IN (SELECT key_val FROM all_owner_keys WHERE key_val IS NOT NULL)
            OR (p.owner_id IS NOT NULL AND (
                p.owner_id IN (SELECT key_val FROM all_owner_keys WHERE key_val IS NOT NULL)
                OR LOWER(TRIM(p.owner_id)) IN (SELECT key_val FROM all_owner_keys WHERE key_val IS NOT NULL)
            ))
          )

        UNION ALL

        -- 2. Perfis históricos legítimos em profiles que ainda não possuem registro correspondente em app_users
        SELECT 
          p.id,
          p.email,
          p.name,
          COALESCE(p.role, 'member') AS role,
          p.owner_id,
          p.subscription_status,
          p.subscription_ends_at,
          p.trial_ends_at,
          p.limit_ai,
          p.usage_ai,
          p.max_churches,
          p.max_banks,
          p.custom_price,
          p.is_blocked,
          p.is_lifetime,
          p.permissions,
          p.congregation,
          p.created_at,
          p.updated_at
        FROM profiles p
        WHERE (
          p.owner_id IN (SELECT key_val FROM all_owner_keys WHERE key_val IS NOT NULL)
          OR LOWER(TRIM(p.owner_id)) IN (SELECT key_val FROM all_owner_keys WHERE key_val IS NOT NULL)
        )
        AND p.id NOT IN (SELECT u.id::text FROM app_users u WHERE u.deleted_at IS NULL)
        AND (p.email IS NULL OR LOWER(TRIM(p.email)) NOT IN (SELECT LOWER(TRIM(u.email)) FROM app_users u WHERE u.deleted_at IS NULL))
      )
      SELECT * FROM (
        SELECT DISTINCT ON (COALESCE(LOWER(TRIM(email)), id)) *
        FROM combined_users
        WHERE (id IS NULL OR id NOT IN (SELECT id_val FROM owner_self_identities WHERE id_val IS NOT NULL))
          AND (email IS NULL OR LOWER(TRIM(email)) NOT IN (SELECT id_val FROM owner_self_identities WHERE id_val IS NOT NULL))
        ORDER BY COALESCE(LOWER(TRIM(email)), id), created_at DESC
      ) final_deduplicated
      ORDER BY created_at DESC;
    `;
    const result = await this.pool.query(query, [ownerId]);
    return (result.rows || []).map((row: any) => this.parseRow(row));
  }

  async createOrUpsert(dto: CreateProfileDTO): Promise<ProfileItem> {
    await this.ensureTableExists();

    const permissionsJson = typeof dto.permissions === 'object' ? JSON.stringify(dto.permissions) : dto.permissions;

    const query = `
      INSERT INTO profiles (
        id, email, name, role, owner_id, subscription_status, subscription_ends_at, trial_ends_at,
        limit_ai, usage_ai, max_churches, max_banks, custom_price, is_blocked, is_lifetime,
        permissions, congregation, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, profiles.email),
        name = COALESCE(EXCLUDED.name, profiles.name),
        role = COALESCE(EXCLUDED.role, profiles.role),
        owner_id = COALESCE(EXCLUDED.owner_id, profiles.owner_id),
        subscription_status = COALESCE(EXCLUDED.subscription_status, profiles.subscription_status),
        subscription_ends_at = COALESCE(EXCLUDED.subscription_ends_at, profiles.subscription_ends_at),
        trial_ends_at = COALESCE(EXCLUDED.trial_ends_at, profiles.trial_ends_at),
        limit_ai = COALESCE(EXCLUDED.limit_ai, profiles.limit_ai),
        usage_ai = COALESCE(EXCLUDED.usage_ai, profiles.usage_ai),
        max_churches = COALESCE(EXCLUDED.max_churches, profiles.max_churches),
        max_banks = COALESCE(EXCLUDED.max_banks, profiles.max_banks),
        custom_price = COALESCE(EXCLUDED.custom_price, profiles.custom_price),
        is_blocked = COALESCE(EXCLUDED.is_blocked, profiles.is_blocked),
        is_lifetime = COALESCE(EXCLUDED.is_lifetime, profiles.is_lifetime),
        permissions = COALESCE(EXCLUDED.permissions, profiles.permissions),
        congregation = COALESCE(EXCLUDED.congregation, profiles.congregation),
        updated_at = NOW()
      RETURNING *
    `;

    const params = [
      dto.id,
      dto.email || null,
      dto.name || null,
      dto.role || 'owner',
      dto.owner_id || null,
      dto.subscription_status || 'trial',
      dto.subscription_ends_at || null,
      dto.trial_ends_at || null,
      dto.limit_ai !== undefined ? dto.limit_ai : 100,
      dto.usage_ai !== undefined ? dto.usage_ai : 0,
      dto.max_churches !== undefined ? dto.max_churches : 2,
      dto.max_banks !== undefined ? dto.max_banks : 2,
      dto.custom_price !== undefined ? dto.custom_price : null,
      dto.is_blocked !== undefined ? dto.is_blocked : false,
      dto.is_lifetime !== undefined ? dto.is_lifetime : false,
      permissionsJson || null,
      dto.congregation || null
    ];

    const result = await this.pool.query(query, params);
    const saved = this.parseRow(result.rows[0]);

    // Sincronizar dados para app_users garantindo consistência na autenticação e assinatura
    if (saved.email) {
      try {
        await this.pool.query(
          `UPDATE app_users 
           SET name = COALESCE($1, name),
               role = COALESCE($2, role),
               owner_id = $3,
               church_id = $4,
               permissions = COALESCE($5::jsonb, permissions),
               subscription_status = COALESCE($8, subscription_status),
               subscription_ends_at = COALESCE($9, subscription_ends_at),
               trial_ends_at = COALESCE($10, trial_ends_at),
               updated_at = NOW()
           WHERE LOWER(email) = LOWER($6) OR id::text = $7`,
          [
            saved.name || null,
            saved.role || null,
            saved.owner_id || null,
            saved.congregation || null,
            saved.permissions ? JSON.stringify(saved.permissions) : null,
            saved.email,
            saved.id,
            saved.subscription_status || null,
            saved.subscription_ends_at || null,
            saved.trial_ends_at || null
          ]
        );
      } catch (syncErr: any) {
        console.warn('[ProfileRepository] Aviso ao sincronizar app_users no create/upsert:', syncErr?.message || syncErr);
      }
    }

    return saved;
  }

  async update(id: string, dto: UpdateProfileDTO): Promise<ProfileItem | null> {
    await this.ensureTableExists();
    const existing = await this.getById(id);
    if (!existing) {
      // Se o usuário ainda não existe em nenhuma tabela, cria via createOrUpsert
      return await this.createOrUpsert({
        id,
        email: dto.email || (id.includes('@') ? id : null),
        name: dto.name,
        role: dto.role || 'owner',
        owner_id: dto.owner_id || id,
        subscription_status: dto.subscription_status || 'trial',
        subscription_ends_at: dto.subscription_ends_at,
        trial_ends_at: dto.trial_ends_at,
        limit_ai: dto.limit_ai,
        usage_ai: dto.usage_ai,
        max_churches: dto.max_churches,
        max_banks: dto.max_banks,
        custom_price: dto.custom_price,
        is_blocked: dto.is_blocked,
        is_lifetime: dto.is_lifetime,
        permissions: dto.permissions,
        congregation: dto.congregation
      });
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const addField = (col: string, val: any, isJson = false) => {
      if (val !== undefined) {
        if (isJson) {
          fields.push(`${col} = $${idx}::jsonb`);
          values.push(typeof val === 'object' ? JSON.stringify(val) : val);
        } else {
          fields.push(`${col} = $${idx}`);
          values.push(val);
        }
        idx++;
      }
    };

    addField('email', dto.email);
    addField('name', dto.name);
    addField('role', dto.role);
    addField('owner_id', dto.owner_id);
    addField('subscription_status', dto.subscription_status);
    addField('subscription_ends_at', dto.subscription_ends_at);
    addField('trial_ends_at', dto.trial_ends_at);
    addField('limit_ai', dto.limit_ai);
    addField('usage_ai', dto.usage_ai);
    addField('max_churches', dto.max_churches);
    addField('max_banks', dto.max_banks);
    addField('custom_price', dto.custom_price);
    addField('is_blocked', dto.is_blocked);
    addField('is_lifetime', dto.is_lifetime);
    addField('permissions', dto.permissions, true);
    addField('congregation', dto.congregation);

    if (fields.length === 0) return existing;

    fields.push(`updated_at = NOW()`);
    values.push(existing.id);

    const query = `
      UPDATE profiles
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    if (!result.rows || result.rows.length === 0) {
      // Se não havia linha correspondente em profiles, faz um upsert completo para nunca perder dados de assinatura
      return await this.createOrUpsert({
        id: existing.id,
        email: dto.email !== undefined ? dto.email : existing.email,
        name: dto.name !== undefined ? dto.name : existing.name,
        role: dto.role !== undefined ? dto.role : existing.role,
        owner_id: dto.owner_id !== undefined ? dto.owner_id : existing.owner_id,
        subscription_status: dto.subscription_status !== undefined ? dto.subscription_status : existing.subscription_status,
        subscription_ends_at: dto.subscription_ends_at !== undefined ? dto.subscription_ends_at : existing.subscription_ends_at,
        trial_ends_at: dto.trial_ends_at !== undefined ? dto.trial_ends_at : existing.trial_ends_at,
        limit_ai: dto.limit_ai !== undefined ? dto.limit_ai : existing.limit_ai,
        usage_ai: dto.usage_ai !== undefined ? dto.usage_ai : existing.usage_ai,
        max_churches: dto.max_churches !== undefined ? dto.max_churches : existing.max_churches,
        max_banks: dto.max_banks !== undefined ? dto.max_banks : existing.max_banks,
        custom_price: dto.custom_price !== undefined ? dto.custom_price : existing.custom_price,
        is_blocked: dto.is_blocked !== undefined ? dto.is_blocked : existing.is_blocked,
        is_lifetime: dto.is_lifetime !== undefined ? dto.is_lifetime : existing.is_lifetime,
        permissions: dto.permissions !== undefined ? dto.permissions : existing.permissions,
        congregation: dto.congregation !== undefined ? dto.congregation : existing.congregation
      });
    }
    const updated = this.parseRow(result.rows[0]);

    // Sincronizar dados para app_users garantindo consistência na autenticação e assinatura
    if (updated.email) {
      try {
        await this.pool.query(
          `UPDATE app_users 
           SET name = COALESCE($1, name),
               role = COALESCE($2, role),
               owner_id = $3,
               church_id = $4,
               permissions = COALESCE($5::jsonb, permissions),
               subscription_status = COALESCE($8, subscription_status),
               subscription_ends_at = COALESCE($9, subscription_ends_at),
               trial_ends_at = COALESCE($10, trial_ends_at),
               updated_at = NOW()
           WHERE LOWER(email) = LOWER($6) OR id::text = $7`,
          [
            updated.name || null,
            updated.role || null,
            updated.owner_id || null,
            updated.congregation || null,
            updated.permissions ? JSON.stringify(updated.permissions) : null,
            updated.email,
            updated.id,
            updated.subscription_status || null,
            updated.subscription_ends_at || null,
            updated.trial_ends_at || null
          ]
        );
      } catch (syncErr: any) {
        console.warn('[ProfileRepository] Aviso ao sincronizar app_users no update:', syncErr?.message || syncErr);
      }
    }

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureTableExists();

    const existing = await this.getById(id);
    const targetId = existing?.id || id;
    const targetEmail = existing?.email ? existing.email.toLowerCase().trim() : null;

    let deletedFromProfiles = false;
    let deletedFromAppUsers = false;

    // 1. Remover da tabela profiles
    try {
      let pQuery = 'DELETE FROM profiles WHERE id = $1';
      let pParams: any[] = [targetId];
      if (targetEmail) {
        pQuery = 'DELETE FROM profiles WHERE id = $1 OR LOWER(TRIM(email)) = $2';
        pParams = [targetId, targetEmail];
      }
      const pRes = await this.pool.query(pQuery, pParams);
      if ((pRes?.rows && pRes.rows.length > 0) || (pRes?.rowCount && pRes.rowCount > 0)) {
        deletedFromProfiles = true;
      }
    } catch (err: any) {
      console.warn('[ProfileRepository] Erro ao deletar em profiles:', err?.message || err);
    }

    // 2. Marcar como deletado e inativo na tabela app_users (soft-delete seguro)
    try {
      let uQuery = 'UPDATE app_users SET deleted_at = NOW(), is_active = false WHERE id::text = $1';
      let uParams: any[] = [targetId];
      if (targetEmail) {
        uQuery = 'UPDATE app_users SET deleted_at = NOW(), is_active = false WHERE id::text = $1 OR LOWER(TRIM(email)) = $2';
        uParams = [targetId, targetEmail];
      }
      const uRes = await this.pool.query(uQuery, uParams);
      if ((uRes?.rows && uRes.rows.length > 0) || (uRes?.rowCount && uRes.rowCount > 0)) {
        deletedFromAppUsers = true;
      }
    } catch (err: any) {
      console.warn('[ProfileRepository] Erro ao soft-delete em app_users:', err?.message || err);
    }

    // 3. Revogar tokens de refresh vinculados
    try {
      await this.pool.query(
        `DELETE FROM app_refresh_tokens WHERE user_id = $1`,
        [targetId]
      );
    } catch (_) {}

    return deletedFromProfiles || deletedFromAppUsers || true;
  }
}
