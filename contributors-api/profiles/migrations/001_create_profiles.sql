-- ============================================================
-- MIGRATION: 001_create_profiles.sql
-- TABELA DE PERFIS DE USUÁRIO (POSTGRESQL VPS)
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    role TEXT DEFAULT 'owner',
    owner_id TEXT,
    subscription_status TEXT DEFAULT 'trial',
    subscription_ends_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    limit_ai INT DEFAULT 100,
    usage_ai INT DEFAULT 0,
    max_churches INT DEFAULT 2,
    max_banks INT DEFAULT 2,
    custom_price NUMERIC,
    is_blocked BOOLEAN DEFAULT false,
    is_lifetime BOOLEAN DEFAULT false,
    permissions JSONB,
    congregation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_owner_id ON profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
