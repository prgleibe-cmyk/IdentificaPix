-- CREATE UNIQUE INDEX unique_bank_account ON banks (bank_key, account_name)
-- This ensures database integrity preventing multiple accounts with same name under same bank.
-- Fallbacks gracefully for legacy records where values are null.

CREATE UNIQUE INDEX IF NOT EXISTS unique_bank_account
ON banks (bank_key, account_name);
