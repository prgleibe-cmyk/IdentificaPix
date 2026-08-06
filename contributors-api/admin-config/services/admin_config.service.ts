import { AdminConfigRepository } from '../repositories/admin_config.repository.js';
import { AdminConfigItem, UpsertAdminConfigDTO } from '../models/admin_config.model.js';

export class AdminConfigService {
  private repo: AdminConfigRepository;

  constructor(repo: AdminConfigRepository) {
    this.repo = repo;
  }

  /**
   * Retorna todas as configurações como um mapa de chave-valor e lista de itens.
   */
  async getAll(): Promise<{ configMap: Record<string, any>; items: AdminConfigItem[] }> {
    const items = await this.repo.getAll();
    const configMap: Record<string, any> = {};
    for (const item of items) {
      configMap[item.key] = item.value;
    }
    return { configMap, items };
  }

  /**
   * Obtém uma configuração individual por chave.
   */
  async getByKey(key: string): Promise<AdminConfigItem | null> {
    return await this.repo.getByKey(key);
  }

  /**
   * Salva ou atualiza uma configuração completa.
   */
  async setConfig(dto: UpsertAdminConfigDTO): Promise<AdminConfigItem> {
    return await this.repo.upsert(dto);
  }

  /**
   * Atualização parcial de uma configuração.
   */
  async patchConfig(key: string, value: any): Promise<AdminConfigItem> {
    return await this.repo.patch(key, value);
  }

  /**
   * Migração automática de dados legados do Supabase se existirem.
   * Totalmente idempotente para evitar duplicações.
   */
  async migrateFromSupabase(supabaseRows: Array<{ key: string; value: any; updated_at?: string }>): Promise<{ migratedCount: number }> {
    let count = 0;
    if (!Array.isArray(supabaseRows) || supabaseRows.length === 0) {
      return { migratedCount: 0 };
    }

    for (const row of supabaseRows) {
      if (!row || !row.key) continue;
      const existing = await this.repo.getByKey(row.key);
      if (!existing) {
        await this.repo.upsert({ key: row.key, value: row.value });
        count++;
      }
    }
    return { migratedCount: count };
  }
}
