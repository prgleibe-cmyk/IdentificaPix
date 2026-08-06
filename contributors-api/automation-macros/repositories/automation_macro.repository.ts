import { AutomationMacro, CreateAutomationMacroDTO, UpdateAutomationMacroDTO } from '../models/automation_macro.model.js';

export class AutomationMacroRepository {
  private pool: any;

  constructor(pool: any) {
    this.pool = pool;
  }

  /**
   * Garante que a tabela automation_macros exista no PostgreSQL.
   */
  async ensureTableExists(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS automation_macros (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id TEXT NOT NULL,
        bank_id TEXT,
        name TEXT NOT NULL,
        steps JSONB NOT NULL,
        target_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    try {
      await this.pool.query(sql);
      const indexSql = `CREATE INDEX IF NOT EXISTS idx_automation_macros_user_id ON automation_macros(user_id);`;
      await this.pool.query(indexSql).catch(() => {});
    } catch (err: any) {
      console.warn('[AutomationMacroRepository] Aviso ao verificar/criar tabela automation_macros:', err?.message || err);
    }
  }

  /**
   * Lista todas as macros ou filtra por user_id.
   */
  async getByUserId(userId?: string): Promise<AutomationMacro[]> {
    await this.ensureTableExists();
    let query = 'SELECT id, user_id, bank_id, name, steps, target_url, created_at FROM automation_macros';
    const params: any[] = [];

    if (userId && userId.trim() !== '') {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, params);
    return (result.rows || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      bank_id: row.bank_id,
      name: row.name,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      target_url: row.target_url,
      created_at: row.created_at
    }));
  }

  /**
   * Busca macro por ID.
   */
  async getById(id: string): Promise<AutomationMacro | null> {
    await this.ensureTableExists();
    const query = 'SELECT id, user_id, bank_id, name, steps, target_url, created_at FROM automation_macros WHERE id = $1 LIMIT 1';
    const result = await this.pool.query(query, [id]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      bank_id: row.bank_id,
      name: row.name,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      target_url: row.target_url,
      created_at: row.created_at
    };
  }

  /**
   * Cria nova macro de automação.
   */
  async create(dto: CreateAutomationMacroDTO): Promise<AutomationMacro> {
    await this.ensureTableExists();
    const stepsJson = typeof dto.steps === 'object' ? JSON.stringify(dto.steps) : dto.steps;

    const query = `
      INSERT INTO automation_macros (user_id, bank_id, name, steps, target_url, created_at)
      VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
      RETURNING id, user_id, bank_id, name, steps, target_url, created_at
    `;

    const params = [
      dto.user_id,
      dto.bank_id || null,
      dto.name,
      stepsJson,
      dto.target_url || null
    ];

    const result = await this.pool.query(query, params);
    const row = result.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      bank_id: row.bank_id,
      name: row.name,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      target_url: row.target_url,
      created_at: row.created_at
    };
  }

  /**
   * Atualiza uma macro existente por ID.
   */
  async update(id: string, dto: UpdateAutomationMacroDTO): Promise<AutomationMacro | null> {
    await this.ensureTableExists();
    const existing = await this.getById(id);
    if (!existing) return null;

    const name = dto.name !== undefined ? dto.name : existing.name;
    const bank_id = dto.bank_id !== undefined ? dto.bank_id : existing.bank_id;
    const target_url = dto.target_url !== undefined ? dto.target_url : existing.target_url;
    const steps = dto.steps !== undefined ? dto.steps : existing.steps;
    const stepsJson = typeof steps === 'object' ? JSON.stringify(steps) : steps;

    const query = `
      UPDATE automation_macros
      SET name = $1, bank_id = $2, target_url = $3, steps = $4::jsonb
      WHERE id = $5
      RETURNING id, user_id, bank_id, name, steps, target_url, created_at
    `;

    const result = await this.pool.query(query, [name, bank_id, target_url, stepsJson, id]);
    if (!result.rows || result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      bank_id: row.bank_id,
      name: row.name,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      target_url: row.target_url,
      created_at: row.created_at
    };
  }

  /**
   * Exclui uma macro por ID.
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureTableExists();
    const query = 'DELETE FROM automation_macros WHERE id = $1 RETURNING id';
    const result = await this.pool.query(query, [id]);
    return (result.rows && result.rows.length > 0);
  }
}
