-- ============================================================
-- MIGRATION: 001_create_automation_macros.sql
-- TABELA DE MACROS DE AUTOMAÇÃO (POSTGRESQL VPS)
-- ============================================================

CREATE TABLE IF NOT EXISTS automation_macros (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    bank_id TEXT,
    name TEXT NOT NULL,
    steps JSONB NOT NULL,
    target_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice por user_id para otimização de busca
CREATE INDEX IF NOT EXISTS idx_automation_macros_user_id ON automation_macros(user_id);
