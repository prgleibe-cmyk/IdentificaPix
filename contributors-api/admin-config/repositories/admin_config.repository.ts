import { AdminConfigItem, UpsertAdminConfigDTO } from '../models/admin_config.model.js';

export class AdminConfigRepository {
  private pool: any;

  constructor(pool: any) {
    this.pool = pool;
  }

  /**
   * Garante a existência da tabela admin_config e seus índices no PostgreSQL / SQLite.
   */
  async ensureTableExists(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS admin_config (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `;
    try {
      await this.pool.query(sql);
      // Garante constraint UNIQUE na coluna key se ainda não existia
      const uniqueIndexSql = `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_config_key ON admin_config(key);
      `;
      await this.pool.query(uniqueIndexSql).catch(() => {});
    } catch (err: any) {
      console.warn('[AdminConfigRepository] Aviso ao verificar/criar tabela admin_config:', err?.message || err);
    }
  }

  /**
   * Retorna todas as configurações cadastradas.
   */
  async getAll(): Promise<AdminConfigItem[]> {
    await this.ensureTableExists();
    const query = 'SELECT id, key, value, updated_at FROM admin_config ORDER BY updated_at DESC';
    const result = await this.pool.query(query);
    return (result.rows || []).map((row: any) => ({
      id: row.id,
      key: row.key,
      value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
      updated_at: row.updated_at
    }));
  }

  /**
   * Retorna uma configuração específica pela chave.
   */
  async getByKey(key: string): Promise<AdminConfigItem | null> {
    await this.ensureTableExists();
    const query = 'SELECT id, key, value, updated_at FROM admin_config WHERE key = $1 LIMIT 1';
    const result = await this.pool.query(query, [key]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      id: row.id,
      key: row.key,
      value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
      updated_at: row.updated_at
    };
  }

  /**
   * Grava ou atualiza (UPSERT) uma configuração com base na chave.
   */
  async upsert(dto: UpsertAdminConfigDTO): Promise<AdminConfigItem> {
    await this.ensureTableExists();
    const valueJson = typeof dto.value === 'object' ? JSON.stringify(dto.value) : JSON.stringify(dto.value);

    // PostgreSQL ON CONFLICT UPSERT
    const query = `
      INSERT INTO admin_config (key, value, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = NOW()
      RETURNING id, key, value, updated_at
    `;

    try {
      const result = await this.pool.query(query, [dto.key, valueJson]);
      const row = result.rows[0];
      return {
        id: row.id,
        key: row.key,
        value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
        updated_at: row.updated_at
      };
    } catch (err) {
      // Fallback simples para bancos sem suporte nativo a JSONB em ON CONFLICT (ex: SQLite)
      const existing = await this.getByKey(dto.key);
      if (existing) {
        const updateQuery = `
          UPDATE admin_config
          SET value = $2, updated_at = NOW()
          WHERE key = $1
          RETURNING id, key, value, updated_at
        `;
        const result = await this.pool.query(updateQuery, [dto.key, valueJson]);
        const row = result.rows[0] || { key: dto.key, value: dto.value, updated_at: new Date().toISOString() };
        return {
          id: row.id,
          key: row.key,
          value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
          updated_at: row.updated_at
        };
      } else {
        const insertQuery = `
          INSERT INTO admin_config (key, value, updated_at)
          VALUES ($1, $2, NOW())
          RETURNING id, key, value, updated_at
        `;
        const result = await this.pool.query(insertQuery, [dto.key, valueJson]);
        const row = result.rows[0];
        return {
          id: row.id,
          key: row.key,
          value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
          updated_at: row.updated_at
        };
      }
    }
  }

  /**
   * Atualização parcial (PATCH) por chave.
   */
  async patch(key: string, value: any): Promise<AdminConfigItem> {
    const existing = await this.getByKey(key);
    let newValue = value;
    if (existing && typeof existing.value === 'object' && typeof value === 'object' && value !== null) {
      newValue = { ...existing.value, ...value };
    }
    return this.upsert({ key, value: newValue });
  }
}
