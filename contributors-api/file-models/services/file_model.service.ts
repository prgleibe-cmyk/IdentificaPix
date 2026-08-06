import { FileModelRepository } from '../repositories/file_model.repository.js';
import { FileModelItem, CreateFileModelDTO, UpdateFileModelDTO } from '../models/file_model.model.js';

export class FileModelService {
  private repo: FileModelRepository;

  constructor(repo: FileModelRepository) {
    this.repo = repo;
  }

  async getUserModels(userId?: string): Promise<FileModelItem[]> {
    return await this.repo.getUserModels(userId);
  }

  async getAllAdmin(): Promise<FileModelItem[]> {
    return await this.repo.getAllAdmin();
  }

  async getById(id: string): Promise<FileModelItem | null> {
    return await this.repo.getById(id);
  }

  async create(dto: CreateFileModelDTO): Promise<FileModelItem> {
    if (dto.lineage_id) {
      await this.repo.deactivateLineage(dto.lineage_id);
    }
    return await this.repo.create(dto);
  }

  async update(id: string, dto: UpdateFileModelDTO): Promise<FileModelItem | null> {
    return await this.repo.update(id, dto);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repo.delete(id);
  }

  async migrateFromSupabase(rows: FileModelItem[]): Promise<{ migratedCount: number }> {
    let count = 0;
    if (!Array.isArray(rows) || rows.length === 0) return { migratedCount: 0 };

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
        version: row.version || 1,
        lineage_id: row.lineage_id || null,
        is_active: row.is_active !== undefined ? row.is_active : true,
        status: row.status || 'approved',
        fingerprint: row.fingerprint,
        mapping: row.mapping,
        parsing_rules: row.parsing_rules,
        snippet: row.snippet || null
      });
      count++;
    }

    return { migratedCount: count };
  }
}
