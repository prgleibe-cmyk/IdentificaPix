-- ============================================================
-- MIGRATION: 001_create_payments.sql
-- TABELA DE PAGAMENTOS (POSTGRESQL VPS)
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'approved',
    notes TEXT,
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
