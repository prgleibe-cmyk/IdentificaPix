import { AutomationMacroRepository } from '../repositories/automation_macro.repository.js';
import { AutomationMacro, CreateAutomationMacroDTO, UpdateAutomationMacroDTO } from '../models/automation_macro.model.js';

export class AutomationMacroService {
  private repo: AutomationMacroRepository;

  constructor(repo: AutomationMacroRepository) {
    this.repo = repo;
  }

  async getByUserId(userId?: string): Promise<AutomationMacro[]> {
    return await this.repo.getByUserId(userId);
  }

  async getById(id: string): Promise<AutomationMacro | null> {
    return await this.repo.getById(id);
  }

  async create(dto: CreateAutomationMacroDTO): Promise<AutomationMacro> {
    return await this.repo.create(dto);
  }

  async update(id: string, dto: UpdateAutomationMacroDTO): Promise<AutomationMacro | null> {
    return await this.repo.update(id, dto);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repo.delete(id);
  }

  /**
   * Migração idempotente de registros do Supabase.
   */
  async migrateFromSupabase(rows: AutomationMacro[]): Promise<{ migratedCount: number }> {
    let count = 0;
    if (!Array.isArray(rows) || rows.length === 0) {
      return { migratedCount: 0 };
    }

    for (const row of rows) {
      if (!row || !row.user_id || !row.name) continue;
      if (row.id) {
        const existing = await this.repo.getById(row.id);
        if (existing) continue;
      }

      await this.repo.create({
        user_id: row.user_id,
        bank_id: row.bank_id || null,
        name: row.name,
        steps: row.steps,
        target_url: row.target_url || null
      });
      count++;
    }

    return { migratedCount: count };
  }
}
