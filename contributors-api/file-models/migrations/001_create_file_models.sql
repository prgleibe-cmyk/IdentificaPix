-- ============================================================
-- MIGRATION: 001_create_file_models.sql
-- TABELA DE MODELOS DE ARQUIVO (POSTGRESQL VPS)
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_file_models_user_id ON file_models(user_id);
CREATE INDEX IF NOT EXISTS idx_file_models_is_active ON file_models(is_active);
