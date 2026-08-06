import { ProfileRepository } from '../repositories/profile.repository.js';
import { ProfileItem, CreateProfileDTO, UpdateProfileDTO } from '../models/profile.model.js';

export class ProfileService {
  private repo: ProfileRepository;

  constructor(repo: ProfileRepository) {
    this.repo = repo;
  }

  async getAll(): Promise<ProfileItem[]> {
    return await this.repo.getAll();
  }

  async getById(id: string): Promise<ProfileItem | null> {
    return await this.repo.getById(id);
  }

  async getByOwnerId(ownerId: string): Promise<ProfileItem[]> {
    return await this.repo.getByOwnerId(ownerId);
  }

  async createOrUpsert(dto: CreateProfileDTO): Promise<ProfileItem> {
    return await this.repo.createOrUpsert(dto);
  }

  async update(id: string, dto: UpdateProfileDTO): Promise<ProfileItem | null> {
    return await this.repo.update(id, dto);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repo.delete(id);
  }

  async migrateFromSupabase(rows: ProfileItem[]): Promise<{ migratedCount: number }> {
    let count = 0;
    if (!Array.isArray(rows) || rows.length === 0) return { migratedCount: 0 };

    for (const row of rows) {
      if (!row || !row.id) continue;
      const existing = await this.repo.getById(row.id);
      if (existing) continue;

      await this.repo.createOrUpsert({
        id: row.id,
        email: row.email || null,
        name: row.name || null,
        role: row.role || 'owner',
        owner_id: row.owner_id || null,
        subscription_status: row.subscription_status || 'trial',
        subscription_ends_at: row.subscription_ends_at || null,
        trial_ends_at: row.trial_ends_at || null,
        limit_ai: row.limit_ai !== undefined ? row.limit_ai : 100,
        usage_ai: row.usage_ai !== undefined ? row.usage_ai : 0,
        max_churches: row.max_churches !== undefined ? row.max_churches : 2,
        max_banks: row.max_banks !== undefined ? row.max_banks : 2,
        custom_price: row.custom_price || null,
        is_blocked: row.is_blocked || false,
        is_lifetime: row.is_lifetime || false,
        permissions: row.permissions || null,
        congregation: row.congregation || null
      });
      count++;
    }

    return { migratedCount: count };
  }
}
