import { PaymentItem, CreatePaymentDTO, UpdatePaymentDTO } from '../models/payment.model.js';

export class PaymentRepository {
  private pool: any;

  constructor(pool: any) {
    this.pool = pool;
  }

  async ensureTableExists(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS payments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        status TEXT DEFAULT 'approved',
        notes TEXT,
        payment_method TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    try {
      await this.pool.query(sql);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);`).catch(() => {});
    } catch (err: any) {
      console.warn('[PaymentRepository] Aviso ao verificar/criar tabela payments:', err?.message || err);
    }
  }

  private parseRow(row: any): PaymentItem {
    return {
      id: row.id,
      user_id: row.user_id,
      amount: Number(row.amount),
      status: row.status || 'approved',
      notes: row.notes,
      payment_method: row.payment_method,
      created_at: row.created_at
    };
  }

  async getAll(userId?: string): Promise<PaymentItem[]> {
    await this.ensureTableExists();
    let query = 'SELECT id, user_id, amount, status, notes, payment_method, created_at FROM payments';
    const params: any[] = [];

    if (userId && userId.trim() !== '') {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, params);
    return (result.rows || []).map((row: any) => this.parseRow(row));
  }

  async getById(id: string): Promise<PaymentItem | null> {
    await this.ensureTableExists();
    const query = 'SELECT id, user_id, amount, status, notes, payment_method, created_at FROM payments WHERE id = $1 LIMIT 1';
    const result = await this.pool.query(query, [id]);
    if (!result.rows || result.rows.length === 0) return null;
    return this.parseRow(result.rows[0]);
  }

  async create(dto: CreatePaymentDTO): Promise<PaymentItem> {
    await this.ensureTableExists();

    const query = `
      INSERT INTO payments (user_id, amount, status, notes, payment_method, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, user_id, amount, status, notes, payment_method, created_at
    `;

    const params = [
      dto.user_id,
      dto.amount,
      dto.status || 'approved',
      dto.notes || null,
      dto.payment_method || null
    ];

    const result = await this.pool.query(query, params);
    return this.parseRow(result.rows[0]);
  }

  async update(id: string, dto: UpdatePaymentDTO): Promise<PaymentItem | null> {
    await this.ensureTableExists();
    const existing = await this.getById(id);
    if (!existing) return null;

    const amount = dto.amount !== undefined ? dto.amount : existing.amount;
    const status = dto.status !== undefined ? dto.status : existing.status;
    const notes = dto.notes !== undefined ? dto.notes : existing.notes;
    const payment_method = dto.payment_method !== undefined ? dto.payment_method : existing.payment_method;

    const query = `
      UPDATE payments
      SET amount = $1, status = $2, notes = $3, payment_method = $4
      WHERE id = $5
      RETURNING id, user_id, amount, status, notes, payment_method, created_at
    `;

    const result = await this.pool.query(query, [amount, status, notes, payment_method, id]);
    if (!result.rows || result.rows.length === 0) return null;
    return this.parseRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureTableExists();
    const result = await this.pool.query('DELETE FROM payments WHERE id = $1 RETURNING id', [id]);
    return (result.rows && result.rows.length > 0);
  }
}
