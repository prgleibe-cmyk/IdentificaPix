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
    const query = 'SELECT * FROM profiles ORDER BY created_at DESC';
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
    if (!result.rows || result.rows.length === 0) return null;
    return this.parseRow(result.rows[0]);
  }

  async getByOwnerId(ownerId: string): Promise<ProfileItem[]> {
    await this.ensureTableExists();
    const query = `
      WITH owner_identifiers AS (
        SELECT id::text AS uid, email FROM app_users WHERE id::text = $1 OR (email IS NOT NULL AND LOWER(TRIM(email)) = (SELECT LOWER(TRIM(email)) FROM app_users WHERE id::text = $1 LIMIT 1))
        UNION
        SELECT id AS uid, email FROM profiles WHERE id = $1 OR (email IS NOT NULL AND LOWER(TRIM(email)) = (SELECT LOWER(TRIM(email)) FROM profiles WHERE id = $1 LIMIT 1))
      ),
      combined_users AS (
        -- 1. Usuários de app_users (fonte primária autoritativa) complementados por profiles
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
            u.owner_id::text = $1
            OR u.owner_id::text IN (SELECT uid FROM owner_identifiers)
          )

        UNION ALL

        -- 2. Perfis históricos legítimos em profiles que ainda não possuem registro correspondente em app_users
        SELECT 
          p.id,
          p.email,
          p.name,
          p.role,
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
          p.owner_id = $1
          OR p.owner_id IN (SELECT uid FROM owner_identifiers)
        )
        AND p.id NOT IN (SELECT u.id::text FROM app_users u WHERE u.deleted_at IS NULL)
        AND (p.email IS NULL OR LOWER(TRIM(p.email)) NOT IN (SELECT LOWER(TRIM(u.email)) FROM app_users u WHERE u.deleted_at IS NULL))
      )
      SELECT * FROM (
        SELECT DISTINCT ON (COALESCE(LOWER(TRIM(email)), id)) *
        FROM combined_users
        WHERE id NOT IN (SELECT uid FROM owner_identifiers)
          AND (email IS NULL OR LOWER(TRIM(email)) NOT IN (SELECT LOWER(TRIM(email)) FROM owner_identifiers WHERE email IS NOT NULL))
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

    // Sincronizar dados para app_users garantindo consistência na autenticação
    if (saved.email) {
      try {
        await this.pool.query(
          `UPDATE app_users 
           SET name = COALESCE($1, name),
               role = COALESCE($2, role),
               owner_id = $3,
               church_id = $4,
               permissions = COALESCE($5::jsonb, permissions),
               updated_at = NOW()
           WHERE LOWER(email) = LOWER($6) OR id::text = $7`,
          [
            saved.name || null,
            saved.role || null,
            saved.owner_id || null,
            saved.congregation || null,
            saved.permissions ? JSON.stringify(saved.permissions) : null,
            saved.email,
            saved.id
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
    if (!existing) return null;

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
    if (!result.rows || result.rows.length === 0) return null;
    const updated = this.parseRow(result.rows[0]);

    // Sincronizar dados para app_users garantindo consistência na autenticação
    if (updated.email) {
      try {
        await this.pool.query(
          `UPDATE app_users 
           SET name = COALESCE($1, name),
               role = COALESCE($2, role),
               owner_id = $3,
               church_id = $4,
               permissions = COALESCE($5::jsonb, permissions),
               updated_at = NOW()
           WHERE LOWER(email) = LOWER($6) OR id::text = $7`,
          [
            updated.name || null,
            updated.role || null,
            updated.owner_id || null,
            updated.congregation || null,
            updated.permissions ? JSON.stringify(updated.permissions) : null,
            updated.email,
            updated.id
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
    const result = await this.pool.query('DELETE FROM profiles WHERE id = $1 RETURNING id', [id]);
    return (result.rows && result.rows.length > 0);
  }
}
