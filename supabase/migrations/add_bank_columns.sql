-- Safe migration to add bank_key and account_name columns to the banks table
-- Allowing NULL values for fallback compatibility with legacy records.

ALTER TABLE banks ADD COLUMN IF NOT EXISTS bank_key TEXT;
ALTER TABLE banks ADD COLUMN IF NOT EXISTS account_name TEXT;
