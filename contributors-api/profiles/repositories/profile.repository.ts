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
      SELECT * FROM profiles 
      WHERE owner_id = $1 
         OR owner_id IN (SELECT id::text FROM app_users WHERE id::text = $1 OR owner_id::text = $1)
         OR owner_id IN (SELECT id FROM profiles WHERE id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
      ORDER BY created_at DESC
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
    return this.parseRow(result.rows[0]);
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
    return this.parseRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureTableExists();
    const result = await this.pool.query('DELETE FROM profiles WHERE id = $1 RETURNING id', [id]);
    return (result.rows && result.rows.length > 0);
  }
}
