import { PaymentRepository } from '../repositories/payment.repository.js';
import { PaymentItem, CreatePaymentDTO, UpdatePaymentDTO } from '../models/payment.model.js';

export class PaymentService {
  private repo: PaymentRepository;

  constructor(repo: PaymentRepository) {
    this.repo = repo;
  }

  async getAll(userId?: string): Promise<PaymentItem[]> {
    return await this.repo.getAll(userId);
  }

  async getById(id: string): Promise<PaymentItem | null> {
    return await this.repo.getById(id);
  }

  async create(dto: CreatePaymentDTO): Promise<PaymentItem> {
    return await this.repo.create(dto);
  }

  async update(id: string, dto: UpdatePaymentDTO): Promise<PaymentItem | null> {
    return await this.repo.update(id, dto);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repo.delete(id);
  }

  async migrateFromSupabase(rows: PaymentItem[]): Promise<{ migratedCount: number }> {
    let count = 0;
    if (!Array.isArray(rows) || rows.length === 0) return { migratedCount: 0 };

    for (const row of rows) {
      if (!row || !row.user_id || row.amount === undefined) continue;
      if (row.id) {
        const existing = await this.repo.getById(row.id);
        if (existing) continue;
      }

      await this.repo.create({
        user_id: row.user_id,
        amount: Number(row.amount),
        status: row.status || 'approved',
        notes: row.notes || null,
        payment_method: row.payment_method || null
      });
      count++;
    }

    return { migratedCount: count };
  }
}
