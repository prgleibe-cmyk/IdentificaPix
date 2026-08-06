import { FileModelItem, CreateFileModelDTO, UpdateFileModelDTO } from '../models/file_model.model.js';

export class FileModelRepository {
  private pool: any;

  constructor(pool: any) {
    this.pool = pool;
  }

  async ensureTableExists(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS file_models (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id TEXT NOT NULL,
        bank_id TEXT,
        name TEXT NOT NULL,
        version INT DEFAULT 1,
        lineage_id TEXT,
        is_active BOOLEAN DEFAULT true,
        status TEXT DEFAULT 'approved',
        fingerprint JSONB,
        mapping JSONB,
        parsing_rules JSONB,
        snippet TEXT,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    try {
      await this.pool.query(sql);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_file_models_user_id ON file_models(user_id);`).catch(() => {});
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_file_models_is_active ON file_models(is_active);`).catch(() => {});
    } catch (err: any) {
      console.warn('[FileModelRepository] Aviso ao verificar/criar tabela file_models:', err?.message || err);
    }
  }

  private parseRow(row: any): FileModelItem {
    return {
      id: row.id,
      user_id: row.user_id,
      bank_id: row.bank_id,
      name: row.name,
      version: row.version,
      lineage_id: row.lineage_id,
      is_active: row.is_active,
      status: row.status,
      fingerprint: typeof row.fingerprint === 'string' ? JSON.parse(row.fingerprint) : row.fingerprint,
      mapping: typeof row.mapping === 'string' ? JSON.parse(row.mapping) : row.mapping,
      parsing_rules: typeof row.parsing_rules === 'string' ? JSON.parse(row.parsing_rules) : row.parsing_rules,
      snippet: row.snippet,
      last_used_at: row.last_used_at,
      created_at: row.created_at
    };
  }

  async getUserModels(userId?: string): Promise<FileModelItem[]> {
    await this.ensureTableExists();
    let query = `
      SELECT id, user_id, bank_id, name, version, lineage_id, is_active, status, 
             fingerprint, mapping, parsing_rules, snippet, last_used_at, created_at 
      FROM file_models
    `;
    const params: any[] = [];

    if (userId && userId.trim() !== '') {
      query += ` WHERE is_active = true OR user_id = $1`;
      params.push(userId);
    } else {
      query += ` WHERE is_active = true`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.pool.query(query, params);
    return (result.rows || []).map((row: any) => this.parseRow(row));
  }

  async getAllAdmin(): Promise<FileModelItem[]> {
    await this.ensureTableExists();
    const query = `
      SELECT id, user_id, bank_id, name, version, lineage_id, is_active, status, 
             fingerprint, mapping, parsing_rules, snippet, last_used_at, created_at 
      FROM file_models
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query);
    return (result.rows || []).map((row: any) => this.parseRow(row));
  }

  async getById(id: string): Promise<FileModelItem | null> {
    await this.ensureTableExists();
    const query = `
      SELECT id, user_id, bank_id, name, version, lineage_id, is_active, status, 
             fingerprint, mapping, parsing_rules, snippet, last_used_at, created_at 
      FROM file_models WHERE id = $1 LIMIT 1
    `;
    const result = await this.pool.query(query, [id]);
    if (!result.rows || result.rows.length === 0) return null;
    return this.parseRow(result.rows[0]);
  }

  async deactivateLineage(lineageId: string): Promise<void> {
    await this.ensureTableExists();
    await this.pool.query(`UPDATE file_models SET is_active = false WHERE lineage_id = $1`, [lineageId]);
  }

  async create(dto: CreateFileModelDTO): Promise<FileModelItem> {
    await this.ensureTableExists();

    const fingerprintJson = typeof dto.fingerprint === 'object' ? JSON.stringify(dto.fingerprint) : dto.fingerprint;
    const mappingJson = typeof dto.mapping === 'object' ? JSON.stringify(dto.mapping) : dto.mapping;
    const parsingRulesJson = typeof dto.parsing_rules === 'object' ? JSON.stringify(dto.parsing_rules) : dto.parsing_rules;

    const query = `
      INSERT INTO file_models (
        user_id, bank_id, name, version, lineage_id, is_active, status,
        fingerprint, mapping, parsing_rules, snippet, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, NOW())
      RETURNING *
    `;

    const params = [
      dto.user_id,
      dto.bank_id || null,
      dto.name,
      dto.version || 1,
      dto.lineage_id || null,
      dto.is_active !== undefined ? dto.is_active : true,
      dto.status || 'approved',
      fingerprintJson || null,
      mappingJson || null,
      parsingRulesJson || null,
      dto.snippet || null
    ];

    const result = await this.pool.query(query, params);
    return this.parseRow(result.rows[0]);
  }

  async update(id: string, dto: UpdateFileModelDTO): Promise<FileModelItem | null> {
    await this.ensureTableExists();
    const existing = await this.getById(id);
    if (!existing) return null;

    const name = dto.name !== undefined ? dto.name : existing.name;
    const status = dto.status !== undefined ? dto.status : existing.status;
    const is_active = dto.is_active !== undefined ? dto.is_active : existing.is_active;
    const snippet = dto.snippet !== undefined ? dto.snippet : existing.snippet;
    const last_used_at = dto.last_used_at !== undefined ? dto.last_used_at : new Date().toISOString();

    const fingerprint = dto.fingerprint !== undefined ? dto.fingerprint : existing.fingerprint;
    const mapping = dto.mapping !== undefined ? dto.mapping : existing.mapping;
    const parsing_rules = dto.parsing_rules !== undefined ? dto.parsing_rules : existing.parsing_rules;

    const fingerprintJson = typeof fingerprint === 'object' ? JSON.stringify(fingerprint) : fingerprint;
    const mappingJson = typeof mapping === 'object' ? JSON.stringify(mapping) : mapping;
    const parsingRulesJson = typeof parsing_rules === 'object' ? JSON.stringify(parsing_rules) : parsing_rules;

    const query = `
      UPDATE file_models
      SET name = $1, status = $2, is_active = $3, snippet = $4, last_used_at = $5,
          fingerprint = $6::jsonb, mapping = $7::jsonb, parsing_rules = $8::jsonb
      WHERE id = $9
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      name, status, is_active, snippet, last_used_at,
      fingerprintJson || null, mappingJson || null, parsingRulesJson || null, id
    ]);

    if (!result.rows || result.rows.length === 0) return null;
    return this.parseRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureTableExists();
    const result = await this.pool.query('DELETE FROM file_models WHERE id = $1 RETURNING id', [id]);
    return (result.rows && result.rows.length > 0);
  }
}
