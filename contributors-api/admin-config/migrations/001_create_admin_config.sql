-- ============================================================
-- MIGRATION: 001_create_admin_config.sql
-- TABELA DE CONFIGURAÇÕES ADMINISTRATIVAS (POSTGRESQL VPS)
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Garantir índice único para UPSERT
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_config_key ON admin_config(key);
